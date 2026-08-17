import { allRows, getRow } from '../db/db';
import type { DashboardData, StatsData, SeriesPoint, SeriesMultiPoint } from '../../shared/types';
import { PAYMENT_METHODS } from '../../shared/constants';

export function dashboard(eventId?: number, from?: string, to?: string): DashboardData {
  const where: string[] = ["s.status = 'activa'"];
  const params: unknown[] = [];
  if (eventId) {
    where.push('s.event_id = ?');
    params.push(eventId);
  }
  if (from) {
    where.push('s.created_at >= ?');
    params.push(from + ' 00:00:00');
  }
  if (to) {
    where.push('s.created_at <= ?');
    params.push(to + ' 23:59:59');
  }
  const whereSql = where.join(' AND ');

  const totals = getRow<{
    total: number;
    efectivo: number;
    transferencia: number;
    tarjeta: number;
    otro: number;
    ventas: number;
  }>(
    `SELECT COALESCE(SUM(s.total), 0) AS total,
       COALESCE(SUM(CASE WHEN s.payment_method = 'efectivo' THEN s.total ELSE 0 END), 0) AS efectivo,
       COALESCE(SUM(CASE WHEN s.payment_method = 'transferencia' THEN s.total ELSE 0 END), 0) AS transferencia,
       COALESCE(SUM(CASE WHEN s.payment_method = 'tarjeta' THEN s.total ELSE 0 END), 0) AS tarjeta,
       COALESCE(SUM(CASE WHEN s.payment_method = 'otro' THEN s.total ELSE 0 END), 0) AS otro,
       COUNT(*) AS ventas
     FROM sales s WHERE ${whereSql}`,
    ...params,
  )!;

  const tickets = getRow<{ entradas: number; boletas: number; rifas: number; bonos: number }>(
    `SELECT
       COALESCE(SUM(CASE WHEN t.kind = 'entrada' THEN st.quantity ELSE 0 END), 0) AS entradas,
       COALESCE(SUM(CASE WHEN t.kind = 'boleta' THEN st.quantity ELSE 0 END), 0) AS boletas,
       COALESCE(SUM(CASE WHEN t.kind = 'rifa' THEN st.quantity ELSE 0 END), 0) AS rifas,
       COALESCE(SUM(CASE WHEN t.kind = 'bono' THEN st.quantity ELSE 0 END), 0) AS bonos
     FROM sale_tickets st
     LEFT JOIN ticket_types t ON t.id = st.ticket_type_id
     LEFT JOIN sales s ON s.id = st.sale_id
     WHERE ${whereSql}`,
    ...params,
  )!;

  const productos = getRow<{ c: number }>(
    `SELECT COALESCE(SUM(si.quantity), 0) AS c
     FROM sale_items si LEFT JOIN sales s ON s.id = si.sale_id WHERE ${whereSql}`,
    ...params,
  )!;

  const anuladas = getRow<{ ventas: number; monto: number }>(
    `SELECT COUNT(*) AS ventas, COALESCE(SUM(total), 0) AS monto
     FROM sales WHERE status = 'anulada' ${eventId ? 'AND event_id = ?' : ''} ${from ? 'AND created_at >= ?' : ''} ${to ? 'AND created_at <= ?' : ''}`,
    ...(eventId ? [eventId] : []),
    ...(from ? [from + ' 00:00:00'] : []),
    ...(to ? [to + ' 23:59:59'] : []),
  )!;

  return {
    total_recaudado: totals.total,
    total_efectivo: totals.efectivo,
    total_transferencia: totals.transferencia,
    total_tarjeta: totals.tarjeta,
    total_otro: totals.otro,
    total_ventas: totals.ventas,
    total_entradas: tickets.entradas,
    total_boletas: tickets.boletas,
    total_productos: productos.c,
    ventas_anuladas: anuladas.ventas,
    monto_anulado: anuladas.monto,
  };
}

