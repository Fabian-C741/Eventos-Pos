import { useNavigate } from 'react-router-dom';
import { APP_VERSION } from '../../../shared/constants';

export function NotFoundScreen() {
  const navigate = useNavigate();

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">
          <div className="logo-big">🔎</div>
          <h1>Página no encontrada</h1>
          <p>La dirección que escribiste no existe en el sistema.</p>
          <p className="muted" style={{ fontSize: 12 }}>v{APP_VERSION}</p>
        </div>
        <div className="field" style={{ textAlign: 'center' }}>
          <p className="muted" style={{ fontSize: 13 }}>
            Revisá la dirección: <b>/login</b> (superadmin) · <b>/admin</b> (admin) · <b>/cajero</b> (cajero)
          </p>
        </div>
        <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={() => navigate('/', { replace: true })}>
          Volver al inicio
        </button>
      </div>
    </div>
  );
}