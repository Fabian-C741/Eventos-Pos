import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { api } from '../../api/client';
import { EmptyState, PageHeader, Spinner } from '../../components/common/ui';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { formatDateTime, formatNumber } from '../../../shared/format';
import type { BackupInfo } from '../../../shared/types';

export function BackupsScreen() {
  const { push } = useToast();
  const [list, setList] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState<BackupInfo | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setList(await api.get<BackupInfo[]>('/backups'));
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    setCreating(true);
    try {
      const b = await api.post<BackupInfo>('/backups');
      push('success', `Backup creado: ${b.name}`);
      await load();
    } catch (e) {
      push('error', (e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const restore = async () => {
    if (!restoring) return;
    try {
      await api.post(`/backups/${encodeURIComponent(restoring.name)}/restore`);
      push('success', 'Backup restaurado correctamente');
      await load();
    } catch (e) {
      push('error', (e as Error).message);
    }
  };

  const remove = async (b: BackupInfo) => {
    try {
      await api.del(`/backups/${encodeURIComponent(b.name)}`);
      push('success', 'Backup eliminado');
      await load();
    } catch (e) {
      push('error', (e as Error).message);
    }
  };

  return (
    <div>
      <PageHeader title="Backups" subtitle="Copias de seguridad de todos los datos">
        <button className="btn btn-primary" onClick={create} disabled={creating}>
          {creating ? 'Creando…' : '＋ Crear backup ahora'}
        </button>
        <a className="btn btn-ghost" href="/api/system/db/download">
          ⬇ Descargar copia completa
        </a>
      </PageHeader>

      <div className="card card-pad mb-16" style={{ borderLeft: '4px solid var(--primary)' }}>
        <div style={{ fontWeight: 800, marginBottom: 4 }}>Backup automático</div>
        <div className="muted" style={{ fontSize: 13.5 }}>
          Se crea un backup automáticamente al iniciar el programa y una vez por día. Así nunca se pierden datos, incluso si se cierra de forma accidental.
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : list.length === 0 ? (
        <EmptyState icon="💾" title="Sin backups" subtitle="Creá el primer backup con el botón de arriba" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Archivo</th>
                <th>Fecha</th>
                <th>Tamaño</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((b) => (
                <tr key={b.name}>
                  <td style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 13 }}>{b.name}</td>
                  <td>{formatDateTime(b.created_at)}</td>
                  <td>{formatNumber(Math.round(b.size / 1024))} KB</td>
                  <td>
                    <div className="row">
                      <a className="btn btn-ghost btn-sm" href={`/api/system/backups/download/${encodeURIComponent(b.name)}`}>⬇</a>
                      <button className="btn btn-ghost btn-sm" onClick={() => setRestoring(b)}>♻ Restaurar</button>
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => remove(b)}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!restoring}
        onClose={() => setRestoring(null)}
        onConfirm={restore}
        title="Restaurar backup"
        danger
        confirmText="Restaurar"
        message={`¿Restaurar "${restoring?.name}"? Se reemplazará TODA la información actual por la del backup. Esta acción no se puede deshacer.`}
      />
    </div>
  );
}