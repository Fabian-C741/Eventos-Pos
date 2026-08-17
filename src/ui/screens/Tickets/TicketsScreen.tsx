import { useState } from 'react';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../api/client';
import { EmptyState, PageHeader, Field } from '../../components/common/ui';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { IconPicker, ColorPicker } from '../../components/common/Pickers';
import { formatMoney, padNumber } from '../../../shared/format';
import { PRODUCT_ICONS, CATEGORY_COLORS, TICKET_KINDS } from '../../../shared/constants';
import type { TicketType } from '../../../shared/types';

export function TicketsScreen() {
  const { activeEvent, ticketTypes, refreshEventData, loading } = useData();
  const { push } = useToast();

  const [editing, setEditing] = useState<TicketType | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<TicketType | null>(null);
  const [form, setForm] = useState({ name: '', price: '', kind: 'entrada', start_number: '', digits: 4, icon: '🎟️', color: '#8b5cf6' });

  if (!activeEvent) return <EmptyState icon="🗓️" title="Elegí un evento" subtitle="Seleccioná un evento desde el menú superior" />;

  const openCreate = () => {
    setForm({ name: '', price: '', kind: 'entrada', start_number: '', digits: 4, icon: '🎟️', color: '#8b5cf6' });
    setCreating(true);
  };

  const openEdit = (t: TicketType) => {
    setForm({ name: t.name, price: String(t.price), kind: t.kind, start_number: t.start_number != null ? String(t.start_number) : '', digits: t.digits, icon: t.icon, color: t.color });
    setEditing(t);
  };

  const save = async () => {
    if (!form.name.trim()) return push('error', 'El nombre es obligatorio');
    if (form.price === '' || isNaN(Number(form.price))) return push('error', 'Ingresá un precio válido');
    const payload = {
      name: form.name,
      price: Math.round(Number(form.price)),
      kind: form.kind as TicketType['kind'],
      start_number: form.start_number !== '' ? Math.max(1, Math.round(Number(form.start_number))) : null,
      digits: Math.max(1, Math.min(10, Math.round(Number(form.digits) || 4))),
      icon: form.icon,
      color: form.color,
    };
    try {
      if (editing) {
        await api.put(`/tickets/${editing.id}`, payload);
        push('success', 'Tipo actualizado');
      } else {
        await api.post(`/events/${activeEvent.id}/tickets`, payload);
        push('success', 'Tipo creado');
      }
      await refreshEventData();
      setEditing(null);
      setCreating(false);
    } catch (e) {
      push('error', (e as Error).message);
    }
  };

  const toggleActive = async (t: TicketType) => {
    try {
      await api.put(`/tickets/${t.id}`, { active: t.active ? 0 : 1 });
      await refreshEventData();
    } catch (e) {
      push('error', (e as Error).message);
    }
  };

  return (
    <div>
      <PageHeader title="Entradas y boletas" subtitle="Numeración automática, sin duplicados">
        <button className="btn btn-primary" onClick={openCreate}>＋ Nuevo tipo</button>
      </PageHeader>

      {ticketTypes.length === 0 ? (
        <EmptyState icon="🎟️" title="No hay tipos de entrada" subtitle="Creá entradas, boletas, rifas o bonos">
          <button className="btn btn-primary" onClick={openCreate}>＋ Crear</button>
        </EmptyState>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {ticketTypes.map((t) => (
            <div className="card card-pad" key={t.id} style={{ opacity: t.active ? 1 : 0.55, borderTop: `4px solid ${t.color}` }}>
              <div className="row-between">
                <div className="row">
                  <span style={{ fontSize: 30 }}>{t.icon}</span>
                  <div>
                    <div style={{ fontWeight: 800 }}>{t.name}</div>
                    <div className="muted" style={{ fontSize: 12.5 }}>
                      {TICKET_KINDS.find((k) => k.key === t.kind)?.label}
                    </div>
                  </div>
                </div>
                <span className={`badge ${t.active ? 'badge-green' : 'badge-red'}`}>{t.active ? 'Activo' : 'Inactivo'}</span>
              </div>
              <div className="row-between mt-8">
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary)' }}>{formatMoney(t.price)}</div>
                  <div className="muted" style={{ fontSize: 12.5 }}>
                    {t.last_number != null
                      ? <>Último número: <b style={{ color: 'var(--text)' }}>{padNumber(t.last_number, t.digits)}</b></>
                      : 'Sin numeración usada'}
                  </div>
                </div>
                <div className="row">
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(t)}>✏️</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(t)}>{t.active ? '⏸' : '▶'}</button>
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setDeleting(t)}>🗑</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={creating || !!editing} onClose={() => { setCreating(false); setEditing(null); }} title={editing ? 'Editar tipo' : 'Nuevo tipo'} size="lg">
        <div className="row" style={{ marginBottom: 16 }}>
          <IconPicker value={form.icon} onChange={(v) => setForm({ ...form, icon: v })} options={PRODUCT_ICONS} />
          <div style={{ flex: 1 }}>
            <Field label="Nombre *">
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Entrada General" />
            </Field>
          </div>
        </div>
        <div className="grid grid-2">
          <Field label="Precio ($) *">
            <input className="input" inputMode="numeric" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value.replace(/[^\d]/g, '') })} placeholder="8000" />
          </Field>
          <Field label="Tipo">
            <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
              {TICKET_KINDS.map((k) => (
                <button key={k.key} className={`chip ${form.kind === k.key ? 'active' : ''}`} onClick={() => setForm({ ...form, kind: k.key })}>
                  {k.icon} {k.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Número de inicio (opcional)">
            <input className="input" inputMode="numeric" value={form.start_number} onChange={(e) => setForm({ ...form, start_number: e.target.value.replace(/[^\d]/g, '') })} placeholder="Ej: 100" />
          </Field>
          <Field label="Cantidad de dígitos">
            <input className="input" inputMode="numeric" value={form.digits} onChange={(e) => setForm({ ...form, digits: Math.max(1, Math.min(10, Number(e.target.value.replace(/[^\d]/g, '')) || 4)) })} />
          </Field>
        </div>
        <Field label="Color">
          <ColorPicker value={form.color} onChange={(v) => setForm({ ...form, color: v })} colors={CATEGORY_COLORS} />
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
            await api.del(`/tickets/${deleting.id}`);
            push('success', 'Tipo eliminado');
            await refreshEventData();
          } catch (e) {
            push('error', (e as Error).message);
          }
        }}
        title="Eliminar tipo"
        danger
        message={`¿Eliminar "${deleting?.name}"? Si ya se vendió, no se podrá.`}
        confirmText="Eliminar"
      />
    </div>
  );
}