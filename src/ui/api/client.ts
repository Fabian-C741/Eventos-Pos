import { friendlyError } from '../../shared/format';

const TOKEN_KEY = 'epos_token';
const QUEUE_KEY = 'epos_offline_queue';

export class ApiError extends Error {
  code?: string;
  status: number;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* noop */
  }
}

export function getUserCache(): unknown {
  try {
    const raw = localStorage.getItem('epos_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setUserCache(user: unknown) {
  try {
    if (user) localStorage.setItem('epos_user', JSON.stringify(user));
    else localStorage.removeItem('epos_user');
  } catch {
    /* noop */
  }
}

async function request<T>(method: string, path: string, body?: unknown, opts: { silent?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch('/api' + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new ApiError('Sin conexión con el servidor', 0, 'NETWORK');
  }
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* no body */
  }
  if (!res.ok) {
    const message = json?.error || `Error ${res.status}`;
    const code = json?.code;
    if (res.status === 401 && code === 'UNAUTHORIZED' && !opts.silent) {
      setToken(null);
      setUserCache(null);
      window.dispatchEvent(new CustomEvent('epos:logout'));
    }
    throw new ApiError(friendlyError(message), res.status, code);
  }
  return json as T;
}

export const api = {
  get: <T>(path: string, opts?: { silent?: boolean }) => request<T>('GET', path, undefined, opts),
  post: <T>(path: string, body?: unknown, opts?: { silent?: boolean }) => request<T>('POST', path, body, opts),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};

// ===== Cola offline de ventas =====
export interface QueuedSale {
  id: string;
  payload: unknown;
  created_at: string;
  status: 'pendiente';
}

export function getQueue(): QueuedSale[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveQueue(q: QueuedSale[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-1000)));
  } catch {
    /* noop */
  }
}

export function queueSale(payload: unknown): QueuedSale {
  const item: QueuedSale = {
    id: Math.random().toString(36).slice(2) + Date.now().toString(36),
    payload,
    created_at: new Date().toISOString(),
    status: 'pendiente',
  };
  const q = getQueue();
  q.push(item);
  saveQueue(q);
  return item;
}

export function removeQueued(id: string) {
  saveQueue(getQueue().filter((x) => x.id !== id));
}

// Intenta subir la cola pendiente; devuelve cantidad subida
export async function flushQueue(): Promise<number> {
  const q = getQueue();
  if (!q.length) return 0;
  let pushed = 0;
  for (const item of q) {
    try {
      await request<unknown>('POST', '/sales', item.payload, { silent: true });
      removeQueued(item.id);
      pushed++;
    } catch {
      break;
    }
  }
  return pushed;
}

export function hasPendingQueue(): boolean {
  return getQueue().length > 0;
}

export function logClientError(module: string, message: string, details?: unknown) {
  try {
    api.post('/system/log/client', { level: 'error', module, message, details }, { silent: true }).catch(() => {});
  } catch {
    /* noop */
  }
}