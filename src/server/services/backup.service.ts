import { BadRequest } from '../errors';
import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync, unlinkSync, renameSync } from 'fs';
import path from 'path';
import { getDataDir, closeDb, reopenDb, checkpointWal } from '../db/db';
import { logger } from '../logger';
import { audit } from './audit.service';
import type { BackupInfo } from '../../shared/types';

export interface BackupService {
  backupsDir: string;
  createBackup(userId?: number | null): BackupInfo;
  listBackups(): BackupInfo[];
  deleteBackup(name: string): boolean;
  restoreBackup(name: string): void;
  autoBackupIfEnabled(): void;
}

export function initBackupService(): BackupService {
  const backupsDir = path.join(process.cwd(), 'backups');
  if (!existsSync(backupsDir)) mkdirSync(backupsDir, { recursive: true });

  const stamp = () => {
    const d = new Date();
    const pad = (x: number) => String(x).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  };

  function createBackup(userId?: number | null): BackupInfo {
    const src = path.join(getDataDir(), 'eventos.db');
    const name = `backup_${stamp()}.db`;
    const dest = path.join(backupsDir, name);
    if (!existsSync(src)) throw BadRequest('No hay base de datos que respaldar');
    checkpointWal();
    copyFileSync(src, dest);
    const info = infoFor(dest);
    logger.info('backup', `Backup creado: ${name}`);
    audit(userId ?? null, 'backup', 'backup', null, { name });
    return info;
  }

  function infoFor(p: string): BackupInfo {
    const st = statSync(p);
    return {
      name: path.basename(p),
      size: st.size,
      created_at: st.mtime.toISOString(),
    };
  }

  function listBackups(): BackupInfo[] {
    if (!existsSync(backupsDir)) return [];
    const list: BackupInfo[] = readdirSync(backupsDir)
      .filter((f) => f.endsWith('.db'))
      .map((f) => {
        try {
          return infoFor(path.join(backupsDir, f));
        } catch {
          return null;
        }
      })
      .filter((x): x is BackupInfo => x !== null);
    return list.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }

  function deleteBackup(name: string): boolean {
    const safe = path.basename(name);
    if (!safe.startsWith('backup_')) throw BadRequest('Nombre de backup inválido');
    const full = path.join(backupsDir, safe);
    if (!existsSync(full)) throw BadRequest('Backup no encontrado');
    unlinkSync(full);
    return true;
  }

  function restoreBackup(name: string): void {
    const safe = path.basename(name);
    const full = path.join(backupsDir, safe);
    if (!existsSync(full)) throw BadRequest('Backup no encontrado');
    const target = path.join(getDataDir(), 'eventos.db');
    const journal = path.join(getDataDir(), 'eventos.db-wal');
    const shm = path.join(getDataDir(), 'eventos.db-shm');
    checkpointWal();
    closeDb();
    try {
      for (const extra of [journal, shm]) {
        if (existsSync(extra)) unlinkSync(extra);
      }
      copyFileSync(full, target);
      logger.info('backup', `Backup restaurado: ${safe}`);
      audit(null, 'restore', 'backup', null, { name: safe });
    } finally {
      reopenDb();
    }
  }

  function autoBackupIfEnabled() {
    const { getSetting } = require('./settings.service') as typeof import('./settings.service');
    if (getSetting('auto_backup') === '1') {
      try {
        createBackup(null);
      } catch (e) {
        logger.error('backup', 'Error en backup automático', e);
      }
    }
  }

  return { backupsDir, createBackup, listBackups, deleteBackup, restoreBackup, autoBackupIfEnabled };
}

export function exportDatabaseCopy(): string {
  const src = path.join(getDataDir(), 'eventos.db');
  if (!existsSync(src)) throw BadRequest('No hay base de datos');
  return src;
}