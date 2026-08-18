// @ts-nocheck
// Fuente del bundle serverless/index.cjs. NO es el entry de Vercel (api/index.ts lo re-exporta).
const db = require('../src/server/db/db');
const appModule = require('../src/server/app');

let initPromise = null;
let app = null;

function log(step, detail) {
  console.log('[diag] ' + step + ' ' + (detail || ''));
}

async function handleDiag(res) {
  const out = { ok: false, timestamp: new Date().toISOString() };
  const finish = () => {
    try {
      res.statusCode = out.ok ? 200 : 500;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(out, null, 2));
    } catch (e) {
      log('finish-error', (e && e.message) || String(e));
    }
  };
  try {
    const url = process.env.DATABASE_URL || '';
    out.db_url_set = !!url;
    out.db_url_len = url.length;
    out.db_url_tail = url.slice(-12);
    log('step1', 'url_set=' + out.db_url_set + ' len=' + url.length);
    if (url) {
      try {
        const u = new URL(url);
        out.url_parse = 'ok:' + u.hostname + ':' + u.port;
      } catch (e) {
        out.url_parse = 'FAIL:' + ((e && e.message) || String(e));
      }
      const m = url.match(/^[^:]+:\/\/[^:]+:([^@]*)@([^:]+):(\d+)\/([^?]+)/);
      out.db_host = m ? m[2] : 'formato-invalido';
      out.db_port = m ? m[3] : null;
      out.db_name = m ? m[4] : null;
      out.db_password_set = !!m?.[1];
      out.db_url_invalid = !m;
      const pwd = (m && m[1]) || '';
      out.db_url_masked = url.replace(/:[^@]*@/, ':***@');
      out.pwd_len = pwd.length;
      out.pwd_has_hash = pwd.includes('#');
      out.pwd_has_pct23 = pwd.includes('%23');
      out.pwd_has_bracket = /[\[\]]/.test(pwd);
      out.pwd_has_space = /\s/.test(pwd);
      out.pwd_mask = pwd.slice(0, 3) + '...' + pwd.slice(-2);
    }
    log('step2', 'initDb');
    await db.initDb({});
    log('step3', 'initDb ok');
    const s = db.getDb();
    if (s && typeof s.on === 'function') {
      s.on('error', (e) => log('db-error', (e && e.message) || String(e)));
    }
    log('step4', 'select 1');
    const rows = await Promise.race([
      Promise.resolve(s.unsafe('SELECT 1 AS one')),
      new Promise((_, rej) => setTimeout(() => rej(new Error('TIMEOUT select 1')), 8000)),
    ]);
    log('step5', 'select1=' + String(rows[0]?.one));
    out.select_1 = rows[0]?.one;
    out.ok = true;
  } catch (e) {
    log('error', (e && e.message) || String(e));
    out.error = (e && e.message) || String(e);
    out.stack = e && e.stack ? e.stack.split('\n').slice(0, 8).join(' | ') : '';
  }
  finish();
}

async function handler(req, res) {
  const path = (req.url || '').split('?')[0];
  if (path === '/api/diag' || path === '/api/diag/') {
    try {
      await handleDiag(res);
    } catch (e) {
      log('handler-error', (e && e.message) || String(e));
      try {
        res.statusCode = 500;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ error: (e && e.message) || 'Error', code: 'DIAG_ERROR' }));
      } catch (e2) {
        /* noop */
      }
    }
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