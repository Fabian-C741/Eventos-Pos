import { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { APP_VERSION } from '../../../shared/constants';

interface NavItem {
  to: string;
  icon: string;
  label: string;
  section?: string;
  roles?: string[];
}

const NAV: NavItem[] = [
  { to: '/dashboard', icon: '📊', label: 'Dashboard', section: 'Administración' },
  { to: '/eventos', icon: '🗓️', label: 'Eventos' },
  { to: '/productos', icon: '🧺', label: 'Productos' },
  { to: '/entradas', icon: '🎟️', label: 'Entradas' },
  { to: '/cajas', icon: '🗄️', label: 'Cajas' },
  { to: '/usuarios', icon: '👥', label: 'Usuarios', roles: ['superadmin', 'admin'] },
  { to: '/ventas', icon: '🧾', label: 'Ventas' },
  { to: '/cierres', icon: '🔒', label: 'Cierres de caja' },
  { to: '/reportes', icon: '📄', label: 'Reportes' },
  { to: '/backups', icon: '💾', label: 'Backups', roles: ['superadmin'] },
  { to: '/logs', icon: '🛠️', label: 'Logs y auditoría', roles: ['superadmin'] },
  { to: '/config', icon: '⚙️', label: 'Configuración', roles: ['superadmin', 'admin'] },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { activeEvent } = useData();
  const navigate = useNavigate();

  const items = NAV.filter((n) => !n.roles || (user && n.roles.includes(user.role)));

  const sections: { label: string; items: NavItem[] }[] = [];
  for (const item of items) {
    const section = item.section ?? 'Gestión';
    let sec = sections.find((s) => s.label === section);
    if (!sec) {
      sec = { label: section, items: [] };
      sections.push(sec);
    }
    sec.items.push(item);
  }

  const initials = (user?.name || user?.username || '?').slice(0, 2).toUpperCase();

  const renderNav = (vertical: boolean) => (
    <>
      {sections.map((sec) => (
        <div key={sec.label}>
          {vertical && <div className="nav-section-label">{sec.label}</div>}
          {sec.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => window.scrollTo(0, 0)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      ))}
    </>
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="logo">🎪</span>
          <span>Eventos POS</span>
        </div>
        <nav className="sidebar-nav">{renderNav(true)}</nav>
        <div className="sidebar-version">v{APP_VERSION}</div>
        <div className="sidebar-user">
          <div className="avatar">{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 13.5, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.name}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--sidebar-text)' }}>
              {user?.role === 'superadmin' ? 'Superadministrador' : user?.role === 'admin' ? 'Administrador' : 'Cajero'}
            </div>
          </div>
          <button
            className="icon-btn"
            title="Salir"
            style={{ background: 'transparent', border: '1px solid #334155', color: '#fff' }}
            onClick={() => { const p = user?.role === 'cajero' ? '/cajero' : user?.role === 'admin' ? '/admin' : '/login'; logout().then(() => navigate(p)); }}
          >
            ⎋
          </button>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <span className="page-title">{activeEvent ? activeEvent.name : 'Sin evento seleccionado'}</span>
          <span className="topbar-spacer" />
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/cajero')}>
            🛒 Modo cajero
          </button>
        </div>
        <div className="content">{children}</div>
      </div>

      <nav className="bottom-nav">{renderNav(false)}</nav>
    </div>
  );
}