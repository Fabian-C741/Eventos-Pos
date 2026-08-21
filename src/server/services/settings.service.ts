import { BadRequest } from '../errors';
import { allRows, exec, getRow } from '../db/db';
import { audit } from './audit.service';
import type { AppSettings } from '../../shared/types';

const DEFAULT_SETTINGS: Record<string, string> = {
  app_name: 'Eventos POS',
  sound_enabled: '1',
  auto_backup: '1',
  device_name: 'Caja central',
  currency_symbol: '$',
  receipt_footer: '',
  login_logo: '',
  payment_tarjeta: '0',
};

export async function getSetting(key: string): Promise<string> {
  const row = await getRow<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  if (row) return row.value;
  const def = DEFAULT_SETTINGS[key];
  if (def !== undefined) {
    await exec('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', key, def);
    return def;
  }
  return '';
}

export async function getSettings(): Promise<AppSettings> {
  return {
    app_name: await getSetting('app_name'),
    sound_enabled: await getSetting('sound_enabled'),
    auto_backup: await getSetting('auto_backup'),
    device_name: await getSetting('device_name'),
    currency_symbol: await getSetting('currency_symbol'),
    receipt_footer: await getSetting('receipt_footer'),
    login_logo: await getSetting('login_logo'),
    payment_tarjeta: await getSetting('payment_tarjeta'),
  };
}

export async function setSetting(key: string, value: string, userId: number) {
  const allowed = Object.keys(DEFAULT_SETTINGS);
  if (!allowed.includes(key)) throw BadRequest('Configuración no válida');
  const maxLen = key === 'login_logo' ? 100000 : 200;
  await exec('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, String(value).slice(0, maxLen));
  await audit(userId, 'update', 'settings', null, { key });
  return true;
}

export async function clearAppLogs() {
  await exec('DELETE FROM app_logs');
  return true;
}

export async function pruneAppLogs(days = 30) {
  await exec('DELETE FROM app_logs WHERE created_at < ?', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());
  return true;
}

let lastLogPrune = 0;

export async function listAppLogs(filters: { level?: string; from?: string; to?: string; module?: string; limit?: number }): Promise<unknown[]> {
  const now = Date.now();
  if (now - lastLogPrune > 60 * 60 * 1000) {
    lastLogPrune = now;
    try {
      await pruneAppLogs();
    } catch {
      /* noop */
    }
  }
  const where: string[] = [];
  const params: unknown[] = [];
  if (filters.level) {
    where.push('level = ?');
    params.push(filters.level);
  }
  if (filters.module) {
    where.push('module LIKE ?');
    params.push('%' + filters.module + '%');
  }
  if (filters.from) {
    where.push('created_at >= ?');
    params.push(filters.from + ' 00:00:00');
  }
  if (filters.to) {
    where.push('created_at <= ?');
    params.push(filters.to + ' 23:59:59');
  }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const limit = Math.min(filters.limit ?? 200, 1000);
  return allRows(
    `SELECT id, level, module, message, details, user_id, device, created_at
     FROM app_logs ${whereSql} ORDER BY id DESC LIMIT ?`,
    ...params,
    limit,
  );
}

export async function listAudit(filters: { user_id?: number; from?: string; to?: string; limit?: number }): Promise<unknown[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filters.user_id) {
    where.push('user_id = ?');
    params.push(filters.user_id);
  }
  if (filters.from) {
    where.push('created_at >= ?');
    params.push(filters.from + ' 00:00:00');
  }
  if (filters.to) {
    where.push('created_at <= ?');
    params.push(filters.to + ' 23:59:59');
  }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const limit = Math.min(filters.limit ?? 200, 1000);
  return allRows(
    `SELECT a.id, a.user_id, u.name AS user_name, a.action, a.entity, a.entity_id, a.details, a.created_at
     FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
     ${whereSql} ORDER BY a.id DESC LIMIT ?`,
    ...params,
    limit,
  );
}
