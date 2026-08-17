import { useCallback, useEffect, useMemo, useState } from 'react';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../api/client';
import { EmptyState, PageHeader, Field } from '../../components/common/ui';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { formatMoney, formatDateTime } from '../../../shared/format';
import { PAYMENT_LABELS } from '../../../shared/constants';
import type { Sale, SaleDetail } from '../../../shared/types';

export function SalesScreen() {
  const { activeEvent, events, setActiveEvent } = useData();
  const { push } = useToast();

  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [payment, setPayment] = useState('');
  const [date, setDate] = useState('');
  const [detail, setDetail] = useState<SaleDetail | null>(null);
  const [voiding, setVoiding] = useState<SaleDetail | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams();
    if (activeEvent) q.set('event_id', String(activeEvent.id));
    if (status) q.set('status', status);
    if (payment) q.set('payment_method', payment);
    if (date) q.set('from', date);
    if (date) q.set('to', date);
    q.set('limit', '500');
    try {
      setSales(await api.get<Sale[]>(`/sales?${q}`));
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  }, [activeEvent, status, payment, date]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = async (s: Sale) => {
    try {
      setDetail(await api.get<SaleDetail>(`/sales/${s.id}`));
    } catch (e) {
      push('error', (e as Error).message);
    }
  };

  const doVoid = async () => {
    if (!voiding) return;
    if (!reason.trim()) return push('error', 'Debés indicar el motivo');
    try {
      await api.post(`/sales/${voiding.id}/void`, { reason: reason.trim() });
      push('success', 'Venta anulada');
      setVoiding(null);
      setReason('');
      setDetail(null);
      await load();
    } catch (e) {
      push('error', (e as Error).message);
    }
  };

  const totals = useMemo(() => {
    const active = sales.filter((s) => s.status === 'activa');
    return {
      total: active.reduce((s, x) => s + x.total, 0),
      count: active.length,
    };
  }, [sales]);

  return (
    <div>
      <PageHeader title="Ventas" subtitle={loading ? 'Cargando…' : `${totals.count} ventas · ${formatMoney(totals.total)}`}>
        <select className="select" style={{ width: 'auto' }} value={activeEvent?.id ?? ''} onChange={(e) => setActiveEvent(e.target.value ? Number(e.target.value) : null)}>
          <option value="">Todos los eventos</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
      </PageHeader>

      <div className="toolbar">
        <input className="input" type="date" style={{ width: 'auto' }} value={date} onChange={(e) => setDate(e.target.value)} />
        <select className="select" style={{ width: 'auto' }} value={payment} onChange={(e) => setPayment(e.target.value)}>
          <option value="">Todos los pagos</option>
          {Object.entries(PAYMENT_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select className="select" style={{ width: 'auto' }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Activas y anuladas</option>
          <option value="activa">Solo activas</option>
          <option value="anulada">Solo anuladas</option>
        </select>
      </div>

      {loading ? (
        <div className="spinner" />
      ) : sales.length === 0 ? (
        <EmptyState icon="🧾" title="Sin ventas" subtitle="Aún no hay ventas con estos filtros" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>N°</th>
                <th>Fecha y hora</th>
                <th>Evento</th>
                <th>Caja</th>
                <th>Cajero</th>
                <th>Pago</th>
                <th>Total</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id} style={{ opacity: s.status === 'anulada' ? 0.6 : 1 }}>
                  <td style={{ fontWeight: 800 }}>#{s.operation_number}</td>
                  <td style={{ fontSize: 13 }}>{formatDateTime(s.created_at)}</td>
                  <td>{s.event_name || '—'}</td>
                  <td>{s.box_name || '—'}</td>
                  <td>{s.user_name || '—'}</td>
                  <td>{PAYMENT_LABELS[s.payment_method]}</td>
                  <td style={{ fontWeight: 800 }}>{formatMoney(s.total)}</td>
                  <td>
                    {s.status === 'activa' ? <span className="badge badge-green">Activa</span> : <span className="badge badge-red">Anulada</span>}
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => openDetail(s)}>👁 Ver</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detalle */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `Venta N° ${detail.operation_number}` : ''} size="lg">
        {detail && (
          <>
            <div className="row" style={{ gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
              <span className="badge badge-blue">{formatDateTime(detail.created_at)}</span>
              <span className="badge badge-green">{PAYMENT_LABELS[detail.payment_method]}</span>
              {detail.status === 'activa' ? <span className="badge badge-green">Activa</span> : <span className="badge badge-red">Anulada</span>}
              {detail.box_name && <span className="badge badge-violet">{detail.box_name}</span>}
              {detail.user_name && <span className="badge badge-amber">{detail.user_name}</span>}
            </div>

            <div className="table-wrap mb-16">
              <table className="table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th className="text-right">Precio</th>
                    <th className="text-right">Cant.</th>
                    <th className="text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items.map((i) => (
                    <tr key={`i${i.id}`}>
                      <td>{i.icon} {i.product_name}</td>
                      <td className="text-right">{formatMoney(i.unit_price)}</td>
                      <td className="text-right">{i.quantity}</td>
                      <td className="text-right" style={{ fontWeight: 800 }}>{formatMoney(i.subtotal)}</td>
                    </tr>
                  ))}
                  {detail.tickets.map((t) => (
                    <tr key={`t${t.id}`}>
                      <td>{t.icon} {t.ticket_type_name}</td>
                      <td className="text-right">{formatMoney(t.unit_price)}</td>
                      <td className="text-right">{t.quantity}</td>
                      <td className="text-right" style={{ fontWeight: 800 }}>{formatMoney(t.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {detail.voided && (
              <div className="mb-16" style={{ background: 'var(--danger-soft)', borderRadius: 10, padding: '10px 14px', color: 'var(--danger)', fontSize: 13.5, fontWeight: 600 }}>
                <b>ANULADA:</b> {detail.voided.reason} — por {detail.voided.user_name} ({formatDateTime(detail.voided.created_at)})
              </div>
            )}

            <div className="row-between">
              <div style={{ fontSize: 20, fontWeight: 800 }}>
                TOTAL: {formatMoney(detail.total)}
              </div>
              {detail.status === 'activa' && (
                <button className="btn btn-danger" onClick={() => setVoiding(detail)}>✕ Anular venta</button>
              )}
            </div>
          </>
        )}
      </Modal>

      {/* Anular */}
      <ConfirmDialog
        open={!!voiding}
        onClose={() => setVoiding(null)}
        onConfirm={doVoid}
        title={`Anular venta N° ${voiding?.operation_number}`}
        danger
        confirmText="Anular venta"
        message={`Venta de ${voiding ? formatMoney(voiding.total) : ''} por ${voiding ? PAYMENT_LABELS[voiding.payment_method] : ''}. Se guardará el motivo y no se podrá revertir.`}
      >
        <Field label="Motivo de la anulación *">
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej: cobro duplicado, error del cajero" />
        </Field>
      </ConfirmDialog>
    </div>
  );
}