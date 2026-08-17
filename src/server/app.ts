import express from 'express';
import path from 'path';
import { existsSync } from 'fs';
import authRoutes from './routes/auth.routes';
import dataRoutes from './routes/data.routes';
import salesRoutes from './routes/sales.routes';
import closesRoutes from './routes/closes.routes';
import dashboardRoutes from './routes/dashboard.routes';
import systemRoutes from './routes/system.routes';
import { errorHandler } from './auth';
import { logger } from './logger';
import { getDb } from './db/db';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));

  logger.setDbSink((entry) => {
    try {
      getDb()
        .prepare(
          'INSERT INTO app_logs (level, module, message, details, user_id, device) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run(entry.level, entry.module, entry.message, entry.details != null ? String(entry.details) : null, entry.userId ?? null, entry.device ?? null);
    } catch {
      /* noop */
    }
  });

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    );
    next();
  });

  app.use('/api/auth', authRoutes);
  app.use('/api', dataRoutes);
  app.use('/api/sales', salesRoutes);
  app.use('/api/closes', closesRoutes);
  app.use('/api', dashboardRoutes);
  app.use('/api', systemRoutes);

  const publicDir = [path.join(process.cwd(), 'dist', 'public'), path.join(process.cwd(), 'public')].find((p) => existsSync(p));
  if (publicDir) {
    app.use(express.static(publicDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(publicDir, 'index.html'));
    });
  } else {
    app.get('/', (_req, res) => {
      res.send('Servidor Eventos POS corriendo. Ejecutá el frontend con `npm run dev`');
    });
  }

  app.use(errorHandler);
  return app;
}

export function startServer(port = 4100) {
  const app = createApp();
  const server = app.listen(port, '0.0.0.0', () => {
    logger.info('server', `Servidor escuchando en http://localhost:${port}`);
  });
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      logger.error('server', `El puerto ${port} ya está en uso`, err);
    } else {
      logger.error('server', 'Error del servidor', err);
    }
  });
  return server;
}