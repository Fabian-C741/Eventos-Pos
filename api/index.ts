import type { IncomingMessage, ServerResponse } from 'node:http';
import { initDb, getDb } from '../src/server/db/db';
import { createApp } from '../src/server/app';

let initPromise: Promise<unknown> | null = null;
let app: ReturnType<typeof createApp> | null = null;

async function handleDiag(res: ServerResponse) {
  const out: Record<string, unknown> = { ok: false, timestamp: new Date().toISOString() };
  try {
    out.db_url_set = !!process.env.DATABASE_URL;
    if (process.env.DATABASE_URL) {
      const m = process.env.DATABASE_URL.match(/^[^:]+:\/\/[^:]+:([^@]*)@([^:]+):(\d+)\/([^?]+)/);
      out.db_host = m ? m[2] : 'formato-invalido';
      out.db_port = m ? m[3] : null;
      out.db_name = m ? m[4] : null;
      out.db_password_set = !!m?.[1];
      out.db_url_invalid = !m;
    }
    out.tz = process.env.TZ || null;
    await initDb({});
    const sql = getDb() as unknown as { unsafe: (q: string) => Promise<{ one: number }[]> };
    const rows = await (sql.unsafe as (q: string) => Promise<{ one: number }[]>)('SELECT 1 AS one');
    out.select_1 = rows[0]?.one;
    out.ok = true;
  } catch (e) {
    out.error = (e as Error).message;
    out.stack = (e as Error).stack?.split('\n').slice(0, 8).join(' | ');
  }
  res.statusCode = out.ok ? 200 : 500;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(out, null, 2));
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const path = (req.url || '').split('?')[0];
  if (path === '/api/diag' || path === '/api/diag/') {
    await handleDiag(res);
    return;
  }
  if (!initPromise) {
    initPromise = initDb().then(() => {
      app = createApp();
    });
  }
  try {
    await initPromise;
    (app as unknown as (r: IncomingMessage, s: ServerResponse) => void)(req, res);
  } catch (e) {
    initPromise = null;
    const message = (e as Error).message || 'Error interno del servidor';
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: message, code: 'SERVER_ERROR' }));
  }
}