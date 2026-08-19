import { BadRequest } from '../errors';
import { allRows, exec, getRow, runInTransaction } from '../db/db';
import { audit } from './audit.service';
import { nowLocalIso } from '../../shared/format';
import type { Close, CloseSummary, PaymentMethod } from '../../shared/types';

export async function openClose(eventId: number, boxId: number, userId: number) {
  const existing = await getRow<Close>('SELECT * FROM closes WHERE box_id = ? AND status = ?', boxId, 'abierto');
  if (existing) return existing;
  const now = nowLocalIso();
  const res = await exec(
    'INSERT INTO closes (event_id, box_id, user_id, opened_at, status) VALUES (?, ?, ?, ?, ?)',
    eventId,
    boxId,
    userId,
    now,
    'abierto',
  );
  await audit(userId, 'open', 'close', res.lastInsertRowid, { box_id: boxId });
  return (await getRow<Close>('SELECT * FROM closes WHERE id = ?', res.lastInsertRowid))!;
}

export async function currentOpenClose(boxId: number): Promise<Close | undefined> {
  return getRow<Close>('SELECT * FROM closes WHERE box_id = ? AND status = ?', boxId, 'abierto');
}

export async function computeCloseSummary(closeId: number): Promise<CloseSummary> {
  const close = await getRow<Close>('SELECT * FROM closes WHERE id = ?', closeId);
  if (!close) throw BadRequest('Cierre no encontrado');
  const rows = await allRows<{ payment_method: PaymentMethod; total: number }>(
    `SELECT s.payment_method, COALESCE(SUM(s.total), 0) AS total
     FROM sales s WHERE s.box_id = ? AND s.status = 'activa' AND s.created_at >= ?
     GROUP BY s.payment_method`,
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
  const sales_count = (await getRow<{ c: number }>(
    `SELECT COUNT(*) AS c FROM sales WHERE box_id = ? AND status = 'activa' AND created_at >= ?`,
    close.box_id,
    close.opened_at,
  ))?.c ?? 0;
  return { sales_count, by_payment, total };
}

export async function closeBox(closeId: number, userId: number, declaredByPayment: Record<PaymentMethod, number>) {
  const close = await getRow<Close>('SELECT * FROM closes WHERE id = ?', closeId);
  if (!close) throw BadRequest('Cierre no encontrado');
  if (close.status === 'cerrado') throw BadRequest('La caja ya está cerrada');
  const summary = await computeCloseSummary(closeId);
  const declared_total = Math.round(
    (declaredByPayment.efectivo ?? 0) +
      (declaredByPayment.transferencia ?? 0) +
      (declaredByPayment.tarjeta ?? 0) +
      (declaredByPayment.otro ?? 0),
  );
  const difference = declared_total - summary.total;
  const now = nowLocalIso();
  await runInTransaction(async () => {
    await exec(
      'UPDATE closes SET closed_at = ?, expected_total = ?, declared_total = ?, difference = ?, status = ? WHERE id = ?',
      now,
      summary.total,
      declared_total,
      difference,
      'cerrado',
      closeId,
    );
  });
  await audit(userId, 'close', 'close', closeId, { box_id: close.box_id, expected: summary.total, declared: declared_total, diff: difference });
  return (await getRow<Close>('SELECT * FROM closes WHERE id = ?', closeId))!;
}

export async function listCloses(filters: { event_id?: number; event_ids?: number[]; box_id?: number; status?: string }): Promise<Close[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filters.event_id) {
    where.push('c.event_id = ?');
    params.push(filters.event_id);
  } else if (filters.event_ids && filters.event_ids.length > 0) {
    where.push('c.event_id IN (' + filters.event_ids.map(() => '?').join(', ') + ')');
    params.push(...filters.event_ids);
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

export async function ensureOpenClose(eventId: number, boxId: number, userId: number): Promise<Close> {
  const existing = await currentOpenClose(boxId);
  if (existing) return existing;
  return openClose(eventId, boxId, userId);
}
