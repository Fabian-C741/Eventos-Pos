import { useCallback, useEffect, useMemo, useState } from 'react';
import { useData } from '../../context/DataContext';
import { api } from '../../api/client';
import { formatMoney, formatNumber } from '../../../shared/format';
import { EmptyState, PageHeader, Spinner, MoneyStatBar } from '../../components/common/ui';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import type { DashboardData, StatsData, SeriesPoint, SeriesMultiPoint } from '../../../shared/types';

const PIE_COLORS = ['#16a34a', '#2563eb', '#7c3aed', '#64748b'];

function money(v: number) {
  return '$' + Math.round(v).toLocaleString('es-AR');
}

export function DashboardScreen() {
  const { activeEvent, events, setActiveEvent } = useData();
  const [range, setRange] = useState('hoy');
  const [data, setData] = useState<DashboardData | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  const rangeFilter = useMemo(() => {
    const now = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    if (range === 'hoy') return { from: iso(now), to: iso(now) };
    if (range === 'ayer') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { from: iso(y), to: iso(y) };
    }
    if (range === 'semana') {
      const from = new Date(now);
      from.setDate(from.getDate() - 7);
      return { from: iso(from), to: iso(now) };
    }
    return {};
  }, [range]);

  const load = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams();
    if (activeEvent) q.set('event_id', String(activeEvent.id));
    if (rangeFilter.from) q.set('from', rangeFilter.from);
    if (rangeFilter.to) q.set('to', rangeFilter.to);
    try {
      const [d, s] = await Promise.all([
        api.get<DashboardData>(`/dashboard?${q}`),
        api.get<StatsData>(`/stats?${q}`),
      ]);
      setData(d);
      setStats(s);
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  }, [activeEvent, rangeFilter]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  if (loading || !data) return <Spinner />;

  const top = stats?.top_productos.slice(0, 6) ?? [];
  const maxTop = top.length ? Math.max(...top.map((t) => t.value), 1) : 1;

  const kpis = [
    { label: 'Recaudación total', value: formatMoney(data.total_recaudado), icon: '💰', accent: 'primary' },
    { label: 'Efectivo', value: formatMoney(data.total_efectivo), icon: '💵', accent: 'success' },
    { label: 'Transferencias', value: formatMoney(data.total_transferencia), icon: '📱', accent: 'violet' },
    { label: 'Tarjeta', value: formatMoney(data.total_tarjeta), icon: '💳', accent: 'warn' },
    { label: 'Ventas', value: formatNumber(data.total_ventas), icon: '🧾' },
    { label: 'Entradas', value: formatNumber(data.total_entradas), icon: '🎟️' },
    { label: 'Boletas', value: formatNumber(data.total_boletas), icon: '🎫' },
    { label: 'Productos vendidos', value: formatNumber(data.total_productos), icon: '🧺' },
  ];

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Estadísticas en tiempo real">
        <select className="select" style={{ width: 'auto' }} value={activeEvent?.id ?? ''} onChange={(e) => setActiveEvent(e.target.value ? Number(e.target.value) : null)}>
          <option value="">Todos los eventos</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
        <div className="row" style={{ gap: 6 }}>
          {(['hoy', 'ayer', 'semana', 'todo'] as const).map((r) => (
            <button key={r} className={`chip ${range === r ? 'active' : ''}`} onClick={() => setRange(r)}>
              {r === 'hoy' ? 'Hoy' : r === 'ayer' ? 'Ayer' : r === 'semana' ? '7 días' : 'Todo'}
            </button>
          ))}
        </div>
      </PageHeader>

      <div className="kpi-grid">
        {kpis.map((k) => (
          <div key={k.label} className={`kpi ${k.accent ? 'accent-' + k.accent : ''}`}>
            <div className="kpi-label">
              <span>{k.icon}</span> {k.label}
            </div>
            <div className="kpi-value">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h3>Ventas por hora</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={stats?.por_hora ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={2} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number | string) => money(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="efectivo" name="Efectivo" stackId="a" fill="#16a34a" />
              <Bar dataKey="transferencia" name="Transferencia" stackId="a" fill="#2563eb" />
              <Bar dataKey="tarjeta" name="Tarjeta" stackId="a" fill="#7c3aed" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Recaudación por día</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={stats?.por_dia ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number | string) => money(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="total" name="Total" stroke="#2563eb" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Forma de pago</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={stats?.por_pago ?? []} dataKey="value" nameKey="label" innerRadius={50} outerRadius={90} paddingAngle={3}>
                {(stats?.por_pago ?? []).map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number | string) => money(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Productos más vendidos</h3>
          {top.length === 0 ? (
            <EmptyState icon="🧺" title="Sin ventas" />
          ) : (
            <div style={{ marginTop: 8 }}>
              {top.map((t: SeriesPoint) => (
                <MoneyStatBar key={t.label} label={t.label} value={t.value} max={maxTop} color="#0ea5e9" />
              ))}
            </div>
          )}
        </div>

        <div className="chart-card">
          <h3>Ventas por cajero</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={stats?.por_cajero ?? []} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={90} />
              <Tooltip formatter={(v: number | string) => money(Number(v))} />
              <Bar dataKey="value" name="Total" fill="#8b5cf6" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Ventas por caja</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={stats?.por_caja ?? []} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={90} />
              <Tooltip formatter={(v: number | string) => money(Number(v))} />
              <Bar dataKey="value" name="Total" fill="#0ea5e9" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}