import { useEffect, useRef, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { api } from '../../api/client';
import { PageHeader, Spinner } from '../../components/common/ui';

interface AppSettings {
  app_name: string;
  currency_symbol: string;
  receipt_footer: string;
  login_logo: string;
  payment_tarjeta: string;
}

export function ConfigScreen() {
  const { push } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<AppSettings>({ app_name: '', currency_symbol: '$', receipt_footer: '', login_logo: '', payment_tarjeta: '0' });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const pickLogo = (file: File) => {
    if (!file.type.startsWith('image/')) return push('error', 'El archivo debe ser una imagen');
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const MAX = 256;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        setForm((prev) => ({ ...prev, login_logo: canvas.toDataURL('image/png') }));
        push('success', 'Imagen lista. Guardá para aplicarla');
      };
      img.onerror = () => push('error', 'No se pudo leer la imagen');
      img.src = String(reader.result);
    };
    reader.onerror = () => push('error', 'No se pudo leer el archivo');
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    api
      .get<Partial<AppSettings>>('/settings')
      .then((s) =>
        setForm({
          app_name: s.app_name ?? '',
          currency_symbol: s.currency_symbol ?? '$',
          receipt_footer: s.receipt_footer ?? '',
          login_logo: s.login_logo ?? '',
          payment_tarjeta: s.payment_tarjeta ?? '0',
        }),
      )
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
        login_logo: form.login_logo.trim(),
        payment_tarjeta: form.payment_tarjeta,
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
          <div style={{ display: 'block' }}>
            <span style={{ fontWeight: 700, fontSize: 13.5, display: 'block', marginBottom: 6 }}>Logo del login (emoji, texto, URL o imagen)</span>
            <div className="row" style={{ gap: 8 }}>
              <input className="input" style={{ flex: 1 }} value={form.login_logo} onChange={(e) => setForm({ ...form, login_logo: e.target.value })} placeholder="Ej: 🎪 o https://tusitio.com/logo.png" />
              <button type="button" className="btn" onClick={() => fileInputRef.current?.click()}>📤 Subir</button>
              {form.login_logo && (
                <button type="button" className="btn btn-ghost" onClick={() => setForm({ ...form, login_logo: '' })}>🗑</button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) pickLogo(f);
                e.target.value = '';
              }}
            />
            {form.login_logo && (
              <div style={{ marginTop: 8 }}>
                {/^(https?:|data:image|\/)/i.test(form.login_logo) ? (
                  <img src={form.login_logo} alt="Logo" style={{ height: 64, borderRadius: 10, border: '1px solid var(--border)', background: '#fff' }} />
                ) : (
                  <span style={{ fontSize: 28 }}>{form.login_logo}</span>
                )}
              </div>
            )}
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Aparece arriba del nombre del sistema en la pantalla de acceso.</span>
          </div>
          <label className="row" style={{ cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.payment_tarjeta === '1'}
              onChange={(e) => setForm({ ...form, payment_tarjeta: e.target.checked ? '1' : '0' })}
            />
            <span style={{ fontWeight: 700 }}>Permitir pago con tarjeta en el POS</span>
          </label>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>Por defecto el cajero solo ve Efectivo y Transferencia. Activá esta opción para mostrar también Tarjeta.</span>
        </div>

        <div className="row mt-16" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}