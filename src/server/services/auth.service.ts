import { BadRequest } from '../errors';
import { allRows, exec, getRow, getDb } from '../db/db';
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

function upsertSeqFor(name: string, base: string) {
  const d = getDb();
  if (!d.prepare('SELECT name FROM seq WHERE name = ?').get(name)) {
    d.prepare('INSERT INTO seq (name, value) VALUES (?, ?)').run(name, base);
  }
}

export function initSequenceCounters() {
  const d = getDb();
  const events = allRows<{ id: number }>('SELECT id FROM events');
  for (const ev of events) {
    upsertSeqFor(`event_op_${ev.id}`, '0');
  }
  const types = allRows<{ id: number; last_number: number | null }>('SELECT id, last_number FROM ticket_types');
  for (const t of types) {
    upsertSeqFor(`ticket_${t.id}`, String(t.last_number ?? 0));
  }
}

export function needsSetup(): boolean {
  return getRow<{ c: number }>('SELECT COUNT(*) AS c FROM users')!.c === 0;
}

export function createSuperadmin(email: string, password: string, name: string) {
  const emailNorm = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
    throw BadRequest('Ingresá un email válido');
  }
  if (password.length < 6) {
    throw BadRequest('La contraseña debe tener al menos 6 caracteres');
  }
  if (!needsSetup()) {
    throw BadRequest('El sistema ya está configurado');
  }
  exec(
    'INSERT INTO users (username, password_hash, role, name) VALUES (?, ?, ?, ?)',
    emailNorm,
    hashPassword(password),
    'superadmin',
    name.trim() || 'Super Administrador',
  );
  logger.info('auth', 'Superadministrador creado');
  return true;
}

export function login(username: string, password: string, device: string): { token: string; user: User } {
  const usernameNorm = username.trim().toLowerCase();
  checkLocked(usernameNorm);
  const user = getRow<UserRow>('SELECT * FROM users WHERE username = ? AND active = 1', usernameNorm);
  if (!user || !verifyPassword(password, user.password_hash)) {
    recordFailedAttempt(usernameNorm);
    logger.warn('auth', `Login fallido: ${usernameNorm}`, undefined, undefined, device);
    throw Object.assign(new Error('Usuario o contraseña incorrectos'), { friendly: 'Usuario o contraseña incorrectos' });
  }
  recordSuccess(usernameNorm);
  return createSession(user, device);
}

export function loginPin(username: string, pin: string, device: string): { token: string; user: User } {
  if (!safePin(pin)) {
    throw Object.assign(new Error('PIN inválido'), { friendly: 'El PIN debe tener 4 dígitos' });
  }
  const usernameNorm = username.trim().toLowerCase();
  checkLocked(usernameNorm);
  const user = getRow<UserRow>('SELECT * FROM users WHERE username = ? AND role = ? AND active = 1', usernameNorm, 'cajero');
  if (!user || !verifyPassword(pin, user.password_hash)) {
    recordFailedAttempt(usernameNorm);
    logger.warn('auth', `Login PIN fallido: ${usernameNorm}`, undefined, undefined, device);
    throw Object.assign(new Error('PIN incorrecto'), { friendly: 'PIN incorrecto. Probá de nuevo' });
  }
  recordSuccess(usernameNorm);
  return createSession(user, device);
}

function createSession(user: User, device: string): { token: string; user: User } {
  const token = randomToken(32);
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  exec('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)', token, user.id, expires);
  exec('UPDATE users SET last_login_at = datetime(\'now\',\'localtime\') WHERE id = ?', user.id);
  logger.info('auth', `Login: ${user.username} (${user.role})`, undefined, user.id, device);
  const { password_hash: _ph, ...safe } = user as User & { password_hash: string };
  return { token, user: safe };
}

export function validateSession(token: string): User | null {
  if (!token) return null;
  const row = getDb()
    .prepare(
      `SELECT u.id, u.username, u.name, u.role, u.active, u.created_at, u.last_login_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ?`,
    )
    .get(token, new Date().toISOString()) as User | undefined;
  if (!row) return null;
  if (!row.active) return null;
  return row;
}

