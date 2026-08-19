import { BadRequest } from '../errors';
import { allRows, exec, getRow, runInTransaction } from '../db/db';
import { audit } from './audit.service';
import type { Event } from '../../shared/types';

export async function listEvents(includeInactive = true): Promise<Event[]> {
  const sql = includeInactive
    ? 'SELECT * FROM events ORDER BY active DESC, start_date DESC, name'
    : 'SELECT * FROM events WHERE active = 1 ORDER BY name';
  return allRows<Event>(sql);
}

export async function getEvent(id: number): Promise<Event | undefined> {
  return getRow<Event>('SELECT * FROM events WHERE id = ?', id);
}

export async function createEvent(input: { name: string; description?: string; venue?: string; start_date?: string; end_date?: string; active?: number }, userId: number) {
  const name = input.name.trim();
  if (!name) throw BadRequest('El nombre del evento es obligatorio');
  const res = await exec(
    'INSERT INTO events (name, description, venue, start_date, end_date, active) VALUES (?, ?, ?, ?, ?, ?)',
    name,
    input.description ?? '',
    input.venue ?? '',
    input.start_date ?? '',
    input.end_date ?? '',
    input.active === 0 ? 0 : 1,
  );
  const id = res.lastInsertRowid;
  await audit(userId, 'create', 'event', id, { name });
  return getEvent(id)!;
}

export async function updateEvent(id: number, input: Partial<{ name: string; description: string; venue: string; start_date: string; end_date: string; active: number }>, userId: number) {
  const cur = await getEvent(id);
  if (!cur) throw BadRequest('Evento no encontrado');
  await exec(
    `UPDATE events SET name = ?, description = ?, venue = ?, start_date = ?, end_date = ?, active = ? WHERE id = ?`,
    input.name?.trim() ?? cur.name,
    input.description ?? cur.description,
    input.venue ?? cur.venue,
    input.start_date ?? cur.start_date,
    input.end_date ?? cur.end_date,
    input.active === undefined ? cur.active : input.active ? 1 : 0,
    id,
  );
  await audit(userId, 'update', 'event', id, { name: input.name });
  return getEvent(id)!;
}

export async function deleteEvent(id: number, userId: number) {
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
  await audit(userId, 'delete', 'event', id, {});
  return true;
}
