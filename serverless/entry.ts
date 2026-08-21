// @ts-nocheck
// Fuente del bundle serverless/index.cjs. NO es el entry de Vercel (api/index.ts lo re-exporta).
const db = require('../src/server/db/db');
const appModule = require('../src/server/app');

let initPromise = null;
let app = null;

async function handler(req, res) {
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