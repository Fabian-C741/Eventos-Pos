import { useCallback, useEffect, useState } from 'react';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../api/client';
import { EmptyState, PageHeader, Spinner } from '../../components/common/ui';
import { exportCSV, exportExcel, exportPDF } from '../../utils/export';
import { formatMoney, formatDate } from '../../../shared/format';

interface ReportResult {
  type: string;
  title: string;
  columns: { key: string; label: string }[];
  rows: Record<string, unknown>[];
}

const TYPES = [
  { key: 'diario', label: '📅 Diario' },
  { key: 'cajeros', label: '👥 Por cajero' },
  { key: 'cajas', label: '🗄️ Por caja' },
  { key: 'productos', label: '🧺 Productos' },
  { key: 'entradas', label: '🎟️ Entradas y boletas' },
  { key: 'pagos', label: '💳 Formas de pago' },
  { key: 'cierres', label: '🔒 Cierres de caja' },
];

export function ReportsScreen() {
  const { activeEvent, events, setActiveEvent } = useData();
  const { push } = useToast();

  const [type, setType] = useState('diario');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [report, setReport] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams();
    if (activeEvent) q.set('event_id', String(activeEvent.id));
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    try {
      const r = await api.get<ReportResult>(`/reports/${type}?${q}`);
      setReport(r);
    } catch (e) {
      push('error', (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [type, from, to, activeEvent, push]);

  useEffect(() => {
    load();
  }, [load]);

  const totalKey = report?.columns.find((c) => c.label === 'Total')?.key;

  const grandTotal = report && totalKey ? report.rows.reduce((s, r) => s + Number(r[totalKey] ?? 0), 0) : 0;

  return (
    <div>
      <PageHeader title="Reportes" subtitle="Exportá en PDF, Excel o CSV">
        <div className="row" style={{ gap: 6 }}>
          <button className="btn btn-outline btn-sm" disabled={!report} onClick={() => report && exportCSV(report)}>⬇ CSV</button>
          <button className="btn btn-outline btn-sm" disabled={!report} onClick={() => report && exportExcel(report)}>⬇ Excel</button>
          <button className="btn btn-primary btn-sm" disabled={!report} onClick={() => report && exportPDF(report)}>⬇ PDF</button>
        </div>
      </PageHeader>

      <div className="toolbar">
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          {TYPES.map((t) => (
            <button key={t.key} className={`chip ${type === t.key ? 'active' : ''}`} onClick={() => setType(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="toolbar">
        <select className="select" style={{ width: 'auto' }} value={activeEvent?.id ?? ''} onChange={(e) => setActiveEvent(e.target.value ? Number(e.target.value) : null)}>
          <option value="">Todos los eventos</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
        <input className="input" type="date" style={{ width: 'auto' }} value={from} onChange={(e) => setFrom(e.target.value)} />
        <span className="muted">→</span>
        <input className="input" type="date" style={{ width: 'auto' }} value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      {loading ? (
        <Spinner />
      ) : !report || report.rows.length === 0 ? (
        <EmptyState icon="📄" title="Sin datos" subtitle="No hay información para este reporte y filtros" />
      ) : (
        <>
          {grandTotal > 0 && (
            <div className="card card-pad mb-16" style={{ borderTop: '4px solid var(--primary)' }}>
              <div className="muted" style={{ fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase' }}>Total del reporte</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--primary)' }}>{formatMoney(grandTotal)}</div>
            </div>
          )}
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  {report.columns.map((c) => (
                    <th key={c.key}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r, i) => (
                  <tr key={i}>
                    {report.columns.map((c) => {
                      const raw = r[c.key];
                      const isMoney = /total|efectivo|transferencia|tarjeta|esperado|declarado|diferencia|otro/i.test(c.key) && typeof raw === 'number';
                      const isDate = c.key === 'fecha' || c.key === 'apertura' || c.key === 'cierre';
                      return (
                        <td key={c.key} style={isMoney || c.key === 'total' ? { fontWeight: 700 } : undefined}>
                          {isDate && typeof raw === 'string' && raw.length >= 10
                            ? formatDate(raw.slice(0, 10))
                            : isMoney
                              ? formatMoney(Number(raw))
                              : String(raw ?? '')}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}