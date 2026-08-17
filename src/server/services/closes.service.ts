import { BadRequest } from '../errors';
import { allRows, exec, getRow, getDb, runInTransaction } from '../db/db';
import { audit } from './audit.service';
import type { Close, CloseSummary, PaymentMethod } from '../../shared/types';

export function openClose(eventId: number, boxId: number, userId: number) {
  const existing = getRow<Close>('SELECT * FROM closes WHERE box_id = ? AND status = ?', boxId, 'abierto');
  if (existing) return existing;
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const res = exec(
    'INSERT INTO closes (event_id, box_id, user_id, opened_at, status) VALUES (?, ?, ?, ?, ?)',
    eventId,
    boxId,
    userId,
    now,
    'abierto',
  );
  audit(userId, 'open', 'close', res.lastInsertRowid, { box_id: boxId });
  return getRow<Close>('SELECT * FROM closes WHERE id = ?', res.lastInsertRowid)!;
}

export function currentOpenClose(boxId: number): Close | undefined {
  return getRow<Close>('SELECT * FROM closes WHERE box_id = ? AND status = ?', boxId, 'abierto');
}

export function computeCloseSummary(closeId: number): CloseSummary {
  const close = getRow<Close>('SELECT * FROM closes WHERE id = ?', closeId);
  if (!close) throw BadRequest('Cierre no encontrado');
  const rows = allRows<{ payment_method: PaymentMethod; total: number }>(
    `SELECT s.payment_method, COALESCE(SUM(s.total), 0) AS total
     FROM sales s WHERE s.box_id = ? AND s.status = 'activa' AND s.created_at >= ?`,
    close.box_id,
    close.opened_at,
  );
  const by_payment = {
    efectivo: 0,
    transferencia: 0,
    tarjeta: 0,
    otro: 0,
  } as Record<PaymentMethod, number>;
  for (const r of rows) by_payment[r.payment_method] = Number(r.total);
  const total = Object.values(by_payment).reduce((s, v) => s + v, 0);
  const sales_count = getRow<{ c: number }>(
    `SELECT COUNT(*) AS c FROM sales WHERE box_id = ? AND status = 'activa' AND created_at >= ?`,
    close.box_id,
    close.opened_at,
  )!.c;
  return { sales_count, by_payment, total };
}

export function closeBox(closeId: number, userId: number, declaredByPayment: Record<PaymentMethod, number>) {
  const close = getRow<Close>('SELECT * FROM closes WHERE id = ?', closeId);
  if (!close) throw BadRequest('Cierre no encontrado');
  if (close.status === 'cerrado') throw BadRequest('La caja ya está cerrada');
  const summary = computeCloseSummary(closeId);
  const declared_total = Math.round(
    (declaredByPayment.efectivo ?? 0) +
      (declaredByPayment.transferencia ?? 0) +
      (declaredByPayment.tarjeta ?? 0) +
      (declaredByPayment.otro ?? 0),
  );
  const difference = declared_total - summary.total;
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  runInTransaction(() => {
    exec(
      'UPDATE closes SET closed_at = ?, expected_total = ?, declared_total = ?, difference = ?, status = ? WHERE id = ?',
      now,
      summary.total,
      declared_total,
      difference,
      'cerrado',
      closeId,
    );
  });
  audit(userId, 'close', 'close', closeId, { box_id: close.box_id, expected: summary.total, declared: declared_total, diff: difference });
  return getRow<Close>('SELECT * FROM closes WHERE id = ?', closeId)!;
}

export function listCloses(filters: { event_id?: number; box_id?: number; status?: string }): Close[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filters.event_id) {
    where.push('c.event_id = ?');
    params.push(filters.event_id);
  }
  if (filters.box_id) {
    where.push('c.box_id = ?');
    params.push(filters.box_id);
  }
  if (filters.status) {
    where.push('c.status = ?');
    params.push(filters.status);
  }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  return allRows<Close>(
    `SELECT c.id, c.event_id, c.box_id, b.name AS box_name, c.user_id, u.name AS user_name,
       c.opened_at, c.closed_at, c.expected_total, c.declared_total, c.difference, c.status
     FROM closes c
     LEFT JOIN boxes b ON b.id = c.box_id
     LEFT JOIN users u ON u.id = c.user_id
     ${whereSql}
     ORDER BY c.id DESC`,
    ...params,
  );
}

export function ensureOpenClose(eventId: number, boxId: number, userId: number): Close {
  const existing = currentOpenClose(boxId);
  if (existing) return existing;
  return openClose(eventId, boxId, userId);
}