export function formatMoney(amount: number): string {
  const n = Number(amount) || 0;
  return '$' + Math.round(n).toLocaleString('es-AR');
}

export function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso.replace(' ', 'T'));
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso.replace(' ', 'T'));
  if (isNaN(d.getTime())) return iso;
  return (
    d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  );
}

export function formatTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso.replace(' ', 'T'));
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function formatNumber(n: number): string {
  return Math.round(Number(n) || 0).toLocaleString('es-AR');
}

export function padNumber(num: number, digits: number): string {
  return String(num).padStart(digits, '0');
}

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function nowLocalIso(): string {
  const d = new Date();
  const pad = (x: number) => String(x).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

export function friendlyError(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { message?: string; friendly?: string };
    if (e.friendly) return e.friendly;
    if (e.message) return e.message;
  }
  if (typeof err === 'string') return err;
  return 'Ocurrió un error inesperado';
}