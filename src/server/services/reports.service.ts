import { BadRequest } from '../errors';
import { allRows } from '../db/db';
import type { PaymentMethod } from '../../shared/types';

export interface ReportResult {
  type: string;
  title: string;
  columns: { key: string; label: string }[];
  rows: Record<string, unknown>[];
}

interface Filters {
  event_id?: number;
  box_id?: number;
  user_id?: number;
  from?: string;
  to?: string;
}

function buildWhere(f: Filters, activeOnly = true) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (activeOnly) {
    where.push("s.status = 'activa'");
  }
  if (f.event_id) {
    where.push('s.event_id = ?');
    params.push(f.event_id);
  }
  if (f.box_id) {
    where.push('s.box_id = ?');
    params.push(f.box_id);
  }
  if (f.user_id) {
    where.push('s.user_id = ?');
    params.push(f.user_id);
  }
  if (f.from) {
    where.push('s.created_at >= ?');
    params.push(f.from + ' 00:00:00');
  }
  if (f.to) {
    where.push('s.created_at <= ?');
    params.push(f.to + ' 23:59:59');
  }
  return { where, params };
}

const P_LABEL: Record<PaymentMethod, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
  otro: 'Otro',
};

export async function reporteDiario(f: Filters): Promise<ReportResult> {
  const { where, params } = buildWhere(f);
  const rows = await allRows<Record<string, unknown>>(
    `SELECT substr(s.created_at, 1, 10) AS fecha,
       COALESCE(SUM(CASE WHEN s.payment_method = 'efectivo' THEN s.total ELSE 0 END), 0) AS efectivo,
       COALESCE(SUM(CASE WHEN s.payment_method = 'transferencia' THEN s.total ELSE 0 END), 0) AS transferencia,
       COALESCE(SUM(CASE WHEN s.payment_method = 'tarjeta' THEN s.total ELSE 0 END), 0) AS tarjeta,
       COALESCE(SUM(CASE WHEN s.payment_method = 'otro' THEN s.total ELSE 0 END), 0) AS otro,
       COALESCE(SUM(s.total), 0) AS total,
       COUNT(*) AS ventas
     FROM sales s WHERE ${where.join(' AND ')}
     GROUP BY substr(s.created_at, 1, 10) ORDER BY fecha`,
    ...params,
  );
  return {
    type: 'diario',
    title: 'Reporte diario',
    columns: [
      { key: 'fecha', label: 'Fecha' },
      { key: 'ventas', label: 'Ventas' },
      { key: 'efectivo', label: 'Efectivo' },
      { key: 'transferencia', label: 'Transferencia' },
      { key: 'tarjeta', label: 'Tarjeta' },
      { key: 'otro', label: 'Otro' },
      { key: 'total', label: 'Total' },
    ],
    rows,
  };
}

export async function reporteCajeros(f: Filters): Promise<ReportResult> {
  const { where, params } = buildWhere(f);
  const rows = await allRows<Record<string, unknown>>(
    `SELECT COALESCE(u.name, 'Eliminado') AS cajero, u.role AS rol,
       COUNT(*) AS ventas,
       COALESCE(SUM(CASE WHEN s.payment_method = 'efectivo' THEN s.total ELSE 0 END), 0) AS efectivo,
       COALESCE(SUM(CASE WHEN s.payment_method = 'transferencia' THEN s.total ELSE 0 END), 0) AS transferencia,
       COALESCE(SUM(CASE WHEN s.payment_method = 'tarjeta' THEN s.total ELSE 0 END), 0) AS tarjeta,
       COALESCE(SUM(s.total), 0) AS total
     FROM sales s LEFT JOIN users u ON u.id = s.user_id
     WHERE ${where.join(' AND ')}
     GROUP BY u.name, u.role ORDER BY total DESC`,
    ...params,
  );
  return {
    type: 'cajeros',
    title: 'Reporte por cajero',
    columns: [
      { key: 'cajero', label: 'Cajero' },
      { key: 'rol', label: 'Rol' },
      { key: 'ventas', label: 'Ventas' },
      { key: 'efectivo', label: 'Efectivo' },
      { key: 'transferencia', label: 'Transferencia' },
      { key: 'tarjeta', label: 'Tarjeta' },
      { key: 'total', label: 'Total' },
    ],
    rows,
  };
}

export async function reporteCajas(f: Filters): Promise<ReportResult> {
  const { where, params } = buildWhere(f);
  const rows = await allRows<Record<string, unknown>>(
    `SELECT COALESCE(b.name, 'Sin caja') AS caja,
       COUNT(*) AS ventas,
       COALESCE(SUM(s.total), 0) AS total,
       COALESCE(SUM(CASE WHEN s.payment_method = 'efectivo' THEN s.total ELSE 0 END), 0) AS efectivo,
       COALESCE(SUM(CASE WHEN s.payment_method = 'transferencia' THEN s.total ELSE 0 END), 0) AS transferencia
     FROM sales s LEFT JOIN boxes b ON b.id = s.box_id
     WHERE ${where.join(' AND ')}
     GROUP BY b.name ORDER BY total DESC`,
    ...params,
  );
  return {
    type: 'cajas',
    title: 'Reporte por caja',
    columns: [
      { key: 'caja', label: 'Caja' },
      { key: 'ventas', label: 'Ventas' },
      { key: 'efectivo', label: 'Efectivo' },
      { key: 'transferencia', label: 'Transferencia' },
      { key: 'total', label: 'Total' },
    ],
    rows,
  };
}

