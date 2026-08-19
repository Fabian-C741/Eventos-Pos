import { BadRequest } from '../errors';
import { allRows, exec, getRow } from '../db/db';
import { hashPassword, verifyPassword, randomToken, safePin } from '../security';
import { logger } from '../logger';
import type { Role, User } from '../../shared/types';

type UserRow = User & { password_hash: string };

const SESSION_DAYS = 14;

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 10;

interface AttemptRec {
  fails: number;
  lockedUntil: number | null;
}
const loginAttempts = new Map<string, AttemptRec>();

function checkLocked(username: string) {
  const rec = loginAttempts.get(username);
  if (rec?.lockedUntil && rec.lockedUntil > Date.now()) {
    const mins = Math.max(1, Math.ceil((rec.lockedUntil - Date.now()) / 60000));
    logger.warn('auth', `Intento de login bloqueado: ${username}`);
    throw BadRequest(`Demasiados intentos fallidos. Probá de nuevo en ${mins} min.`);
  }
  if (rec?.lockedUntil && rec.lockedUntil <= Date.now()) loginAttempts.delete(username);
}

function recordFailedAttempt(username: string) {
  const rec = loginAttempts.get(username) ?? { fails: 0, lockedUntil: null };
  rec.fails += 1;
  if (rec.fails >= MAX_FAILED_ATTEMPTS) {
    rec.lockedUntil = Date.now() + LOCK_MINUTES * 60 * 1000;
    rec.fails = 0;
    logger.warn('auth', `Cuenta bloqueada temporalmente por intentos fallidos: ${username}`);
  }
  loginAttempts.set(username, rec);
}

function recordSuccess(username: string) {
  loginAttempts.delete(username);
}

async function upsertSeqFor(name: string, base: string) {
  if (!(await getRow('SELECT name FROM seq WHERE name = ?', name))) {
    await exec('INSERT INTO seq (name, value) VALUES (?, ?)', name, base);
  }
}

export async function initSequenceCounters() {
  const events = await allRows<{ id: number }>('SELECT id FROM events');
  for (const ev of events) {
    await upsertSeqFor(`event_op_${ev.id}`, '0');
  }
  const types = await allRows<{ id: number; last_number: number | null }>('SELECT id, last_number FROM ticket_types');
  for (const t of types) {
    await upsertSeqFor(`ticket_${t.id}`, String(t.last_number ?? 0));
  }
}

export async function needsSetup(): Promise<boolean> {
  const row = await getRow<{ c: number }>('SELECT COUNT(*) AS c FROM users');
  return (row?.c ?? 0) === 0;
}

export async function createSuperadmin(email: string, password: string, name: string) {
  const emailNorm = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
    throw BadRequest('Ingresá un email válido');
  }
  if (password.length < 6) {
    throw BadRequest('La contraseña debe tener al menos 6 caracteres');
  }
  if (!(await needsSetup())) {
    throw BadRequest('El sistema ya está configurado');
  }
  await exec(
    'INSERT INTO users (username, password_hash, role, name) VALUES (?, ?, ?, ?)',
    emailNorm,
    hashPassword(password),
    'superadmin',
    name.trim() || 'Super Administrador',
  );
  logger.info('auth', 'Superadministrador creado');
  return true;
}

export async function login(username: string, password: string, device: string): Promise<{ token: string; user: User }> {
  const usernameNorm = username.trim().toLowerCase();
  checkLocked(usernameNorm);
  const user = await getRow<UserRow>('SELECT * FROM users WHERE username = ? AND active = 1', usernameNorm);
  if (!user || !verifyPassword(password, user.password_hash)) {
    recordFailedAttempt(usernameNorm);
    logger.warn('auth', `Login fallido: ${usernameNorm}`, undefined, undefined, device);
    throw Object.assign(new Error('Usuario o contraseña incorrectos'), { friendly: 'Usuario o contraseña incorrectos' });
  }
  recordSuccess(usernameNorm);
  return createSession(user, device);
}

export async function loginPin(username: string, pin: string, device: string): Promise<{ token: string; user: User }> {
  if (!safePin(pin)) {
    throw Object.assign(new Error('PIN inválido'), { friendly: 'El PIN debe tener 4 dígitos' });
  }
  const usernameNorm = username.trim().toLowerCase();
  checkLocked(usernameNorm);
  const user = await getRow<UserRow>('SELECT * FROM users WHERE username = ? AND role = ? AND active = 1', usernameNorm, 'cajero');
  if (!user || !verifyPassword(pin, user.password_hash)) {
    recordFailedAttempt(usernameNorm);
    logger.warn('auth', `Login PIN fallido: ${usernameNorm}`, undefined, undefined, device);
    throw Object.assign(new Error('PIN incorrecto'), { friendly: 'PIN incorrecto. Probá de nuevo' });
  }
  recordSuccess(usernameNorm);
  return createSession(user, device);
}

async function createSession(user: User, device: string): Promise<{ token: string; user: User }> {
  const token = randomToken(32);
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await exec('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)', token, user.id, expires);
  await exec('UPDATE users SET last_login_at = datetime(\'now\',\'localtime\') WHERE id = ?', user.id);
  logger.info('auth', `Login: ${user.username} (${user.role})`, undefined, user.id, device);
  const { password_hash: _ph, ...safe } = user as User & { password_hash: string };
  return { token, user: safe };
}

export async function validateSession(token: string): Promise<User | null> {
  if (!token) return null;
  const row = await getRow<User>(
    `SELECT u.id, u.username, u.name, u.role, u.active, u.created_at, u.last_login_at, u.pos_categories, u.pos_tickets
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > ?`,
    token,
    new Date().toISOString(),
  );
  if (!row) return null;
  if (!row.active) return null;
  return row;
}

