import { useEffect, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { api } from '../../api/client';
import { PageHeader, Spinner } from '../../components/common/ui';

interface AppSettings {
  app_name: string;
  currency_symbol: string;
  receipt_footer: string;
}

export function ConfigScreen() {
  const { push } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<AppSettings>({ app_name: '', currency_symbol: '$', receipt_footer: '' });

  useEffect(() => {
    api
      .get<AppSettings>('/settings')
      .then(setForm)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/settings', {
        app_name: form.app_name.trim() || 'Sistema de Eventos',
        currency_symbol: form.currency_symbol.trim() || '$',
        receipt_footer: form.receipt_footer.trim(),
      });
      push('success', 'Configuración guardada');
    } catch (e) {
      push('error', (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div style={{ maxWidth: 640 }}>
      <PageHeader title="Configuración" subtitle="Ajustes generales del sistema" />

      <div className="card card-pad">
        <div style={{ fontWeight: 800, marginBottom: 14 }}>Sistema</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ display: 'block' }}>
            <span style={{ fontWeight: 700, fontSize: 13.5, display: 'block', marginBottom: 6 }}>Nombre del sistema</span>
            <input className="input" value={form.app_name} onChange={(e) => setForm({ ...form, app_name: e.target.value })} placeholder="Ej: Fiesta de la Familia" />
          </label>
          <label style={{ display: 'block' }}>
            <span style={{ fontWeight: 700, fontSize: 13.5, display: 'block', marginBottom: 6 }}>Símbolo de moneda</span>
            <input className="input" style={{ width: 120, fontSize: 20, fontWeight: 800, textAlign: 'center' }} value={form.currency_symbol} onChange={(e) => setForm({ ...form, currency_symbol: e.target.value })} maxLength={3} />
          </label>
          <label style={{ display: 'block' }}>
            <span style={{ fontWeight: 700, fontSize: 13.5, display: 'block', marginBottom: 6 }}>Mensaje al pie del recibo (opcional)</span>
            <textarea className="input" rows={3} value={form.receipt_footer} onChange={(e) => setForm({ ...form, receipt_footer: e.target.value })} placeholder="Ej: ¡Gracias por tu visita! Reclamos: 11-5555-5555" />
          </label>
        </div>

        <div className="row mt-16" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}