import { BadRequest } from '../errors';
import { allRows, exec, getRow, nextSeq, runInTransaction } from '../db/db';
import { audit } from './audit.service';
import { logger } from '../logger';
import { allocateTicketNumbers, getTicketType } from './tickets.service';
import { getProduct } from './products.service';
import { getBox } from './boxes.service';
import { getEvent } from './events.service';
import type { PaymentMethod, Sale, SaleDetail, SaleItem, SaleStatus, SaleTicket } from '../../shared/types';

export interface SaleItemInput {
  product_id: number;
  quantity: number;
}

export interface SaleTicketInput {
  ticket_type_id: number;
  quantity: number;
}

export interface CreateSaleInput {
  event_id: number;
  box_id: number | null;
  user_id: number;
  items: SaleItemInput[];
  tickets: SaleTicketInput[];
  payment_method: PaymentMethod;
  device?: string;
}

export interface CreateSaleResult {
  sale: SaleDetail;
  ticketNumbers: Record<number, number[]>;
}

export async function createSale(input: CreateSaleInput): Promise<CreateSaleResult> {
  const event = await getEvent(input.event_id);
  if (!event) throw BadRequest('Evento no encontrado');
  if (input.box_id) {
    const box = await getBox(input.box_id);
    if (!box) throw BadRequest('Caja no encontrada');
  }
  if (!['efectivo', 'transferencia', 'tarjeta', 'otro'].includes(input.payment_method)) {
    throw BadRequest('Forma de pago inválida');
  }
  const items = (await Promise.all(
    (input.items || []).map(async (it) => {
      const p = await getProduct(it.product_id);
      const q = Math.floor(Number(it.quantity));
      if (!p) throw BadRequest('Producto no encontrado');
      if (!p.active) throw BadRequest(`El producto "${p.name}" está desactivado`);
      if (isNaN(q) || q <= 0) throw BadRequest('Cantidad inválida');
      return { product: p, quantity: q };
    }),
  )) as { product: NonNullable<Awaited<ReturnType<typeof getProduct>>>; quantity: number }[];

  const tickets = (await Promise.all(
    (input.tickets || []).map(async (it) => {
      const t = await getTicketType(it.ticket_type_id);
      const q = Math.floor(Number(it.quantity));
      if (!t) throw BadRequest('Tipo de entrada no encontrado');
      if (!t.active) throw BadRequest(`"${t.name}" está desactivado`);
      if (isNaN(q) || q <= 0) throw BadRequest('Cantidad inválida');
      return { type: t, quantity: q };
    }),
  )) as { type: NonNullable<Awaited<ReturnType<typeof getTicketType>>>; quantity: number }[];

  if (items.length === 0 && tickets.length === 0) {
    throw BadRequest('La venta no tiene productos');
  }

  const sale = await runInTransaction<CreateSaleResult>(async () => {
    const opNumber = await nextSeq(`event_op_${input.event_id}`);
    const itemRows = items.map((it) => ({
      product_id: it.product.id,
      name: it.product.name,
      unit_price: it.product.price,
      quantity: it.quantity,
      subtotal: it.product.price * it.quantity,
    }));
    const ticketRows = tickets.map((it) => ({
      ticket_type_id: it.type.id,
      name: it.type.name,
      unit_price: it.type.price,
      quantity: it.quantity,
      subtotal: it.type.price * it.quantity,
    }));
    const total = itemRows.reduce((s, r) => s + r.subtotal, 0) + ticketRows.reduce((s, r) => s + r.subtotal, 0);

    const res = await exec(
      'INSERT INTO sales (event_id, box_id, user_id, operation_number, total, payment_method, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      input.event_id,
      input.box_id,
      input.user_id,
      opNumber,
      total,
      input.payment_method,
      'activa',
    );
    const saleId = Number(res.lastInsertRowid);

    for (const r of itemRows) {
      await exec(
        'INSERT INTO sale_items (sale_id, product_id, product_name, unit_price, quantity, subtotal) VALUES (?, ?, ?, ?, ?, ?)',
        saleId,
        r.product_id,
        r.name,
        r.unit_price,
        r.quantity,
        r.subtotal,
      );
    }

    const ticketNumbers: Record<number, number[]> = {};
    for (const r of ticketRows) {
      await exec(
        'INSERT INTO sale_tickets (sale_id, ticket_type_id, ticket_type_name, unit_price, quantity, subtotal) VALUES (?, ?, ?, ?, ?, ?)',
        saleId,
        r.ticket_type_id,
        r.name,
        r.unit_price,
        r.quantity,
        r.subtotal,
      );
      const allocated = await allocateTicketNumbers(r.ticket_type_id, r.quantity);
      ticketNumbers[r.ticket_type_id] = allocated.numbers;
      for (const num of allocated.numbers) {
        await exec('INSERT INTO tickets (sale_id, ticket_type_id, number) VALUES (?, ?, ?)', saleId, r.ticket_type_id, num);
      }
    }

    const saleRow = await getSaleDetail(saleId);
    return { sale: saleRow, ticketNumbers };
  });

  logger.info('sales', `Venta ${sale.sale.operation_number} registrada: $${sale.sale.total} (${sale.sale.payment_method})`, undefined, input.user_id, input.device);
  await audit(input.user_id, 'create', 'sale', sale.sale.id, { op: sale.sale.operation_number, total: sale.sale.total });
  return sale;
}

