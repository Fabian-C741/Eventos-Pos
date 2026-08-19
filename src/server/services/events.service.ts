import { BadRequest, NotFound } from '../errors';
import { allRows, exec, getRow, runInTransaction } from '../db/db';
import { audit } from './audit.service';
import type { Event, Role } from '../../shared/types';

export interface Actor {
  id: number;
  role: Role;
  owner_id?: number | null;
}

export function tenantScope(actor: Actor): number | 'all' | 'none' {
  if (actor.role === 'superadmin') return 'all';
  if (actor.role === 'admin') return actor.id;
  return actor.owner_id ?? 'none';
}

export async function canAccessEvent(actor: Actor, eventId: number): Promise<boolean> {
  const scope = tenantScope(actor);
  if (scope === 'none') return false;
  if (scope === 'all') {
    return !!(await getRow<{ id: number }>('SELECT id FROM events WHERE id = ?', eventId));
  }
  return !!(await getRow<{ id: number }>('SELECT id FROM events WHERE id = ? AND owner_id = ?', eventId, scope));
}

export async function assertEventAccess(actor: Actor, eventId: number) {
  if (!(await canAccessEvent(actor, eventId))) throw NotFound('Evento no encontrado');
}

export async function listEvents(actor: Actor, includeInactive = true): Promise<Event[]> {
  const scope = tenantScope(actor);
  if (scope === 'none') return [];
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (scope !== 'all') {
    clauses.push('owner_id = ?');
    params.push(scope);
  }
  if (!includeInactive) clauses.push('active = 1');
  const whereSql = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
  const sql = `SELECT * FROM events ${whereSql} ORDER BY active DESC, start_date DESC, name`;
  return allRows<Event>(sql, ...params);
}

export async function getEvent(id: number): Promise<Event | undefined> {
  return getRow<Event>('SELECT * FROM events WHERE id = ?', id);
}

export async function createEvent(
  input: { name: string; description?: string; venue?: string; start_date?: string; end_date?: string; active?: number; owner_id?: number | null },
  actor: Actor,
) {
  const name = input.name.trim();
  if (!name) throw BadRequest('El nombre del evento es obligatorio');
  let ownerId: number | null;
  if (actor.role === 'superadmin') {
    ownerId = input.owner_id ?? null;
  } else {
    ownerId = actor.id;
  }
  if (ownerId !== null) {
    const owner = await getRow<{ id: number }>('SELECT id FROM users WHERE id = ? AND role = ?', ownerId, 'admin');
    if (!owner) throw BadRequest('El dueño del evento debe ser un administrador');
  }
  const res = await exec(
    'INSERT INTO events (name, description, venue, start_date, end_date, active, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    name,
    input.description ?? '',
    input.venue ?? '',
    input.start_date ?? '',
    input.end_date ?? '',
    input.active === 0 ? 0 : 1,
    ownerId,
  );
  const id = res.lastInsertRowid;
  await audit(actor.id, 'create', 'event', id, { name, owner_id: ownerId });
  return getEvent(id)!;
}

export async function updateEvent(
  id: number,
  input: Partial<{ name: string; description: string; venue: string; start_date: string; end_date: string; active: number; owner_id: number | null }>,
  actor: Actor,
) {
  const cur = await getEvent(id);
  if (!cur) throw NotFound('Evento no encontrado');
  await assertEventAccess(actor, id);
  let ownerId = cur.owner_id ?? null;
  if (actor.role === 'superadmin' && input.owner_id !== undefined) {
    ownerId = input.owner_id ?? null;
    if (ownerId !== null) {
      const owner = await getRow<{ id: number }>('SELECT id FROM users WHERE id = ? AND role = ?', ownerId, 'admin');
      if (!owner) throw BadRequest('El dueño del evento debe ser un administrador');
    }
  }
  await exec(
    `UPDATE events SET name = ?, description = ?, venue = ?, start_date = ?, end_date = ?, active = ?, owner_id = ? WHERE id = ?`,
    input.name?.trim() ?? cur.name,
    input.description ?? cur.description,
    input.venue ?? cur.venue,
    input.start_date ?? cur.start_date,
    input.end_date ?? cur.end_date,
    input.active === undefined ? cur.active : input.active ? 1 : 0,
    ownerId,
    id,
  );
  await audit(actor.id, 'update', 'event', id, { name: input.name, owner_id: input.owner_id });
  return getEvent(id)!;
}

export async function deleteEvent(id: number, actor: Actor) {
  const cur = await getEvent(id);
  if (!cur) throw NotFound('Evento no encontrado');
  await assertEventAccess(actor, id);
  await runInTransaction(async () => {
    await exec('DELETE FROM sale_tickets WHERE sale_id IN (SELECT id FROM sales WHERE event_id = ?)', id);
    await exec('DELETE FROM tickets WHERE sale_id IN (SELECT id FROM sales WHERE event_id = ?)', id);
    await exec('DELETE FROM voids WHERE sale_id IN (SELECT id FROM sales WHERE event_id = ?)', id);
    await exec('DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE event_id = ?)', id);
    await exec('DELETE FROM sales WHERE event_id = ?', id);
    await exec('DELETE FROM closes WHERE event_id = ?', id);
    await exec('DELETE FROM boxes WHERE event_id = ?', id);
    await exec('DELETE FROM products WHERE event_id = ?', id);
    await exec('DELETE FROM categories WHERE event_id = ?', id);
    await exec('DELETE FROM ticket_types WHERE event_id = ?', id);
    await exec('DELETE FROM events WHERE id = ?', id);
  });
  await audit(actor.id, 'delete', 'event', id, {});
  return true;
}