import { BadRequest } from '../errors';
import { allRows, exec, getRow } from '../db/db';
import { audit } from './audit.service';
import type { Event } from '../../shared/types';

export function listEvents(includeInactive = true): Event[] {
  const sql = includeInactive
    ? 'SELECT * FROM events ORDER BY active DESC, start_date DESC, name'
    : 'SELECT * FROM events WHERE active = 1 ORDER BY name';
  return allRows<Event>(sql);
}

export function getEvent(id: number): Event | undefined {
  return getRow<Event>('SELECT * FROM events WHERE id = ?', id);
}

export function createEvent(input: { name: string; description?: string; venue?: string; start_date?: string; end_date?: string; active?: number }, userId: number) {
  const name = input.name.trim();
  if (!name) throw BadRequest('El nombre del evento es obligatorio');
  const res = exec(
    'INSERT INTO events (name, description, venue, start_date, end_date, active) VALUES (?, ?, ?, ?, ?, ?)',
    name,
    input.description ?? '',
    input.venue ?? '',
    input.start_date ?? '',
    input.end_date ?? '',
    input.active === 0 ? 0 : 1,
  );
  const id = res.lastInsertRowid;
  audit(userId, 'create', 'event', id, { name });
  return getEvent(id)!;
}

export function updateEvent(id: number, input: Partial<{ name: string; description: string; venue: string; start_date: string; end_date: string; active: number }>, userId: number) {
  const cur = getEvent(id);
  if (!cur) throw BadRequest('Evento no encontrado');
  exec(
    `UPDATE events SET name = ?, description = ?, venue = ?, start_date = ?, end_date = ?, active = ? WHERE id = ?`,
    input.name?.trim() ?? cur.name,
    input.description ?? cur.description,
    input.venue ?? cur.venue,
    input.start_date ?? cur.start_date,
    input.end_date ?? cur.end_date,
    input.active === undefined ? cur.active : input.active ? 1 : 0,
    id,
  );
  audit(userId, 'update', 'event', id, { name: input.name });
  return getEvent(id)!;
}

export function deleteEvent(id: number, userId: number) {
  const sales = getRow<{ c: number }>('SELECT COUNT(*) AS c FROM sales WHERE event_id = ?', id);
  if (sales!.c > 0) {
    throw BadRequest('No se puede eliminar un evento con ventas. Podés desactivarlo.');
  }
  exec('DELETE FROM events WHERE id = ?', id);
  audit(userId, 'delete', 'event', id, {});
  return true;
}