export async function listSales(filters: {
  event_id?: number;
  box_id?: number;
  user_id?: number;
  payment_method?: string;
  status?: SaleStatus;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}): Promise<Sale[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filters.event_id) {
    where.push('s.event_id = ?');
    params.push(filters.event_id);
  }
  if (filters.box_id) {
    where.push('s.box_id = ?');
    params.push(filters.box_id);
  }
  if (filters.user_id) {
    where.push('s.user_id = ?');
    params.push(filters.user_id);
  }
  if (filters.payment_method) {
    where.push('s.payment_method = ?');
    params.push(filters.payment_method);
  }
  if (filters.status) {
    where.push('s.status = ?');
    params.push(filters.status);
  }
  if (filters.from) {
    where.push('s.created_at >= ?');
    params.push(filters.from + ' 00:00:00');
  }
  if (filters.to) {
    where.push('s.created_at <= ?');
    params.push(filters.to + ' 23:59:59');
  }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const limit = Math.min(filters.limit ?? 500, 2000);
  const sql = `SELECT s.id, s.event_id, e.name AS event_name, s.box_id, b.name AS box_name,
      s.user_id, u.name AS user_name, s.operation_number, s.total, s.payment_method, s.status, s.created_at
    FROM sales s
    LEFT JOIN events e ON e.id = s.event_id
    LEFT JOIN boxes b ON b.id = s.box_id
    LEFT JOIN users u ON u.id = s.user_id
    ${whereSql}
    ORDER BY s.id DESC
    LIMIT ? OFFSET ?`;
  params.push(limit, filters.offset ?? 0);
  return allRows<Sale>(sql, ...params);
}

export async function getSaleDetail(id: number): Promise<SaleDetail> {
  const sale = await getRow<Sale>(
    `SELECT s.id, s.event_id, e.name AS event_name, s.box_id, b.name AS box_name,
       s.user_id, u.name AS user_name, s.operation_number, s.total, s.payment_method, s.status, s.created_at
     FROM sales s
     LEFT JOIN events e ON e.id = s.event_id
     LEFT JOIN boxes b ON b.id = s.box_id
     LEFT JOIN users u ON u.id = s.user_id
     WHERE s.id = ?`,
    id,
  );
  if (!sale) throw BadRequest('Venta no encontrada');
  const items = await allRows<SaleItem>(
    `SELECT si.id, si.product_id, si.product_name, si.unit_price, si.quantity, si.subtotal,
       p.icon, p.color
     FROM sale_items si LEFT JOIN products p ON p.id = si.product_id
     WHERE si.sale_id = ? ORDER BY si.id`,
    id,
  );
  const tickets = await allRows<SaleTicket>(
    `SELECT st.id, st.ticket_type_id, st.ticket_type_name, st.unit_price, st.quantity, st.subtotal,
       t.icon, t.color
     FROM sale_tickets st LEFT JOIN ticket_types t ON t.id = st.ticket_type_id
     WHERE st.sale_id = ? ORDER BY st.id`,
    id,
  );
  const v = await getRow<{ reason: string; user_name?: string; created_at: string }>(
    `SELECT v.reason, u.name AS user_name, v.created_at
     FROM voids v LEFT JOIN users u ON u.id = v.user_id WHERE v.sale_id = ?`,
    id,
  );
  return { ...sale, items, tickets, voided: v ?? null };
}

export async function voidSale(saleId: number, userId: number, reason: string, device?: string) {
  const sale = await getRow<Sale>('SELECT * FROM sales WHERE id = ?', saleId);
  if (!sale) throw BadRequest('Venta no encontrada');
  if (sale.status === 'anulada') throw BadRequest('La venta ya está anulada');
  const r = reason.trim();
  if (!r) throw BadRequest('Debés indicar el motivo de la anulación');
  await runInTransaction(async () => {
    await exec('UPDATE sales SET status = ? WHERE id = ?', 'anulada', saleId);
    await exec('INSERT INTO voids (sale_id, user_id, reason) VALUES (?, ?, ?)', saleId, userId, r);
  });
  logger.warn('sales', `Venta ${sale.operation_number} anulada: ${r}`, undefined, userId, device);
  await audit(userId, 'void', 'sale', saleId, { op: sale.operation_number, reason: r });
  return getSaleDetail(saleId);
}

export async function getOperationNumber(eventId: number): Promise<number> {
  return nextSeq(`event_op_${eventId}`);
}

export async function lastSalesForBox(boxId: number, limit = 8): Promise<Sale[]> {
  return allRows<Sale>(
    `SELECT s.id, s.event_id, s.box_id, s.user_id, s.operation_number, s.total, s.payment_method, s.status, s.created_at,
       u.name AS user_name
     FROM sales s LEFT JOIN users u ON u.id = s.user_id
     WHERE s.box_id = ? AND s.status = 'activa'
     ORDER BY s.id DESC LIMIT ?`,
    boxId,
    limit,
  );
}