export function logout(token: string) {
  if (token) exec('DELETE FROM sessions WHERE token = ?', token);
}

export function cleanupSessions() {
  exec('DELETE FROM sessions WHERE expires_at <= ?', new Date().toISOString());
}

export function listUsers(): User[] {
  return allRows<User>(
    `SELECT id, username, name, role, active, created_at, last_login_at
     FROM users ORDER BY CASE role WHEN 'superadmin' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, name`,
  );
}

export function createUser(input: {
  username: string;
  name: string;
  role: Role;
  password?: string;
  pin?: string;
}, actorRole: Role) {
  const { username, name, role } = input;
  const usernameNorm = username.trim().toLowerCase();
  if (!usernameNorm) throw BadRequest('El usuario es obligatorio');
  if (role === 'superadmin' && actorRole !== 'superadmin') throw BadRequest('Solo el superadministrador puede crear administradores');
  if (role === 'admin' && actorRole !== 'superadmin') throw BadRequest('Solo el superadministrador puede crear administradores');
  if (getRow('SELECT id FROM users WHERE username = ?', usernameNorm)) {
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
  const res = exec(
    'INSERT INTO users (username, password_hash, role, name) VALUES (?, ?, ?, ?)',
    usernameNorm,
    pwd,
    role,
    name.trim() || usernameNorm,
  );
  return res.lastInsertRowid;
}

export function updateUser(id: number, input: { name?: string; active?: number; password?: string; pin?: string }, actorRole: Role, actorId: number) {
  const target = getRow<User>('SELECT * FROM users WHERE id = ?', id);
  if (!target) throw BadRequest('Usuario no encontrado');
  if (target.role === 'superadmin' && target.id !== actorId) throw BadRequest('No podés modificar al superadministrador');
  if (target.role === 'admin' && actorRole !== 'superadmin') throw BadRequest('Solo el superadministrador puede modificar administradores');
  if (input.name !== undefined) exec('UPDATE users SET name = ? WHERE id = ?', input.name.trim(), id);
  if (input.active !== undefined) exec('UPDATE users SET active = ? WHERE id = ?', input.active ? 1 : 0, id);
  if (input.password && target.role !== 'cajero') {
    if (input.password.length < 6) throw BadRequest('La contraseña debe tener al menos 6 caracteres');
    exec('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(input.password), id);
  }
  if (input.pin && target.role === 'cajero') {
    if (!safePin(input.pin)) throw BadRequest('El PIN debe tener 4 dígitos');
    exec('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(input.pin), id);
  }
  return true;
}

export function deleteUser(id: number, actorRole: Role, actorId: number) {
  const target = getRow<User>('SELECT * FROM users WHERE id = ?', id);
  if (!target) throw BadRequest('Usuario no encontrado');
  if (target.role === 'superadmin') throw BadRequest('No se puede eliminar al superadministrador');
  if (target.role === 'admin' && actorRole !== 'superadmin') throw BadRequest('Solo el superadministrador puede eliminar administradores');
  const sales = getRow<{ c: number }>('SELECT COUNT(*) AS c FROM sales WHERE user_id = ?', id);
  if (sales!.c > 0) {
    exec('UPDATE users SET active = 0 WHERE id = ?', id);
    return 'disabled';
  }
  exec('DELETE FROM users WHERE id = ?', id);
  return 'deleted';
}

export function changeOwnPassword(userId: number, current: string, next: string) {
const user = getRow<UserRow>('SELECT * FROM users WHERE id = ?', userId);
  if (!user || !verifyPassword(current, user.password_hash)) {
    throw BadRequest('La contraseña actual es incorrecta');
  }
  if (next.length < 6) throw BadRequest('La nueva contraseña debe tener al menos 6 caracteres');
  exec('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(next), userId);
  return true;
}