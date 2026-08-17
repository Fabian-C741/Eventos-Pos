import { ReactNode } from 'react';

export function Spinner() {
  return <div className="spinner" />;
}

export function EmptyState({ icon, title, subtitle, children }: { icon: string; title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <div className="empty-title">{title}</div>
      {subtitle && <div style={{ fontSize: 13.5, marginTop: 4 }}>{subtitle}</div>}
      {children && <div className="mt-16">{children}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <div className="muted" style={{ fontSize: 13.5 }}>{subtitle}</div>}
      </div>
      <div className="row">{children}</div>
    </div>
  );
}

export function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: ReactNode;
  error?: string;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {error && <div className="error-text">{error}</div>}
    </div>
  );
}

export function StatBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="progress-row">
      <div className="bar-label" title={label}>{label}</div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${Math.max(pct, 2)}%`, background: color }} />
      </div>
      <div className="bar-value">{value.toLocaleString('es-AR')}</div>
    </div>
  );
}

export function MoneyStatBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="progress-row">
      <div className="bar-label" title={label}>{label}</div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${Math.max(pct, 2)}%`, background: color }} />
      </div>
      <div className="bar-value">${value.toLocaleString('es-AR')}</div>
    </div>
  );
}