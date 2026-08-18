import { BadRequest } from '../errors';
import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync, unlinkSync } from 'fs';
import path from 'path';
import { getDataDir, closeDb, reopenDb, checkpointWal } from '../db/db';
import { logger } from '../logger';
import { audit } from './audit.service';
import type { BackupInfo } from '../../shared/types';

const IS_CLOUD = !!process.env.DATABASE_URL;

function cloudDisabled(what: string): never {
  throw BadRequest(`En la versión nube los backups se manejan con los nativos de ${what === 'Supabase' ? 'Supabase' : 'la plataforma'}.`);
}

export interface BackupService {
  backupsDir: string;
  createBackup(userId?: number | null): Promise<BackupInfo>;
  listBackups(): Promise<BackupInfo[]>;
  deleteBackup(name: string): Promise<boolean>;
  restoreBackup(name: string): Promise<void>;
  autoBackupIfEnabled(): Promise<void>;
}

export function initBackupService(): BackupService {
  const backupsDir = path.join(process.cwd(), 'backups');
  try {
    if (!existsSync(backupsDir)) mkdirSync(backupsDir, { recursive: true });
  } catch {
    /* noop */
  }

  const stamp = () => {
    const d = new Date();
    const pad = (x: number) => String(x).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  };

  async function createBackup(userId?: number | null): Promise<BackupInfo> {
    if (IS_CLOUD) cloudDisabled('Supabase');
    const src = path.join(getDataDir(), 'eventos.db');
    const name = `backup_${stamp()}.db`;
    const dest = path.join(backupsDir, name);
    if (!existsSync(src)) throw BadRequest('No hay base de datos que respaldar');
    await checkpointWal();
    copyFileSync(src, dest);
    const info = infoFor(dest);
    logger.info('backup', `Backup creado: ${name}`);
    await audit(userId ?? null, 'backup', 'backup', null, { name });
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

  async function listBackups(): Promise<BackupInfo[]> {
    if (IS_CLOUD) return [];
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

  async function deleteBackup(name: string): Promise<boolean> {
    if (IS_CLOUD) cloudDisabled('Supabase');
    const safe = path.basename(name);
    if (!safe.startsWith('backup_')) throw BadRequest('Nombre de backup inválido');
    const full = path.join(backupsDir, safe);
    if (!existsSync(full)) throw BadRequest('Backup no encontrado');
    unlinkSync(full);
    return true;
  }

  async function restoreBackup(name: string): Promise<void> {
    if (IS_CLOUD) cloudDisabled('Supabase');
    const safe = path.basename(name);
    const full = path.join(backupsDir, safe);
    if (!existsSync(full)) throw BadRequest('Backup no encontrado');
    const target = path.join(getDataDir(), 'eventos.db');
    const journal = path.join(getDataDir(), 'eventos.db-wal');
    const shm = path.join(getDataDir(), 'eventos.db-shm');
    await checkpointWal();
    await closeDb();
    try {
      for (const extra of [journal, shm]) {
        if (existsSync(extra)) unlinkSync(extra);
      }
      copyFileSync(full, target);
      logger.info('backup', `Backup restaurado: ${safe}`);
      await audit(null, 'restore', 'backup', null, { name: safe });
    } finally {
      await reopenDb();
    }
  }

  async function autoBackupIfEnabled(): Promise<void> {
    if (IS_CLOUD) return;
    const { getSetting } = require('./settings.service') as typeof import('./settings.service');
    if ((await getSetting('auto_backup')) === '1') {
      try {
        await createBackup(null);
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
