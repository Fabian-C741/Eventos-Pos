import { BadRequest } from '../errors';
import { allRows, exec, getRow } from '../db/db';
import { audit } from './audit.service';
import type { TicketType, TicketKind } from '../../shared/types';

export async function listTicketTypes(eventId: number): Promise<TicketType[]> {
  return allRows<TicketType>(
    'SELECT * FROM ticket_types WHERE event_id = ? ORDER BY active DESC, sort_order, name',
    eventId,
  );
}

export async function getTicketType(id: number): Promise<TicketType | undefined> {
  return getRow<TicketType>('SELECT * FROM ticket_types WHERE id = ?', id);
}

export async function createTicketType(eventId: number, input: { name: string; price: number; kind: TicketKind; start_number?: number | null; digits?: number; icon?: string; color?: string }, userId: number) {
  const name = input.name.trim();
  if (!name) throw BadRequest('El nombre es obligatorio');
  const price = Math.round(Number(input.price));
  if (isNaN(price) || price < 0) throw BadRequest('El precio debe ser un número válido');
  const digits = Math.max(1, Math.min(10, Math.round(input.digits ?? 4)));
  const res = await exec(
    'INSERT INTO ticket_types (event_id, name, price, kind, start_number, last_number, digits, icon, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    eventId,
    name,
    price,
    input.kind ?? 'entrada',
    input.start_number ?? null,
    input.start_number ? (input.start_number > 0 ? input.start_number - 1 : null) : null,
    digits,
    input.icon || '🎟️',
    input.color || '#8b5cf6',
  );
  const id = res.lastInsertRowid;
  await audit(userId, 'create', 'ticket_type', id, { event_id: eventId, name, price, kind: input.kind });
  return getTicketType(id)!;
}

export async function updateTicketType(id: number, input: Partial<{ name: string; price: number; kind: TicketKind; start_number: number | null; digits: number; icon: string; color: string; active: number }>, userId: number) {
  const cur = await getTicketType(id);
  if (!cur) throw BadRequest('Tipo no encontrado');
  const price = input.price !== undefined ? Math.round(Number(input.price)) : cur.price;
  if (isNaN(price) || price < 0) throw BadRequest('El precio debe ser un número válido');
  const sold = await getRow<{ c: number }>('SELECT COUNT(*) AS c FROM tickets WHERE ticket_type_id = ?', id);
  const start = input.start_number !== undefined ? input.start_number : cur.start_number;
  let last = cur.last_number;
  if (input.start_number !== undefined && (sold?.c ?? 0) === 0) {
    last = start && start > 0 ? start - 1 : null;
  }
  await exec(
    `UPDATE ticket_types SET name = ?, price = ?, kind = ?, start_number = ?, last_number = ?, digits = ?, icon = ?, color = ?, active = ? WHERE id = ?`,
    input.name?.trim() ?? cur.name,
    price,
    input.kind ?? cur.kind,
    start,
    last,
    input.digits ?? cur.digits,
    input.icon ?? cur.icon,
    input.color ?? cur.color,
    input.active === undefined ? cur.active : input.active ? 1 : 0,
    id,
  );
  await audit(userId, 'update', 'ticket_type', id, { name: input.name, price });
  return getTicketType(id)!;
}

export async function deleteTicketType(id: number, userId: number) {
  const sold = await getRow<{ c: number }>('SELECT COUNT(*) AS c FROM tickets WHERE ticket_type_id = ?', id);
  if ((sold?.c ?? 0) > 0) {
    throw BadRequest('No se puede eliminar un tipo de entrada ya vendido. Podés desactivarlo.');
  }
  await exec('DELETE FROM ticket_types WHERE id = ?', id);
  await audit(userId, 'delete', 'ticket_type', id, {});
  return true;
}

export async function allocateTicketNumbers(ticketTypeId: number, quantity: number): Promise<{ type: TicketType; numbers: number[] }> {
  const type = await getTicketType(ticketTypeId);
  if (!type) throw BadRequest('Tipo de entrada no encontrado');
  const start = (type.last_number ?? 0) + 1;
  const numbers: number[] = [];
  for (let i = 0; i < quantity; i++) {
    numbers.push(start + i);
  }
  await exec('UPDATE ticket_types SET last_number = ? WHERE id = ?', start + quantity - 1, ticketTypeId);
  return { type, numbers };
}

export async function lastTicketNumbers(eventId: number) {
  return allRows<{ id: number; name: string; last_number: number | null; digits: number }>(
    'SELECT id, name, last_number, digits FROM ticket_types WHERE event_id = ? AND active = 1 ORDER BY name',
    eventId,
  );
}
