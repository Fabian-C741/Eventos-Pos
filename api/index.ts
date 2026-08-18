// @ts-nocheck
const db = require('../src/server/db/db');
const appModule = require('../src/server/app');

let initPromise = null;
let app = null;

async function handleDiag(res) {
  const out = { ok: false, timestamp: new Date().toISOString() };
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
    await db.initDb({});
    const rows = await db.getDb().unsafe('SELECT 1 AS one');
    out.select_1 = rows[0]?.one;
    out.ok = true;
  } catch (e) {
    out.error = (e && e.message) || String(e);
    out.stack = (e && e.stack ? e.stack.split('\n').slice(0, 8).join(' | ') : '');
  }
  res.statusCode = out.ok ? 200 : 500;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(out, null, 2));
}

async function handler(req, res) {
  const path = (req.url || '').split('?')[0];
  if (path === '/api/diag' || path === '/api/diag/') {
    await handleDiag(res);
    return;
  }
  if (!initPromise) {
    initPromise = db.initDb().then(() => {
      app = appModule.createApp();
    });
  }
  try {
    await initPromise;
    app(req, res);
  } catch (e) {
    initPromise = null;
    const message = (e && e.message) || 'Error interno del servidor';
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: message, code: 'SERVER_ERROR' }));
  }
}

module.exports = handler;