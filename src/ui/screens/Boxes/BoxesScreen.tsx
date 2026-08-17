import { useState } from 'react';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../api/client';
import { EmptyState, PageHeader, Field } from '../../components/common/ui';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import type { Box } from '../../../shared/types';

export function BoxesScreen() {
  const { activeEvent, boxes, refreshEventData } = useData();
  const { push } = useToast();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Box | null>(null);
  const [deleting, setDeleting] = useState<Box | null>(null);
  const [name, setName] = useState('');

  if (!activeEvent) return <EmptyState icon="🗓️" title="Elegí un evento" subtitle="Seleccioná un evento desde el menú superior" />;

  const save = async () => {
    if (!name.trim()) return push('error', 'El nombre es obligatorio');
    try {
      if (editing) {
        await api.put(`/boxes/${editing.id}`, { name });
        push('success', 'Caja actualizada');
      } else {
        await api.post(`/events/${activeEvent.id}/boxes`, { name });
        push('success', 'Caja creada');
      }
      await refreshEventData();
      setCreating(false);
      setEditing(null);
    } catch (e) {
      push('error', (e as Error).message);
    }
  };

  const toggleActive = async (b: Box) => {
    try {
      await api.put(`/boxes/${b.id}`, { active: b.active ? 0 : 1 });
      await refreshEventData();
    } catch (e) {
      push('error', (e as Error).message);
    }
  };

  return (
    <div>
      <PageHeader title="Cajas" subtitle="Cada cajero elige su caja al entrar">
        <button className="btn btn-primary" onClick={() => { setName(''); setCreating(true); }}>＋ Nueva caja</button>
      </PageHeader>

      {boxes.length === 0 ? (
        <EmptyState icon="🗄️" title="No hay cajas" subtitle="Creá las cajas del evento (cantina, parrilla, entradas…)" />
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
          {boxes.map((b) => (
            <div className="card card-pad" key={b.id} style={{ opacity: b.active ? 1 : 0.55 }}>
              <div className="row-between">
                <div className="row">
                  <span style={{ fontSize: 28 }}>🗄️</span>
                  <div style={{ fontWeight: 800 }}>{b.name}</div>
                </div>
                <span className={`badge ${b.active ? 'badge-green' : 'badge-red'}`}>{b.active ? 'Activa' : 'Inactiva'}</span>
              </div>
              <div className="row mt-16">
                <button className="btn btn-ghost btn-sm" onClick={() => { setName(b.name); setEditing(b); }}>✏️ Editar</button>
                <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(b)}>{b.active ? '⏸ Desactivar' : '▶ Activar'}</button>
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setDeleting(b)}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={creating || !!editing} onClose={() => { setCreating(false); setEditing(null); }} title={editing ? 'Editar caja' : 'Nueva caja'} size="sm">
        <Field label="Nombre de la caja *">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Caja 1 — Cantina" />
        </Field>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={() => { setCreating(false); setEditing(null); }}>Cancelar</button>
          <button className="btn btn-primary" onClick={save}>Guardar</button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await api.del(`/boxes/${deleting.id}`);
            push('success', 'Caja eliminada');
            await refreshEventData();
          } catch (e) {
            push('error', (e as Error).message);
          }
        }}
        title="Eliminar caja"
        danger
        message={`¿Eliminar "${deleting?.name}"? Si tiene ventas, no se podrá.`}
        confirmText="Eliminar"
      />
    </div>
  );
}