export async function reporteProductos(f: Filters): Promise<ReportResult> {
  const { where, params } = buildWhere(f);
  const rows = await allRows<Record<string, unknown>>(
    `SELECT si.product_name AS producto,
       COALESCE(SUM(si.quantity), 0) AS cantidad,
       COALESCE(SUM(si.subtotal), 0) AS total
     FROM sale_items si LEFT JOIN sales s ON s.id = si.sale_id
     WHERE ${where.join(' AND ')}
     GROUP BY si.product_name ORDER BY total DESC`,
    ...params,
  );
  return {
    type: 'productos',
    title: 'Reporte de productos',
    columns: [
      { key: 'producto', label: 'Producto' },
      { key: 'cantidad', label: 'Cantidad' },
      { key: 'total', label: 'Total' },
    ],
    rows,
  };
}

export async function reporteEntradas(f: Filters): Promise<ReportResult> {
  const { where, params } = buildWhere(f);
  const rows = await allRows<Record<string, unknown>>(
    `SELECT st.ticket_type_name AS tipo, t.kind AS clase,
       COALESCE(SUM(st.quantity), 0) AS cantidad,
       COALESCE(SUM(st.subtotal), 0) AS total
     FROM sale_tickets st
     LEFT JOIN ticket_types t ON t.id = st.ticket_type_id
     LEFT JOIN sales s ON s.id = st.sale_id
     WHERE ${where.join(' AND ')}
     GROUP BY st.ticket_type_name, t.kind ORDER BY total DESC`,
    ...params,
  );
  return {
    type: 'entradas',
    title: 'Reporte de entradas y boletas',
    columns: [
      { key: 'tipo', label: 'Tipo' },
      { key: 'clase', label: 'Clase' },
      { key: 'cantidad', label: 'Cantidad' },
      { key: 'total', label: 'Total' },
    ],
    rows,
  };
}

export async function reportePagos(f: Filters): Promise<ReportResult> {
  const { where, params } = buildWhere(f);
  const rows = await allRows<Record<string, unknown>>(
    `SELECT s.payment_method AS pago,
       COUNT(*) AS ventas,
       COALESCE(SUM(s.total), 0) AS total
     FROM sales s WHERE ${where.join(' AND ')}
     GROUP BY s.payment_method ORDER BY total DESC`,
    ...params,
  );
  return {
    type: 'pagos',
    title: 'Reporte por forma de pago',
    columns: [
      { key: 'pago', label: 'Forma de pago' },
      { key: 'ventas', label: 'Ventas' },
      { key: 'total', label: 'Total' },
    ],
    rows: rows.map((r) => ({ ...r, pago: P_LABEL[(r.pago as PaymentMethod)] || r.pago })),
  };
}

export async function reporteCierres(f: Filters): Promise<ReportResult> {
  const { where, params } = buildWhere(f, false);
  const extra = f.event_id ? 'AND c.event_id = ?' : '';
  const rows = await allRows<Record<string, unknown>>(
    `SELECT c.id, b.name AS caja, u.name AS cajero,
       c.opened_at AS apertura, c.closed_at AS cierre,
       c.expected_total AS esperado, c.declared_total AS declarado, c.difference AS diferencia,
       c.status AS estado
     FROM closes c
     LEFT JOIN boxes b ON b.id = c.box_id
     LEFT JOIN users u ON u.id = c.user_id
     WHERE 1=1 ${extra} ${where.length ? 'AND ' + where.join(' AND ') : ''}
     ORDER BY c.id DESC`,
    ...(f.event_id ? [f.event_id] : []),
    ...params,
  );
  return {
    type: 'cierres',
    title: 'Reporte de cierres de caja',
    columns: [
      { key: 'id', label: 'N°' },
      { key: 'caja', label: 'Caja' },
      { key: 'cajero', label: 'Encargado' },
      { key: 'apertura', label: 'Apertura' },
      { key: 'cierre', label: 'Cierre' },
      { key: 'esperado', label: 'Esperado' },
      { key: 'declarado', label: 'Declarado' },
      { key: 'diferencia', label: 'Diferencia' },
      { key: 'estado', label: 'Estado' },
    ],
    rows,
  };
}

export async function getReport(type: string, f: Filters): Promise<ReportResult> {
  switch (type) {
    case 'diario':
      return reporteDiario(f);
    case 'cajeros':
      return reporteCajeros(f);
    case 'cajas':
      return reporteCajas(f);
    case 'productos':
      return reporteProductos(f);
    case 'entradas':
      return reporteEntradas(f);
    case 'pagos':
      return reportePagos(f);
    case 'cierres':
      return reporteCierres(f);
    default:
      throw BadRequest('Reporte no válido');
  }
}
