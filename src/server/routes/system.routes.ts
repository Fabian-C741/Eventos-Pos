import { Router, Response } from 'express';
import { existsSync } from 'fs';
import path from 'path';
import { requireAuth, requireRole, AuthedRequest } from '../auth';
import { getSettings, setSetting, listAppLogs, listAudit, clearAppLogs } from '../services/settings.service';
import { initBackupService, exportDatabaseCopy } from '../services/backup.service';
import { logger } from '../logger';
import { parseOptionalInt } from './helpers';
import { getDataDir } from '../db/db';

const router = Router();
router.use(requireAuth);

const IS_CLOUD = !!process.env.DATABASE_URL;
const backup = initBackupService();

// ----- Settings (superadmin) -----
router.get('/settings', requireRole('superadmin'), async (_req, res) => {
  res.json(await getSettings());
});

router.put('/settings', requireRole('superadmin'), async (req: AuthedRequest, res, next) => {
  try {
    const body = req.body || {};
    if ('key' in body && 'value' in body) {
      await setSetting(String(body.key), String(body.value), req.user!.id);
    } else {
      for (const [k, v] of Object.entries(body)) {
        if (v !== undefined && v !== null) await setSetting(k, String(v), req.user!.id);
      }
    }
    res.json(await getSettings());
  } catch (e) {
    next(e);
  }
});

// ----- Logs (solo superadmin) -----
router.get('/logs', requireRole('superadmin'), async (req: AuthedRequest, res) => {
  const q = req.query as Record<string, string>;
  res.json(
    await listAppLogs({
      level: q.level,
      from: q.from,
      to: q.to,
      module: q.module,
      limit: parseOptionalInt(q.limit) ?? 200,
    }),
  );
});

router.delete('/logs', requireRole('superadmin'), async (_req: AuthedRequest, res) => {
  await clearAppLogs();
  res.json({ ok: true });
});

router.get('/audit', requireRole('superadmin'), async (req: AuthedRequest, res) => {
  const q = req.query as Record<string, string>;
  res.json(
    await listAudit({
      user_id: parseOptionalInt(q.user_id),
      from: q.from,
      to: q.to,
      limit: parseOptionalInt(q.limit) ?? 200,
    }),
  );
});

// ----- Backups (solo superadmin) -----
router.get('/backups', requireRole('superadmin'), async (_req, res) => {
  res.json(await backup.listBackups());
});

router.post('/backups', requireRole('superadmin'), async (req: AuthedRequest, res, next) => {
  try {
    const info = await backup.createBackup(req.user!.id);
    res.json(info);
  } catch (e) {
    next(e);
  }
});

router.delete('/backups/:name', requireRole('superadmin'), async (req: AuthedRequest, res, next) => {
  try {
    await backup.deleteBackup(decodeURIComponent(req.params.name));
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.post('/backups/:name/restore', requireRole('superadmin'), async (req: AuthedRequest, res, next) => {
  try {
    await backup.restoreBackup(decodeURIComponent(req.params.name));
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.get('/backups/download/:name', requireRole('superadmin'), (req: AuthedRequest, res) => {
  if (IS_CLOUD) {
    res.status(400).json({ error: 'En la versión nube los backups se manejan con los nativos de Supabase', code: 'VALIDATION' });
    return;
  }
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
  if (IS_CLOUD) {
    res.status(400).json({ error: 'En la versión nube los datos se administran desde Supabase', code: 'VALIDATION' });
    return;
  }
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

router.get('/time', (_req: AuthedRequest, res) => {
  const d = new Date();
  const pad = (x: number) => String(x).padStart(2, '0');
  res.json({
    iso: d.toISOString(),
    local: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
    epoch: d.getTime(),
  });
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