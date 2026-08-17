import { useCallback, useEffect, useState } from 'react';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../api/client';
import { EmptyState, PageHeader, Field } from '../../components/common/ui';
import { Modal } from '../../components/common/Modal';
import { formatMoney, formatDateTime } from '../../../shared/format';
import { PAYMENT_METHODS, PAYMENT_LABELS } from '../../../shared/constants';
import type { Close, CloseSummary } from '../../../shared/types';

export function ClosesScreen() {
  const { activeEvent } = useData();
  const { push } = useToast();

  const [closes, setCloses] = useState<Close[]>([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState<{ close: Close; summary: CloseSummary } | null>(null);
  const [declared, setDeclared] = useState<Record<string, string>>({ efectivo: '', transferencia: '', tarjeta: '', otro: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams();
    if (activeEvent) q.set('event_id', String(activeEvent.id));
    try {
      setCloses(await api.get<Close[]>(`/closes?${q}`));
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  }, [activeEvent]);

  useEffect(() => {
    load();
  }, [load]);

  const openCloseFlow = async (c: Close) => {
    try {
      const summary = await api.get<CloseSummary>(`/closes/${c.id}/summary`);
      setDeclared({ efectivo: String(summary.by_payment.efectivo ?? ''), transferencia: String(summary.by_payment.transferencia ?? ''), tarjeta: String(summary.by_payment.tarjeta ?? ''), otro: String(summary.by_payment.otro ?? '') });
      setClosing({ close: c, summary });
    } catch (e) {
      push('error', (e as Error).message);
    }
  };

  const doClose = async () => {
    if (!closing) return;
    try {
      await api.post(`/closes/${closing.close.id}/close`, {
        declared_by_payment: {
          efectivo: Number(declared.efectivo || 0),
          transferencia: Number(declared.transferencia || 0),
          tarjeta: Number(declared.tarjeta || 0),
          otro: Number(declared.otro || 0),
        },
      });
      push('success', 'Cierre de caja registrado');
      setClosing(null);
      await load();
    } catch (e) {
      push('error', (e as Error).message);
    }
  };

  const diff = closing ? Number(declared.efectivo || 0) + Number(declared.transferencia || 0) + Number(declared.tarjeta || 0) + Number(declared.otro || 0) - closing.summary.total : 0;

  const opens = closes.filter((c) => c.status === 'abierto');
  const closed = closes.filter((c) => c.status === 'cerrado');

  return (
    <div>
      <PageHeader title="Cierres de caja" subtitle="Esperado vs declarado, con diferencia visible" />

      {loading ? (
        <div className="spinner" />
      ) : closes.length === 0 ? (
        <EmptyState icon="🔒" title="Sin cierres" subtitle="Cuando un cajero elige su caja, se abre automáticamente una jornada" />
      ) : (
        <>
          {opens.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <h2 style={{ fontSize: 16, marginBottom: 10 }}>Abiertas</h2>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                {opens.map((c) => (
                  <div className="card card-pad" key={c.id} style={{ borderLeft: '4px solid var(--warn)' }}>
                    <div className="row-between">
                      <div>
                        <div style={{ fontWeight: 800 }}>{c.box_name}</div>
                        <div className="muted" style={{ fontSize: 12.5 }}>Abierta {formatDateTime(c.opened_at)}</div>
                      </div>
                      <span className="badge badge-amber">Abierta</span>
                    </div>
                    <div className="row mt-16">
                      <button className="btn btn-primary" onClick={() => openCloseFlow(c)}>🔒 Cerrar caja</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <h2 style={{ fontSize: 16, marginBottom: 10 }}>Cerradas</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Caja</th>
                  <th>Encargado</th>
                  <th>Apertura</th>
                  <th>Cierre</th>
                  <th className="text-right">Esperado</th>
                  <th className="text-right">Declarado</th>
                  <th className="text-right">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {closed.map((c) => {
                  const d = c.difference ?? 0;
                  return (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 700 }}>{c.box_name}</td>
                      <td>{c.user_name || '—'}</td>
                      <td style={{ fontSize: 12.5 }}>{formatDateTime(c.opened_at)}</td>
                      <td style={{ fontSize: 12.5 }}>{c.closed_at ? formatDateTime(c.closed_at) : '—'}</td>
                      <td className="text-right" style={{ fontWeight: 700 }}>{formatMoney(c.expected_total)}</td>
                      <td className="text-right">{c.declared_total != null ? formatMoney(c.declared_total) : '—'}</td>
                      <td className="text-right">
                        <span className={`badge ${d === 0 ? 'badge-green' : d > 0 ? 'badge-blue' : 'badge-red'}`}>
                          {d === 0 ? 'OK' : d > 0 ? `+${formatMoney(d)}` : formatMoney(d)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Cerrar modal */}
      <Modal open={!!closing} onClose={() => setClosing(null)} title={`Cerrar caja · ${closing?.close.box_name}`} size="lg">
        {closing && (
          <>
            <div className="grid grid-2 mb-16">
              <div className="card" style={{ padding: 14 }}>
                <div className="muted" style={{ fontSize: 12.5, fontWeight: 700 }}>VENTAS REALIZADAS</div>
                <div style={{ fontSize: 24, fontWeight: 800 }}>{closing.summary.sales_count}</div>
              </div>
              <div className="card" style={{ padding: 14, borderTop: '4px solid var(--primary)' }}>
                <div className="muted" style={{ fontSize: 12.5, fontWeight: 700 }}>TOTAL ESPERADO</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--primary)' }}>{formatMoney(closing.summary.total)}</div>
              </div>
            </div>

            <div style={{ fontWeight: 800, marginBottom: 10 }}>Declará lo que hay en la caja (dinero real)</div>
            <div className="grid grid-2">
              {PAYMENT_METHODS.map((m) => (
                <Field key={m.key} label={`${m.icon} ${PAYMENT_LABELS[m.key]} (esperado: ${formatMoney(closing.summary.by_payment[m.key as keyof typeof closing.summary.by_payment] || 0)})`}>
                  <input
                    className="input"
                    inputMode="numeric"
                    value={declared[m.key] ?? ''}
                    onChange={(e) => setDeclared({ ...declared, [m.key]: e.target.value.replace(/[^\d]/g, '') })}
                    style={{ fontSize: 18, fontWeight: 800 }}
                  />
                </Field>
              ))}
            </div>

            <div className="row-between mt-16" style={{ padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 12 }}>
              <span style={{ fontWeight: 800 }}>Diferencia</span>
              <span className={`badge ${diff === 0 ? 'badge-green' : diff > 0 ? 'badge-blue' : 'badge-red'}`} style={{ fontSize: 15 }}>
                {diff === 0 ? '✓ Cuadra' : diff > 0 ? `+${formatMoney(diff)}` : formatMoney(diff)}
              </span>
            </div>

            <div className="row mt-16" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setClosing(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={doClose}>Confirmar cierre</button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}