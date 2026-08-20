import { useState } from 'react';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../api/client';
import { EmptyState, PageHeader, Field } from '../../components/common/ui';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import type { Box } from '../../../shared/types';

export function BoxesScreen() {
  const { activeEvent, boxes, categories, refreshEventData } = useData();
  const { push } = useToast();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Box | null>(null);
  const [deleting, setDeleting] = useState<Box | null>(null);
  const [name, setName] = useState('');
  const [posTickets, setPosTickets] = useState(true);
  const [posUnlimited, setPosUnlimited] = useState(true);
  const [posCats, setPosCats] = useState<number[]>([]);

  if (!activeEvent) return <EmptyState icon="🗓️" title="Elegí un evento" subtitle="Seleccioná un evento desde el menú superior" />;

  const openCreate = () => {
    setName('');
    setPosTickets(true);
    setPosUnlimited(true);
    setPosCats([]);
    setCreating(true);
  };

  const openEdit = (b: Box) => {
    setName(b.name);
    setPosTickets(b.pos_tickets !== 0);
    setPosUnlimited(b.pos_categories == null);
    setPosCats((b.pos_categories || '').split(',').map(Number).filter(Boolean));
    setEditing(b);
  };

  const save = async () => {
    if (!name.trim()) return push('error', 'El nombre es obligatorio');
    try {
      const payload: Record<string, unknown> = {
        name,
        pos_categories: posUnlimited ? null : posCats.join(','),
        pos_tickets: posTickets ? 1 : 0,
      };
      if (editing) {
        await api.put(`/boxes/${editing.id}`, payload);
        push('success', 'Caja actualizada');
      } else {
        await api.post(`/events/${activeEvent.id}/boxes`, payload);
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

  const boxPuesto = (b: Box) => {
    const sells = [];
    if (b.pos_tickets !== 0) sells.push('🎟 Entradas');
    const cats = (b.pos_categories || '').split(',').map(Number).filter(Boolean);
    if (b.pos_categories == null) sells.push('📦 Productos (todos)');
    else if (cats.length === 0) sells.push('📦 Sin productos');
    else sells.push(`📦 ${cats.length} categoría(s)`);
    return sells.join(' · ');
  };

  return (
    <div>
      <PageHeader title="Cajas" subtitle="Cada caja define su puesto (entradas y/o productos). El cajero se asigna a una caja">
        <button className="btn btn-primary" onClick={openCreate}>＋ Nueva caja</button>
      </PageHeader>

      {boxes.length === 0 ? (
        <EmptyState icon="🗄️" title="No hay cajas" subtitle="Creá las cajas del evento (entradas, cantina, parrilla…)" />
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {boxes.map((b) => (
            <div className="card card-pad" key={b.id} style={{ opacity: b.active ? 1 : 0.55 }}>
              <div className="row-between">
                <div className="row">
                  <span style={{ fontSize: 28 }}>🗄️</span>
                  <div style={{ fontWeight: 800 }}>{b.name}</div>
                </div>
                <span className={`badge ${b.active ? 'badge-green' : 'badge-red'}`}>{b.active ? 'Activa' : 'Inactiva'}</span>
              </div>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>{boxPuesto(b)}</div>
              <div className="row mt-16">
                <button className="btn btn-ghost btn-sm" onClick={() => openEdit(b)}>✏️ Editar</button>
                <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(b)}>{b.active ? '⏸ Desactivar' : '▶ Activar'}</button>
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setDeleting(b)}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={creating || !!editing} onClose={() => { setCreating(false); setEditing(null); }} title={editing ? 'Editar caja' : 'Nueva caja'} size="md">
        <Field label="Nombre de la caja *">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Caja Entradas" />
        </Field>

        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 800, marginBottom: 4 }}>¿Qué vende esta caja?</div>
          <p className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>
            El cajero asignado a esta caja solo va a ver y vender lo que elijas acá.
          </p>
          <label className="row" style={{ marginBottom: 8 }}>
            <input type="checkbox" checked={posTickets} onChange={(e) => setPosTickets(e.target.checked)} />
            <span style={{ fontWeight: 700 }}>🎟 Vende entradas</span>
          </label>
          <label className="row" style={{ marginBottom: 8 }}>
            <input type="checkbox" checked={posUnlimited} onChange={(e) => setPosUnlimited(e.target.checked)} />
            <span style={{ fontWeight: 700 }}>📦 Vende todos los productos</span>
          </label>
          <div style={{ opacity: posUnlimited ? 0.45 : 1, pointerEvents: posUnlimited ? 'none' : 'auto' }}>
            {categories.length === 0 ? (
              <p className="muted" style={{ fontSize: 12.5 }}>El evento no tiene categorías todavía. Podés dejar "todos los productos".</p>
            ) : (
              <div className="grid grid-2">
                {categories.filter((c) => c.active === 1).map((c) => (
                  <label key={c.id} className="row">
                    <input
                      type="checkbox"
                      checked={posCats.includes(c.id)}
                      onChange={(e) =>
                        setPosCats((prev) => (e.target.checked ? [...prev, c.id] : prev.filter((x) => x !== c.id)))
                      }
                    />
                    <span style={{ fontSize: 13.5 }}>{c.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

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