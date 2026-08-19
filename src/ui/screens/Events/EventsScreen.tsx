import { useEffect, useState } from 'react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../api/client';
import { EmptyState, PageHeader, Field } from '../../components/common/ui';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { formatDate } from '../../../shared/format';
import type { Event, User } from '../../../shared/types';

export function EventsScreen() {
  const { events, refreshEvents, setActiveEvent, activeEvent } = useData();
  const { user: me } = useAuth();
  const { push } = useToast();
  const [admins, setAdmins] = useState<User[]>([]);
  const [editing, setEditing] = useState<Event | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Event | null>(null);
  const [form, setForm] = useState({ name: '', venue: '', start_date: '', end_date: '', description: '', active: 1, owner_id: '' as string | number });

  useEffect(() => {
    if (me?.role !== 'superadmin') return;
    api
      .get<User[]>('/users')
      .then((us) => setAdmins(us.filter((u) => u.role === 'admin')))
      .catch(() => {});
  }, [me?.role]);

  const openCreate = () => {
    setForm({ name: '', venue: '', start_date: '', end_date: '', description: '', active: 1, owner_id: '' });
    setCreating(true);
  };

  const openEdit = (e: Event) => {
    setForm({
      name: e.name,
      venue: e.venue,
      start_date: e.start_date,
      end_date: e.end_date,
      description: e.description,
      active: e.active,
      owner_id: e.owner_id ?? '',
    });
    setEditing(e);
  };

  const save = async () => {
    if (!form.name.trim()) {
      push('error', 'El nombre del evento es obligatorio');
      return;
    }
    try {
      const payload: Record<string, unknown> = { ...form };
      payload.owner_id = form.owner_id === '' || form.owner_id === 0 ? null : Number(form.owner_id);
      if (editing) {
        await api.put(`/events/${editing.id}`, payload);
        push('success', 'Evento actualizado');
      } else {
        await api.post('/events', payload);
        push('success', 'Evento creado');
      }
      await refreshEvents();
      setEditing(null);
      setCreating(false);
    } catch (e) {
      push('error', (e as Error).message);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await api.del(`/events/${deleting.id}`);
      push('success', 'Evento eliminado');
      if (activeEvent?.id === deleting.id) setActiveEvent(null);
      await refreshEvents();
    } catch (e) {
      push('error', (e as Error).message);
    }
  };

  return (
    <div>
      <PageHeader title="Eventos" subtitle="Creá y administrá los eventos">
        <button className="btn btn-primary" onClick={openCreate}>＋ Nuevo evento</button>
      </PageHeader>

      {events.length === 0 ? (
        <EmptyState icon="🗓️" title="No hay eventos" subtitle="Creá el primer evento para empezar a vender">
          <button className="btn btn-primary" onClick={openCreate}>＋ Crear evento</button>
        </EmptyState>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {events.map((e) => (
            <div className="card card-pad" key={e.id} style={activeEvent?.id === e.id ? { border: '2px solid var(--primary)' } : undefined}>
              <div className="row-between">
                <div className="row">
                  <span style={{ fontSize: 30 }}>🎪</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>{e.name}</div>
                    <div className="muted" style={{ fontSize: 13 }}>{e.venue}</div>
                  </div>
                </div>
                {e.active === 1 ? <span className="badge badge-green">Activo</span> : <span className="badge badge-red">Inactivo</span>}
              </div>
              <div className="mt-8 muted" style={{ fontSize: 13 }}>
                {e.start_date && `Desde ${formatDate(e.start_date)}`}
                {e.end_date && ` · Hasta ${formatDate(e.end_date)}`}
              </div>
              {me?.role === 'superadmin' && (
                <div className="mt-8" style={{ fontSize: 12.5 }}>
                  {e.owner_id ? (
                    <span className="badge badge-blue">Dueño: {admins.find((a) => a.id === e.owner_id)?.name || 'Admin'}</span>
                  ) : (
                    <span className="badge badge-violet">Sin dueño (solo superadmin)</span>
                  )}
                </div>
              )}
              {e.description && <div className="muted mt-8" style={{ fontSize: 13 }}>{e.description}</div>}
              <div className="row mt-16" style={{ flexWrap: 'wrap' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setActiveEvent(e.id)}>
                  {activeEvent?.id === e.id ? '✓ Seleccionado' : 'Seleccionar'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => openEdit(e)}>✏️ Editar</button>
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setDeleting(e)}>🗑 Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={creating || !!editing} onClose={() => { setCreating(false); setEditing(null); }} title={editing ? 'Editar evento' : 'Nuevo evento'}>
        <Field label="Nombre *">
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Evento 2026" />
        </Field>
        <Field label="Lugar">
          <input className="input" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} placeholder="Ej: Parque Central" />
        </Field>
        <div className="grid grid-2">
          <Field label="Inicio">
            <input className="input" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          </Field>
          <Field label="Fin">
            <input className="input" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
          </Field>
        </div>
        <Field label="Descripción">
          <textarea className="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
        </Field>
        {me?.role === 'superadmin' && (
          <Field label="Asignar a admin (dueño)">
            <select
              className="input"
              value={form.owner_id}
              onChange={(e) => setForm({ ...form, owner_id: e.target.value })}
            >
              <option value="">Sin dueño (solo superadmin)</option>
              {admins.map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({a.username})</option>
              ))}
            </select>
          </Field>
        )}
        <label className="row" style={{ marginBottom: 16 }}>
          <input type="checkbox" checked={form.active === 1} onChange={(e) => setForm({ ...form, active: e.target.checked ? 1 : 0 })} />
          <span style={{ fontWeight: 700 }}>Activo (se puede vender)</span>
        </label>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={() => { setCreating(false); setEditing(null); }}>Cancelar</button>
          <button className="btn btn-primary" onClick={save}>Guardar</button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        title="Eliminar evento"
        danger
        message={`¿Seguro que querés eliminar "${deleting?.name}"? Se borrarán también sus cajas, productos, categorías, entradas, ventas y cierres. Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
      />
    </div>
  );
}