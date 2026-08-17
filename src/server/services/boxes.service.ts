import { BadRequest } from '../errors';
import { allRows, exec, getRow } from '../db/db';
import { audit } from './audit.service';
import type { Box } from '../../shared/types';

export function listBoxes(eventId: number): Box[] {
  return allRows<Box>('SELECT * FROM boxes WHERE event_id = ? ORDER BY active DESC, name', eventId);
}

export function getBox(id: number): Box | undefined {
  return getRow<Box>('SELECT * FROM boxes WHERE id = ?', id);
}

export function createBox(eventId: number, name: string, userId: number) {
  const n = name.trim();
  if (!n) throw BadRequest('El nombre de la caja es obligatorio');
  const res = exec('INSERT INTO boxes (event_id, name) VALUES (?, ?)', eventId, n);
  audit(userId, 'create', 'box', res.lastInsertRowid, { event_id: eventId, name: n });
  return getBox(res.lastInsertRowid)!;
}

export function updateBox(id: number, input: { name?: string; active?: number }, userId: number) {
  const cur = getBox(id);
  if (!cur) throw BadRequest('Caja no encontrada');
  exec(
    'UPDATE boxes SET name = ?, active = ? WHERE id = ?',
    input.name?.trim() ?? cur.name,
    input.active === undefined ? cur.active : input.active ? 1 : 0,
    id,
  );
  audit(userId, 'update', 'box', id, {});
  return getBox(id)!;
}

export function deleteBox(id: number, userId: number) {
  const used = getRow<{ c: number }>('SELECT COUNT(*) AS c FROM sales WHERE box_id = ?', id);
  if (used!.c > 0) {
    throw BadRequest('No se puede eliminar una caja con ventas. Podés desactivarla.');
  }
  exec('DELETE FROM boxes WHERE id = ?', id);
  audit(userId, 'delete', 'box', id, {});
  return true;
}