export async function logout(token: string) {
  if (token) await exec('DELETE FROM sessions WHERE token = ?', token);
}

export async function cleanupSessions() {
  await exec('DELETE FROM sessions WHERE expires_at <= ?', new Date().toISOString());
}

export async function listUsers(actorRole: Role): Promise<User[]> {
  const filter = actorRole === 'superadmin' ? '' : "WHERE role IN ('admin','cajero')";
  return allRows<User>(
    `SELECT id, username, name, role, active, pos_categories, pos_tickets, created_at, last_login_at
     FROM users ${filter} ORDER BY CASE role WHEN 'superadmin' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, name`,
  );
}

export async function createUser(input: {
  username: string;
  name: string;
  role: Role;
  password?: string;
  pin?: string;
  pos_categories?: string;
  pos_tickets?: number;
}, actorRole: Role): Promise<number> {
  const { username, name, role } = input;
  const usernameNorm = username.trim().toLowerCase();
  if (!usernameNorm) throw BadRequest('El usuario es obligatorio');
  if (role === 'superadmin' && actorRole !== 'superadmin') throw BadRequest('Solo el superadministrador puede crear administradores');
  if (role === 'admin' && actorRole !== 'superadmin') throw BadRequest('Solo el superadministrador puede crear administradores');
  if (await getRow('SELECT id FROM users WHERE username = ?', usernameNorm)) {
    throw BadRequest('Ese usuario ya existe');
  }
  let pwd: string;
  if (role === 'cajero') {
    const pin = input.pin ?? '0000';
    if (!safePin(pin)) throw BadRequest('El PIN debe tener 4 dígitos');
    pwd = hashPassword(pin);
  } else {
    if (!input.password || input.password.length < 6) throw BadRequest('La contraseña debe tener al menos 6 caracteres');
    pwd = hashPassword(input.password);
  }
  const res = await exec(
    'INSERT INTO users (username, password_hash, role, name, pos_categories, pos_tickets) VALUES (?, ?, ?, ?, ?, ?)',
    usernameNorm,
    pwd,
    role,
    name.trim() || usernameNorm,
    role === 'cajero' ? input.pos_categories ?? null : null,
    role === 'cajero' ? (input.pos_tickets ?? 1) : 1,
  );
  return res.lastInsertRowid;
}

export async function updateUser(id: number, input: { name?: string; active?: number; password?: string; pin?: string; pos_categories?: string; pos_tickets?: number }, actorRole: Role, actorId: number) {
  const target = await getRow<User>('SELECT * FROM users WHERE id = ?', id);
  if (!target) throw BadRequest('Usuario no encontrado');
  if (target.role === 'superadmin' && target.id !== actorId) throw BadRequest('No podés modificar al superadministrador');
  if (target.role === 'admin' && actorRole !== 'superadmin') throw BadRequest('Solo el superadministrador puede modificar administradores');
  if (input.name !== undefined) await exec('UPDATE users SET name = ? WHERE id = ?', input.name.trim(), id);
  if (input.active !== undefined) await exec('UPDATE users SET active = ? WHERE id = ?', input.active ? 1 : 0, id);
  if (input.password && target.role !== 'cajero') {
    if (input.password.length < 6) throw BadRequest('La contraseña debe tener al menos 6 caracteres');
    await exec('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(input.password), id);
  }
  if (input.pin && target.role === 'cajero') {
    if (!safePin(input.pin)) throw BadRequest('El PIN debe tener 4 dígitos');
    await exec('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(input.pin), id);
  }
  if (input.pos_categories !== undefined) await exec('UPDATE users SET pos_categories = ? WHERE id = ?', input.pos_categories, id);
  if (input.pos_tickets !== undefined) await exec('UPDATE users SET pos_tickets = ? WHERE id = ?', input.pos_tickets ? 1 : 0, id);
  return true;
}

export async function deleteUser(id: number, actorRole: Role, actorId: number) {
  const target = await getRow<User>('SELECT * FROM users WHERE id = ?', id);
  if (!target) throw BadRequest('Usuario no encontrado');
  if (target.role === 'superadmin') throw BadRequest('No se puede eliminar al superadministrador');
  if (target.role === 'admin' && actorRole !== 'superadmin') throw BadRequest('Solo el superadministrador puede eliminar administradores');
  const sales = await getRow<{ c: number }>('SELECT COUNT(*) AS c FROM sales WHERE user_id = ?', id);
  if ((sales?.c ?? 0) > 0) {
    await exec('UPDATE users SET active = 0 WHERE id = ?', id);
    return 'disabled';
  }
  await exec('DELETE FROM users WHERE id = ?', id);
  return 'deleted';
}

export async function listActiveCashiers(): Promise<User[]> {
  return allRows<User>(
    `SELECT id, username, name, role, active, pos_categories, pos_tickets, created_at, last_login_at
     FROM users WHERE role = 'cajero' AND active = 1 ORDER BY name`,
  );
}

export async function changeOwnPassword(userId: number, current: string, next: string) {
  const user = await getRow<UserRow>('SELECT * FROM users WHERE id = ?', userId);
  if (!user || !verifyPassword(current, user.password_hash)) {
    throw BadRequest('La contraseña actual es incorrecta');
  }
  if (next.length < 6) throw BadRequest('La nueva contraseña debe tener al menos 6 caracteres');
  await exec('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(next), userId);
  return true;
}
