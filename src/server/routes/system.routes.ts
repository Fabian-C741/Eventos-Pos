import { Router, Response } from 'express';
import { existsSync } from 'fs';
import path from 'path';
import { requireAuth, requireRole, AuthedRequest } from '../auth';
import { getSettings, setSetting, listAppLogs, listAudit } from '../services/settings.service';
import { initBackupService, exportDatabaseCopy } from '../services/backup.service';
import { logger } from '../logger';
import { parseOptionalInt } from './helpers';
import { getDataDir } from '../db/db';

const router = Router();
router.use(requireAuth);

const backup = initBackupService();

// ----- Settings (superadmin) -----
router.get('/settings', requireRole('superadmin'), (_req, res) => {
  res.json(getSettings());
});

router.put('/settings', requireRole('superadmin'), (req: AuthedRequest, res, next) => {
  try {
    const { key, value } = req.body;
    setSetting(String(key), String(value), req.user!.id);
    res.json(getSettings());
  } catch (e) {
    next(e);
  }
});

// ----- Logs (solo superadmin) -----
router.get('/logs', requireRole('superadmin'), (req: AuthedRequest, res) => {
  const q = req.query as Record<string, string>;
  res.json(
    listAppLogs({
      level: q.level,
      from: q.from,
      to: q.to,
      module: q.module,
      limit: parseOptionalInt(q.limit) ?? 200,
    }),
  );
});

router.get('/audit', requireRole('superadmin'), (req: AuthedRequest, res) => {
  const q = req.query as Record<string, string>;
  res.json(
    listAudit({
      user_id: parseOptionalInt(q.user_id),
      from: q.from,
      to: q.to,
      limit: parseOptionalInt(q.limit) ?? 200,
    }),
  );
});

// ----- Backups (solo superadmin) -----
router.get('/backups', requireRole('superadmin'), (_req, res) => {
  res.json(backup.listBackups());
});

router.post('/backups', requireRole('superadmin'), (req: AuthedRequest, res, next) => {
  try {
    const info = backup.createBackup(req.user!.id);
    res.json(info);
  } catch (e) {
    next(e);
  }
});

router.delete('/backups/:name', requireRole('superadmin'), (req: AuthedRequest, res, next) => {
  try {
    backup.deleteBackup(decodeURIComponent(req.params.name));
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.post('/backups/:name/restore', requireRole('superadmin'), (req: AuthedRequest, res, next) => {
  try {
    backup.restoreBackup(decodeURIComponent(req.params.name));
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.get('/backups/download/:name', requireRole('superadmin'), (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const safe = path.basename(name);
  const full = path.join(backup.backupsDir, safe);
  if (!existsSync(full)) {
    res.status(404).json({ error: 'Backup no encontrado' });
    return;
  }
  res.download(full, safe);
});

router.get('/db/download', requireRole('superadmin'), (_req, res) => {
  const src = path.join(getDataDir(), 'eventos.db');
  if (!existsSync(src)) {
    res.status(404).json({ error: 'No hay base de datos' });
    return;
  }
  res.download(src, 'eventos_pos_backup.db');
});

// ----- Health -----
router.get('/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

router.post('/log/client', (req: AuthedRequest, res) => {
  const { level, module, message, details } = req.body || {};
  logger.log({
    level: ['info', 'warn', 'error', 'fatal'].includes(level) ? level : 'error',
    module: String(module || 'client'),
    message: String(message || 'Error de cliente'),
    details,
    userId: req.user?.id,
    device: req.device,
  });
  res.json({ ok: true });
});

export default router;