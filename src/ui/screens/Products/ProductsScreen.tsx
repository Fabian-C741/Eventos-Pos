import { useMemo, useState } from 'react';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../api/client';
import { EmptyState, PageHeader, Field, Spinner } from '../../components/common/ui';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { IconPicker, ColorPicker } from '../../components/common/Pickers';
import { formatMoney } from '../../../shared/format';
import { CATEGORY_ICONS, PRODUCT_ICONS, CATEGORY_COLORS } from '../../../shared/constants';
import type { Category, Product } from '../../../shared/types';

export function ProductsScreen() {
  const { activeEvent, categories, products, refreshEventData, loading } = useData();
  const { push } = useToast();

  const [activeCat, setActiveCat] = useState<number | 'all' | 'uncat'>('all');
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Product | null>(null);

  const [catEditing, setCatEditing] = useState<Category | null>(null);
  const [catCreating, setCatCreating] = useState(false);
  const [catDeleting, setCatDeleting] = useState<Category | null>(null);

  const [form, setForm] = useState({ name: '', price: '', category_id: '', icon: '🍽️', color: '#0ea5e9', active: 1 });
  const [catForm, setCatForm] = useState({ name: '', icon: '📦', color: '#0ea5e9' });
  const [priceEdit, setPriceEdit] = useState<Product | null>(null);
  const [priceVal, setPriceVal] = useState('');

  const filtered = useMemo(() => {
    if (!activeEvent) return [];
    if (activeCat === 'all') return products;
    if (activeCat === 'uncat') return products.filter((p) => p.category_id === null);
    return products.filter((p) => p.category_id === activeCat);
  }, [products, activeCat, activeEvent]);

  if (!activeEvent) return <EmptyState icon="🗓️" title="Elegí un evento" subtitle="Seleccioná un evento desde el menú superior" />;
  if (loading) return <Spinner />;

  const openCreate = () => {
    setForm({ name: '', price: '', category_id: activeCat === 'all' || activeCat === 'uncat' ? '' : String(activeCat), icon: '🍽️', color: '#0ea5e9', active: 1 });
    setCreating(true);
  };

  const openEdit = (p: Product) => {
    setForm({ name: p.name, price: String(p.price), category_id: p.category_id ? String(p.category_id) : '', icon: p.icon, color: p.color, active: p.active });
    setEditing(p);
  };

  const save = async () => {
    if (!form.name.trim()) return push('error', 'El nombre es obligatorio');
    if (form.price === '' || isNaN(Number(form.price))) return push('error', 'Ingresá un precio válido');
    const payload = {
      name: form.name,
      price: Math.round(Number(form.price)),
      category_id: form.category_id ? Number(form.category_id) : null,
      icon: form.icon,
      color: form.color,
    };
    try {
      if (editing) {
        await api.put(`/products/${editing.id}`, { ...payload, active: form.active });
        push('success', 'Producto actualizado');
      } else {
        await api.post(`/events/${activeEvent.id}/products`, payload);
        push('success', 'Producto creado');
      }
      await refreshEventData();
      setEditing(null);
      setCreating(false);
    } catch (e) {
      push('error', (e as Error).message);
    }
  };

  const savePrice = async () => {
    if (!priceEdit) return;
    if (isNaN(Number(priceVal)) || Number(priceVal) < 0) return push('error', 'Precio inválido');
    try {
      await api.put(`/products/${priceEdit.id}`, { price: Math.round(Number(priceVal)) });
      push('success', 'Precio actualizado');
      await refreshEventData();
      setPriceEdit(null);
    } catch (e) {
      push('error', (e as Error).message);
    }
  };

  const toggleActive = async (p: Product) => {
    try {
      await api.put(`/products/${p.id}`, { active: p.active ? 0 : 1 });
      await refreshEventData();
    } catch (e) {
      push('error', (e as Error).message);
    }
  };

  const duplicate = async (p: Product) => {
    try {
      await api.post(`/products/${p.id}/duplicate`);
      push('success', 'Producto duplicado');
      await refreshEventData();
    } catch (e) {
      push('error', (e as Error).message);
    }
  };

  const saveCat = async () => {
    if (!catForm.name.trim()) return push('error', 'El nombre de la categoría es obligatorio');
    try {
      if (catEditing) {
        await api.put(`/categories/${catEditing.id}`, catForm);
        push('success', 'Categoría actualizada');
      } else {
        await api.post(`/events/${activeEvent.id}/categories`, catForm);
        push('success', 'Categoría creada');
      }
      await refreshEventData();
      setCatEditing(null);
      setCatCreating(false);
    } catch (e) {
      push('error', (e as Error).message);
    }
  };

  return (
    <div>
      <PageHeader title="Productos" subtitle={activeEvent.name}>
        <button className="btn btn-ghost" onClick={() => setCatCreating(true)}>📂 Categorías</button>
        <button className="btn btn-primary" onClick={openCreate}>＋ Nuevo producto</button>
      </PageHeader>

      <div className="tab-scroll mb-16">
        <button className={`chip ${activeCat === 'all' ? 'active' : ''}`} onClick={() => setActiveCat('all')}>Todos</button>
        <button className={`chip ${activeCat === 'uncat' ? 'active' : ''}`} onClick={() => setActiveCat('uncat')}>Sin categoría</button>
        {categories.map((c) => (
          <button key={c.id} className={`chip ${activeCat === c.id ? 'active' : ''}`} onClick={() => setActiveCat(c.id)}>
            {c.icon} {c.name}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="🧺" title="Sin productos aquí" subtitle="Tocá 'Nuevo producto' para agregar">
          <button className="btn btn-primary" onClick={openCreate}>＋ Nuevo producto</button>
        </EmptyState>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
          {filtered.map((p) => (
            <div className="card" key={p.id} style={{ padding: 14, opacity: p.active ? 1 : 0.55 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div style={{ fontSize: 32 }}>{p.icon}</div>
                <span className={`badge ${p.active ? 'badge-green' : 'badge-red'}`}>{p.active ? 'Activo' : 'Inactivo'}</span>
              </div>
              <div style={{ fontWeight: 800, marginTop: 8 }}>{p.name}</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--primary)' }}>{formatMoney(p.price)}</div>
              <div className="row mt-8" style={{ flexWrap: 'wrap' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => { setPriceEdit(p); setPriceVal(String(p.price)); }}>💲</button>
                <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>✏️</button>
                <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(p)}>{p.active ? '⏸' : '▶'}</button>
                <button className="btn btn-ghost btn-sm" onClick={() => duplicate(p)}>⧉</button>
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setDeleting(p)}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Producto modal */}
      <Modal open={creating || !!editing} onClose={() => { setCreating(false); setEditing(null); }} title={editing ? 'Editar producto' : 'Nuevo producto'}>
        <div className="row" style={{ marginBottom: 16 }}>
          <IconPicker value={form.icon} onChange={(v) => setForm({ ...form, icon: v })} options={PRODUCT_ICONS} />
          <div style={{ flex: 1 }}>
            <Field label="Nombre *">
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Torta" />
            </Field>
          </div>
        </div>
        <div className="grid grid-2">
          <Field label="Precio ($) *">
            <input className="input" inputMode="numeric" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value.replace(/[^\d]/g, '') })} placeholder="5000" />
          </Field>
          <Field label="Categoría">
            <select className="select" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
              <option value="">Sin categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Color">
          <ColorPicker value={form.color} onChange={(v) => setForm({ ...form, color: v })} colors={CATEGORY_COLORS} />
        </Field>
        {editing && (
          <label className="row" style={{ marginBottom: 16 }}>
            <input type="checkbox" checked={form.active === 1} onChange={(e) => setForm({ ...form, active: e.target.checked ? 1 : 0 })} />
            <span style={{ fontWeight: 700 }}>Activo (visible en la pantalla del cajero)</span>
          </label>
        )}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={() => { setCreating(false); setEditing(null); }}>Cancelar</button>
          <button className="btn btn-primary" onClick={save}>Guardar</button>
        </div>
      </Modal>

      {/* Precio modal */}
      <Modal open={!!priceEdit} onClose={() => setPriceEdit(null)} title={`Precio de ${priceEdit?.name}`} size="sm">
        <Field label="Precio ($)">
          <input className="input" inputMode="numeric" value={priceVal} onChange={(e) => setPriceVal(e.target.value.replace(/[^\d]/g, ''))} style={{ fontSize: 22, fontWeight: 800 }} />
        </Field>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={() => setPriceEdit(null)}>Cancelar</button>
          <button className="btn btn-primary" onClick={savePrice}>Guardar</button>
        </div>
      </Modal>

      {/* Categorías modal */}
      <Modal open={catCreating || !!catEditing} onClose={() => { setCatCreating(false); setCatEditing(null); setCatForm({ name: '', icon: '📦', color: '#0ea5e9' }); }} title={catEditing ? 'Editar categoría' : 'Nueva categoría'} size="lg">
        <div className="grid grid-2" style={{ gap: 14 }}>
          <Field label="Nombre *">
            <input className="input" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} placeholder="Ej: Comidas" />
          </Field>
          <Field label="Icono">
            <IconPicker value={catForm.icon} onChange={(v) => setCatForm({ ...catForm, icon: v })} options={CATEGORY_ICONS} />
          </Field>
        </div>
        <Field label="Color">
          <ColorPicker value={catForm.color} onChange={(v) => setCatForm({ ...catForm, color: v })} colors={CATEGORY_COLORS} />
        </Field>
        <div className="row mt-16" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={() => { setCatCreating(false); setCatEditing(null); setCatForm({ name: '', icon: '📦', color: '#0ea5e9' }); }}>Cerrar</button>
          <button className="btn btn-primary" onClick={saveCat}>{catEditing ? 'Guardar cambios' : '＋ Crear categoría'}</button>
        </div>
        <div style={{ marginTop: 20, borderTop: '1px dashed var(--border)', paddingTop: 14 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Categorías actuales ({categories.length})</div>
          {categories.length === 0 ? (
            <div className="muted" style={{ fontSize: 13.5 }}>Todavía no hay categorías.</div>
          ) : (
            categories.map((c) => (
              <div className="row-between" key={c.id} style={{ padding: '8px 0', borderBottom: '1px dashed var(--border)' }}>
                <div className="row">
                  <span style={{ fontSize: 20 }}>{c.icon}</span>
                  <span style={{ fontWeight: 700 }}>{c.name}</span>
                  <span className="muted" style={{ fontSize: 12 }}>({products.filter((p) => p.category_id === c.id).length} productos)</span>
                </div>
                <div className="row">
                  <button className="btn btn-ghost btn-sm" onClick={() => { setCatEditing(c); setCatForm({ name: c.name, icon: c.icon, color: c.color }); }}>✏️</button>
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setCatDeleting(c)}>🗑</button>
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await api.del(`/products/${deleting.id}`);
            push('success', 'Producto eliminado');
            await refreshEventData();
          } catch (e) {
            push('error', (e as Error).message);
          }
        }}
        title="Eliminar producto"
        danger
        message={`¿Eliminar "${deleting?.name}"? Si ya se vendió, no se podrá.`}
        confirmText="Eliminar"
      />

      <ConfirmDialog
        open={!!catDeleting}
        onClose={() => setCatDeleting(null)}
        onConfirm={async () => {
          if (!catDeleting) return;
          try {
            await api.del(`/categories/${catDeleting.id}`);
            push('success', 'Categoría eliminada');
            await refreshEventData();
          } catch (e) {
            push('error', (e as Error).message);
          }
        }}
        title="Eliminar categoría"
        danger
        message={`¿Eliminar la categoría "${catDeleting?.name}"? Los productos pasarán a "sin categoría".`}
        confirmText="Eliminar"
      />
    </div>
  );
}