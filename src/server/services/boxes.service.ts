import { BadRequest } from '../errors';
import { allRows, exec, getRow } from '../db/db';
import { audit } from './audit.service';
import type { Box } from '../../shared/types';

export async function listBoxes(eventId: number): Promise<Box[]> {
  return allRows<Box>('SELECT * FROM boxes WHERE event_id = ? ORDER BY active DESC, name', eventId);
}

export async function getBox(id: number): Promise<Box | undefined> {
  return getRow<Box>('SELECT * FROM boxes WHERE id = ?', id);
}

export async function createBox(
  eventId: number,
  input: { name: string; pos_categories?: string | null; pos_tickets?: number },
  userId: number,
) {
  const n = input.name.trim();
  if (!n) throw BadRequest('El nombre de la caja es obligatorio');
  const res = await exec(
    'INSERT INTO boxes (event_id, name, pos_categories, pos_tickets) VALUES (?, ?, ?, ?)',
    eventId,
    n,
    input.pos_categories ?? null,
    input.pos_tickets === undefined ? 1 : input.pos_tickets ? 1 : 0,
  );
  await audit(userId, 'create', 'box', res.lastInsertRowid, { event_id: eventId, name: n });
  return getBox(res.lastInsertRowid)!;
}

export async function updateBox(
  id: number,
  input: { name?: string; active?: number; pos_categories?: string | null; pos_tickets?: number },
  userId: number,
) {
  const cur = await getBox(id);
  if (!cur) throw BadRequest('Caja no encontrada');
  await exec(
    'UPDATE boxes SET name = ?, active = ?, pos_categories = ?, pos_tickets = ? WHERE id = ?',
    input.name?.trim() ?? cur.name,
    input.active === undefined ? cur.active : input.active ? 1 : 0,
    input.pos_categories === undefined ? cur.pos_categories ?? null : input.pos_categories,
    input.pos_tickets === undefined ? cur.pos_tickets ?? 1 : input.pos_tickets ? 1 : 0,
    id,
  );
  await audit(userId, 'update', 'box', id, {});
  return getBox(id)!;
}

export async function deleteBox(id: number, userId: number) {
  const used = await getRow<{ c: number }>('SELECT COUNT(*) AS c FROM sales WHERE box_id = ?', id);
  if ((used?.c ?? 0) > 0) {
    throw BadRequest('No se puede eliminar una caja con ventas. Podés desactivarla.');
  }
  await exec('DELETE FROM boxes WHERE id = ?', id);
  await audit(userId, 'delete', 'box', id, {});
  return true;
}
