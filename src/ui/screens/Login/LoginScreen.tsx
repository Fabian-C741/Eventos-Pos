import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../api/client';
import { Modal } from '../../components/common/Modal';
import { APP_VERSION } from '../../../shared/constants';
import type { User } from '../../../shared/types';

export function LoginScreen() {
  const { needsSetup, login, loginPin, user } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'superadmin' | 'admin' | 'cajero'>('superadmin');
  const [error, setError] = useState('');
  const [setupError, setSetupError] = useState('');
  const [busy, setBusy] = useState(false);

  // setup
  const [setupOpen, setSetupOpen] = useState(false);
  const [setup, setSetup] = useState({ email: '', password: '', name: '' });

  // admin login
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // cajero pin
  const [cashiers, setCashiers] = useState<User[]>([]);
  const [selected, setSelected] = useState<User | null>(null);
  const [pin, setPin] = useState('');

  useEffect(() => {
    if (user) {
      navigate(user.role === 'cajero' ? '/cajero' : '/dashboard', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    if (needsSetup) setSetupOpen(true);
  }, [needsSetup]);

  useEffect(() => {
    if (mode === 'cajero' && needsSetup === false) {
      api
        .get<User[]>('/users')
        .then((us) => setCashiers(us.filter((u) => u.role === 'cajero' && u.active === 1)))
        .catch(() => setCashiers([]));
    }
  }, [mode, needsSetup]);

  const doSetup = async () => {
    setBusy(true);
    setSetupError('');
    try {
      await api.post('/auth/setup', setup);
      push('success', 'Sistema configurado. Ingresá ahora.');
      setSetupOpen(false);
      setMode('superadmin');
    } catch (e) {
      setSetupError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doAdminLogin = async () => {
    setBusy(true);
    setError('');
    try {
      const u = await login(username.trim(), password);
      navigate(u.role === 'cajero' ? '/cajero' : '/dashboard', { replace: true });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const pressKey = async (k: string) => {
    if (k === 'del') {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (pin.length >= 4) return;
    const next = pin + k;
    setPin(next);
    if (next.length === 4 && selected) {
      setBusy(true);
      setError('');
      try {
        const u = await loginPin(selected.username, next);
        navigate('/cajero', { replace: true });
      } catch (e) {
        setError((e as Error).message);
        setPin('');
      } finally {
        setBusy(false);
      }
    }
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">
          <div className="logo-big">🎪</div>
          <h1>Eventos POS</h1>
          <p>Ventas, entradas y recaudación para tu evento</p>
          <p className="muted" style={{ fontSize: 12 }}>v{APP_VERSION}</p>
        </div>

        <div className="login-tabs">
          <button className={mode === 'superadmin' ? 'active' : ''} onClick={() => { setMode('superadmin'); setError(''); }}>
            ⭐ Superadmin
          </button>
          <button className={mode === 'admin' ? 'active' : ''} onClick={() => { setMode('admin'); setError(''); }}>
            👤 Admin
          </button>
          <button className={mode === 'cajero' ? 'active' : ''} onClick={() => { setMode('cajero'); setError(''); setPin(''); setSelected(null); }}>
            🛒 Cajero
          </button>
        </div>

        {mode === 'cajero' ? (
          <>
            {cashiers.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">👥</div>
                <div className="empty-title">No hay cajeros creados</div>
                <div style={{ fontSize: 13 }}>El administrador debe crear cajeros desde Usuarios</div>
              </div>
            ) : (
              <>
                <div className="user-select">
                  {cashiers.map((c) => (
                    <button
                      key={c.id}
                      className={`user-option ${selected?.id === c.id ? 'active' : ''}`}
                      onClick={() => { setSelected(c); setPin(''); setError(''); }}
                    >
                      <div style={{ fontSize: 26 }}>🧑‍💼</div>
                      <div>{c.name}</div>
                    </button>
                  ))}
                </div>
                {selected && (
                  <>
                    <div className="pin-display">{'●'.repeat(pin.length)}{'○'.repeat(4 - pin.length)}</div>
                    <div className="pin-grid">
                      {keys.map((k) =>
                        k === '' ? (
                          <div key="empty" />
                        ) : (
                          <button key={k} className="pin-key" onClick={() => pressKey(k)} disabled={busy}>
                            {k === 'del' ? '⌫' : k}
                          </button>
                        ),
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </>
        ) : (
          <>
            <div className="field">
              <label>Usuario o email</label>
              <input
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="usuario@email.com"
                autoComplete="username"
              />
            </div>
            <div className="field">
              <label>Contraseña</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                onKeyDown={(e) => e.key === 'Enter' && doAdminLogin()}
                autoComplete="current-password"
              />
            </div>
            <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={doAdminLogin} disabled={busy}>
              {busy ? 'Ingresando…' : 'Ingresar'}
            </button>
          </>
        )}

        {error && (
          <div className="mt-16" style={{ background: 'var(--danger-soft)', color: 'var(--danger)', padding: '10px 12px', borderRadius: 10, fontWeight: 700, fontSize: 13.5 }}>
            {error}
          </div>
        )}
      </div>

      <Modal open={setupOpen} onClose={() => !busy && setSetupOpen(false)} title="Primera configuración" size="sm">
        <p className="muted" style={{ fontSize: 13.5, marginBottom: 14 }}>
          Creá la cuenta del <b>Superadministrador</b> (con email y contraseña). Esta cuenta creará administradores y cajeros.
        </p>
        <div className="field">
          <label>Nombre</label>
          <input className="input" value={setup.name} onChange={(e) => setSetup({ ...setup, name: e.target.value })} placeholder="Tu nombre" />
        </div>
        <div className="field">
          <label>Email</label>
          <input className="input" type="email" value={setup.email} onChange={(e) => setSetup({ ...setup, email: e.target.value })} placeholder="admin@miempresa.com" />
        </div>
        <div className="field">
          <label>Contraseña (mínimo 6 caracteres)</label>
          <input className="input" type="password" value={setup.password} onChange={(e) => setSetup({ ...setup, password: e.target.value })} placeholder="••••••••" />
        </div>
        <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={doSetup} disabled={busy}>
          {busy ? 'Creando…' : 'Crear superadministrador'}
        </button>
        {setupError && (
          <div className="mt-16" style={{ background: 'var(--danger-soft)', color: 'var(--danger)', padding: '10px 12px', borderRadius: 10, fontWeight: 700, fontSize: 13.5 }}>
            {setupError}
          </div>
        )}
      </Modal>
    </div>
  );
}