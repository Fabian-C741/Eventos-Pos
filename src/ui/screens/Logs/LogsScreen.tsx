import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import { EmptyState, PageHeader, Spinner } from '../../components/common/ui';
import { formatDateTime } from '../../../shared/format';
import type { LogEntry, AuditEntry } from '../../../shared/types';

export function LogsScreen() {
  const [tab, setTab] = useState<'logs' | 'audit'>('logs');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [level, setLevel] = useState('');
  const [module, setModule] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams();
    if (level) q.set('level', level);
    if (module) q.set('module', module);
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    try {
      if (tab === 'logs') {
        setLogs(await api.get<LogEntry[]>(`/logs?${q}`));
      } else {
        setAudit(await api.get<AuditEntry[]>(`/audit?${q}`));
      }
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  }, [tab, level, module, from, to]);

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div>
      <PageHeader title="Logs y auditoría" subtitle="Solo el superadministrador puede ver estos registros (se actualizan en tiempo real)">
        {tab === 'logs' && (
          <button
            className="btn btn-ghost"
            style={{ color: 'var(--danger)' }}
            onClick={async () => {
              if (!confirm('¿Eliminar todos los logs de errores?')) return;
              try {
                await api.del('/logs');
                setLogs([]);
              } catch {
                /* noop */
              }
            }}
          >
            🗑 Limpiar logs
          </button>
        )}
      </PageHeader>

      <div className="toolbar">
        <div className="row" style={{ gap: 6 }}>
          <button className={`chip ${tab === 'logs' ? 'active' : ''}`} onClick={() => setTab('logs')}>🛠️ Logs de errores</button>
          <button className={`chip ${tab === 'audit' ? 'active' : ''}`} onClick={() => setTab('audit')}>📋 Auditoría</button>
        </div>
      </div>

      {tab === 'logs' && (
        <div className="toolbar">
          <select className="select" style={{ width: 'auto' }} value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="">Todos los niveles</option>
            <option value="error">error</option>
            <option value="warn">warn</option>
            <option value="info">info</option>
            <option value="fatal">fatal</option>
          </select>
          <input className="input" style={{ width: 160 }} placeholder="Módulo…" value={module} onChange={(e) => setModule(e.target.value)} />
          <input className="input" type="date" style={{ width: 'auto' }} value={from} onChange={(e) => setFrom(e.target.value)} />
          <input className="input" type="date" style={{ width: 'auto' }} value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : tab === 'logs' ? (
        logs.length === 0 ? (
          <EmptyState icon="✅" title="Sin registros con estos filtros" />
        ) : (
          <div className="table-wrap">
            <div>
              {logs.map((l) => (
                <div className="log-row" key={l.id}>
                  <span className="muted" style={{ fontSize: 11.5 }}>{formatDateTime(l.created_at)}</span>
                  <span className={`log-level log-${l.level}`}>{l.level.toUpperCase()}</span>
                  <div>
                    <div style={{ fontWeight: 700 }}>
                      <span className="muted" style={{ fontWeight: 600 }}>[{l.module}]</span> {l.message}
                    </div>
                    {l.details && (
                      <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 3, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{l.details}</div>
                    )}
                    {l.user_id && <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 2 }}>usuario #{l.user_id}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      ) : audit.length === 0 ? (
        <EmptyState icon="📋" title="Sin actividad registrada" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Usuario</th>
                <th>Acción</th>
                <th>Entidad</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((a) => (
                <tr key={a.id}>
                  <td style={{ fontSize: 12.5 }}>{formatDateTime(a.created_at)}</td>
                  <td>{(a as unknown as { user_name?: string }).user_name || `#${a.user_id ?? '—'}`}</td>
                  <td><span className="badge badge-blue">{a.action}</span></td>
                  <td className="muted">{a.entity} {a.entity_id ? `#${a.entity_id}` : ''}</td>
                  <td style={{ fontSize: 12.5 }}>{a.details || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}