export function stats(eventId?: number, from?: string, to?: string): StatsData {
  const where: string[] = ["s.status = 'activa'"];
  const params: unknown[] = [];
  if (eventId) {
    where.push('s.event_id = ?');
    params.push(eventId);
  }
  if (from) {
    where.push('s.created_at >= ?');
    params.push(from + ' 00:00:00');
  }
  if (to) {
    where.push('s.created_at <= ?');
    params.push(to + ' 23:59:59');
  }
  const whereSql = where.join(' AND ');

  const porHoraRows = allRows<{ h: number; payment_method: string; v: number }>(
    `SELECT CAST(strftime('%H', s.created_at) AS INTEGER) AS h, s.payment_method, COALESCE(SUM(s.total), 0) AS v
     FROM sales s WHERE ${whereSql} GROUP BY h, s.payment_method`,
    ...params,
  );
  const porHora: SeriesMultiPoint[] = [];
  for (let h = 0; h < 24; h++) {
    const pt: SeriesMultiPoint = { label: String(h).padStart(2, '0'), efectivo: 0, transferencia: 0, tarjeta: 0, otro: 0 };
    for (const r of porHoraRows) {
      const key = r.payment_method as keyof Pick<SeriesMultiPoint, 'efectivo' | 'transferencia' | 'tarjeta' | 'otro'>;
      pt[key] = Number(r.v);
    }
    if (porHora.some((p) => p.label === pt.label)) continue;
    porHora.push(pt);
  }

  const porDiaRows = allRows<{ d: string; payment_method: string; v: number }>(
    `SELECT substr(s.created_at, 1, 10) AS d, s.payment_method, COALESCE(SUM(s.total), 0) AS v
     FROM sales s WHERE ${whereSql} GROUP BY d, s.payment_method ORDER BY d`,
    ...params,
  );
  const porDiaMap = new Map<string, SeriesMultiPoint>();
  for (const r of porDiaRows) {
    if (!porDiaMap.has(r.d)) {
      porDiaMap.set(r.d, { label: r.d, efectivo: 0, transferencia: 0, tarjeta: 0, otro: 0 });
    }
    const pt = porDiaMap.get(r.d)!;
    const key = r.payment_method as keyof Pick<SeriesMultiPoint, 'efectivo' | 'transferencia' | 'tarjeta' | 'otro'>;
    pt[key] = Number(r.v);
  }
  const porDia = [...porDiaMap.values()].slice(-14);

  const topProductosRows = allRows<{ name: string; v: number }>(
    `SELECT si.product_name AS name, COALESCE(SUM(si.quantity), 0) AS v
     FROM sale_items si LEFT JOIN sales s ON s.id = si.sale_id
     WHERE ${whereSql}
     GROUP BY si.product_name ORDER BY v DESC LIMIT 10`,
    ...params,
  );
  const topProductos: SeriesPoint[] = topProductosRows.map((r) => ({ label: r.name, value: Number(r.v) }));

  const porCategoriaRows = allRows<{ name: string; v: number }>(
    `SELECT COALESCE(c.name, 'Sin categoría') AS name, COALESCE(SUM(si.subtotal), 0) AS v
     FROM sale_items si
     LEFT JOIN products p ON p.id = si.product_id
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN sales s ON s.id = si.sale_id
     WHERE ${whereSql}
     GROUP BY COALESCE(c.name, 'Sin categoría') ORDER BY v DESC LIMIT 12`,
    ...params,
  );
  const porCategoria: SeriesPoint[] = porCategoriaRows.map((r) => ({ label: r.name, value: Number(r.v) }));

  const porCajeroRows = allRows<{ name: string; v: number }>(
    `SELECT COALESCE(u.name, 'Eliminado') AS name, COALESCE(SUM(s.total), 0) AS v
     FROM sales s LEFT JOIN users u ON u.id = s.user_id
     WHERE ${whereSql} GROUP BY u.name ORDER BY v DESC`,
    ...params,
  );
  const porCajero: SeriesPoint[] = porCajeroRows.map((r) => ({ label: r.name || 'Sin nombre', value: Number(r.v) }));

  const porCajaRows = allRows<{ name: string; v: number }>(
    `SELECT COALESCE(b.name, 'Sin caja') AS name, COALESCE(SUM(s.total), 0) AS v
     FROM sales s LEFT JOIN boxes b ON b.id = s.box_id
     WHERE ${whereSql} GROUP BY b.name ORDER BY v DESC`,
    ...params,
  );
  const porCaja: SeriesPoint[] = porCajaRows.map((r) => ({ label: r.name || 'Sin caja', value: Number(r.v) }));

  const porPagoRows = allRows<{ payment_method: string; v: number }>(
    `SELECT s.payment_method, COALESCE(SUM(s.total), 0) AS v
     FROM sales s WHERE ${whereSql} GROUP BY s.payment_method`,
    ...params,
  );
  const labels: Record<string, string> = { efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta', otro: 'Otro' };
  const porPago: SeriesPoint[] = porPagoRows.map((r) => ({
    label: labels[r.payment_method] || r.payment_method,
    value: Number(r.v),
  }));

  const porTipoTicketRows = allRows<{ name: string; v: number }>(
    `SELECT COALESCE(st.ticket_type_name, 'Otro') AS name, COALESCE(SUM(st.quantity), 0) AS v
     FROM sale_tickets st LEFT JOIN sales s ON s.id = st.sale_id
     WHERE ${whereSql}
     GROUP BY st.ticket_type_name ORDER BY v DESC LIMIT 10`,
    ...params,
  );
  const porTipoTicket: SeriesPoint[] = porTipoTicketRows.map((r) => ({ label: r.name, value: Number(r.v) }));

  return { por_hora: porHora, por_dia: porDia, top_productos: topProductos, por_categoria: porCategoria, por_cajero: porCajero, por_caja: porCaja, por_pago: porPago, por_tipo_ticket: porTipoTicket };
}