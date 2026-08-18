import type { IncomingMessage, ServerResponse } from 'node:http';
import { initDb } from '../src/server/db/db';
import { createApp } from '../src/server/app';

let initPromise: Promise<unknown> | null = null;
let app: ReturnType<typeof createApp> | null = null;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!initPromise) {
    initPromise = initDb().then(() => {
      app = createApp();
    });
  }
  try {
    await initPromise;
    (app as unknown as (r: IncomingMessage, s: ServerResponse) => void)(req, res);
  } catch (e) {
    const message = (e as Error).message || 'Error interno del servidor';
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: message, code: 'SERVER_ERROR' }));
  }
}