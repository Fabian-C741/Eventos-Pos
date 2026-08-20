import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../api/client';
import { EmptyState, PageHeader, Field } from '../../components/common/ui';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { formatDateTime } from '../../../shared/format';
import type { User, Role } from '../../../shared/types';

export function UsersScreen() {
  const { user: me } = useAuth();
  const { activeEvent, boxes } = useData();
  const { push } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [deleting, setDeleting] = useState<User | null>(null);
  const [form, setForm] = useState({ username: '', name: '', role: 'cajero' as Role, password: '', pin: '', active: 1 });
  const [posBoxId, setPosBoxId] = useState<number | ''>('');
  const [ownerId, setOwnerId] = useState<number | ''>('');

  const load = async () => {
    setLoading(true);
    try {
      setUsers(await api.get<User[]>('/users'));
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setForm({ username: '', name: '', role: me?.role === 'superadmin' ? 'admin' : 'cajero', password: '', pin: '', active: 1 });
    setPosBoxId('');
    setOwnerId('');
    setCreating(true);
  };

  const openEdit = (u: User) => {
    setForm({ username: u.username, name: u.name, role: u.role, password: '', pin: '', active: u.active });
    setPosBoxId(u.pos_box_id ?? '');
    setOwnerId(u.owner_id ?? '');
    setEditing(u);
  };

  const save = async () => {
    if (!form.username.trim()) return push('error', 'El usuario es obligatorio');
    if (form.role === 'cajero' && creating && !/^\d{4}$/.test(form.pin)) return push('error', 'El PIN debe tener 4 dígitos');
    if (form.role !== 'cajero' && creating && form.password.length < 6) return push('error', 'La contraseña debe tener al menos 6 caracteres');
    try {
      if (editing) {
        const payload: Record<string, unknown> = { name: form.name, active: form.active };
        if (form.role === 'cajero' && form.pin) payload.pin = form.pin;
        if (form.role !== 'cajero' && form.password) payload.password = form.password;
        if (form.role === 'cajero') {
          payload.pos_box_id = posBoxId === '' ? null : Number(posBoxId);
          payload.owner_id = me?.role === 'admin' ? me.id : ownerId === '' ? null : Number(ownerId);
        }
        await api.put(`/users/${editing.id}`, payload);
        push('success', 'Usuario actualizado');
      } else {
        const body: Record<string, unknown> = {
          username: form.username,
          name: form.name,
          role: form.role,
          ...(form.role === 'cajero' ? { pin: form.pin } : { password: form.password }),
        };
        if (form.role === 'cajero') {
          body.pos_box_id = posBoxId === '' ? null : Number(posBoxId);
          body.owner_id = me?.role === 'admin' ? me.id : ownerId === '' ? null : Number(ownerId);
        }
        await api.post('/users', body);
        push('success', 'Usuario creado');
      }
      setCreating(false);
      setEditing(null);
      await load();
    } catch (e) {
      push('error', (e as Error).message);
    }
  };

  const roleLabel = (r: Role) => (r === 'superadmin' ? 'Superadmin' : r === 'admin' ? 'Admin' : 'Cajero');
  const boxName = (u: User) => (u.pos_box_id ? boxes.find((b) => b.id === u.pos_box_id)?.name ?? '—' : '—');

  return (
    <div>
      <PageHeader title="Usuarios" subtitle="Administradores entran con usuario y contraseña; cajeros con PIN">
        <button className="btn btn-primary" onClick={openCreate}>＋ Nuevo usuario</button>
      </PageHeader>

      {loading ? (
        <div className="spinner" />
      ) : users.length === 0 ? (
        <EmptyState icon="👥" title="Sin usuarios" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Caja</th>
                <th>Estado</th>
                <th>Último ingreso</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 700 }}>{u.name}</td>
                  <td>{u.username}</td>
                  <td>
                    <span className={`badge ${u.role === 'superadmin' ? 'badge-violet' : u.role === 'admin' ? 'badge-blue' : 'badge-green'}`}>
                      {roleLabel(u.role)}
                    </span>
                  </td>
                  <td>{u.role === 'cajero' ? boxName(u) : <span className="muted">—</span>}</td>
                  <td>{u.active ? <span className="badge badge-green">Activo</span> : <span className="badge badge-red">Inactivo</span>}</td>
                  <td className="muted" style={{ fontSize: 12.5 }}>{u.last_login_at ? formatDateTime(u.last_login_at) : '—'}</td>
                  <td>
                    <div className="row">
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(u)}>✏️</button>
                      {u.role !== 'superadmin' && (
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setDeleting(u)}>🗑</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={creating || !!editing} onClose={() => { setCreating(false); setEditing(null); }} title={editing ? 'Editar usuario' : 'Nuevo usuario'} size="lg">
        <div className="grid grid-2">
          <Field label="Nombre *">
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nombre y apellido" />
          </Field>
          <Field label={form.role === 'cajero' ? 'Nombre de usuario *' : 'Usuario o email *'}>
            <input className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder={form.role === 'cajero' ? 'cajero1' : 'usuario@email.com'} />
          </Field>
        </div>

        <Field label="Rol">
          <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
            {me?.role === 'superadmin' && (
              <button className={`chip ${form.role === 'admin' ? 'active' : ''}`} onClick={() => setForm({ ...form, role: 'admin' })}>👤 Admin</button>
            )}
            <button className={`chip ${form.role === 'cajero' ? 'active' : ''}`} onClick={() => setForm({ ...form, role: 'cajero' })}>🛒 Cajero</button>
          </div>
        </Field>

        {form.role === 'cajero' ? (
          <Field label={editing ? 'PIN de 4 dígitos (dejar vacío para no cambiarlo)' : 'PIN de 4 dígitos (el cajero solo toca números)'}>
            <input className="input" inputMode="numeric" maxLength={4} value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/[^\d]/g, '').slice(0, 4) })} placeholder="1234" style={{ fontSize: 20, letterSpacing: 8 }} />
          </Field>
        ) : (
          <Field label={editing ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña *'}>
            <input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 6 caracteres" />
          </Field>
        )}

        {form.role === 'cajero' && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 800, marginBottom: 4 }}>Caja asignada</div>
            <p className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>
              Elegí en qué caja trabaja este cajero. Al entrar verá solo esa caja y lo que ella vende.
            </p>
            {me?.role === 'superadmin' && (
              <Field label="Pertenece al admin (inquilino)">
                <select className="input" value={ownerId} onChange={(e) => setOwnerId(e.target.value === '' ? '' : Number(e.target.value))}>
                  <option value="">Sin admin (solo ve eventos del superadmin)</option>
                  {users.filter((u) => u.role === 'admin').map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.username})</option>
                  ))}
                </select>
              </Field>
            )}
            <Field label={activeEvent ? `Caja del evento "${activeEvent.name}"` : 'Caja'}>
              <select className="input" value={posBoxId} onChange={(e) => setPosBoxId(e.target.value === '' ? '' : Number(e.target.value))}>
                <option value="">Sin caja asignada</option>
                {boxes.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}{b.active === 0 ? ' (inactiva)' : ''}</option>
                ))}
              </select>
            </Field>
            {boxes.length === 0 && (
              <p className="muted" style={{ fontSize: 12.5 }}>
                {activeEvent
                  ? 'El evento actual no tiene cajas. Creá cajas en la sección "Cajas" y definí qué vende cada una.'
                  : 'Seleccioná un evento en el menú superior para ver sus cajas.'}
              </p>
            )}
          </div>
        )}

        {editing && (
          <label className="row" style={{ marginBottom: 16 }}>
            <input type="checkbox" checked={form.active === 1} onChange={(e) => setForm({ ...form, active: e.target.checked ? 1 : 0 })} />
            <span style={{ fontWeight: 700 }}>Activo</span>
          </label>
        )}

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
            await api.del(`/users/${deleting.id}`);
            push('success', 'Usuario eliminado');
            await load();
          } catch (e) {
            push('error', (e as Error).message);
          }
        }}
        title="Eliminar usuario"
        danger
        message={`¿Eliminar a "${deleting?.name}"? Si ya hizo ventas, se desactivará en lugar de eliminarse.`}
        confirmText="Eliminar"
      />
    </div>
  );
}