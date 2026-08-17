import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { logger } from '../logger';

export interface DbConfig {
  dataDir?: string;
}

let moduleDir = '';
try {
  moduleDir = path.dirname(fileURLToPath(import.meta.url));
} catch {
  /* vacío en el bundle CJS; schemaFile() usa __dirname en ese caso */
}

function schemaFile(): string {
  const candidates: string[] = [];
  if (typeof __dirname === 'string') candidates.push(path.join(__dirname, 'schema.sql'));
  candidates.push(path.join(moduleDir, 'schema.sql'));
  for (const c of candidates) {
    try {
      if (existsSync(c)) return c;
    } catch {
      /* noop */
    }
  }
  throw new Error('No se encontró schema.sql');
}

let db: DatabaseSync | null = null;
let dataDir = '';

export function initDb(config: DbConfig = {}) {
  dataDir = config.dataDir ?? process.env.EVENTOS_DATA_DIR ?? path.join(process.cwd(), 'data');
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, 'eventos.db');
  db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec('PRAGMA synchronous = NORMAL');
  const schema = readFileSync(schemaFile(), 'utf8');
  db.exec(schema);
  logger.info('db', `Base de datos inicializada en ${dbPath}`);
  return db;
}

export function getDb(): DatabaseSync {
  if (!db) throw new Error('Base de datos no inicializada');
  return db;
}

export function getDataDir(): string {
  return dataDir;
}

export function checkpointWal() {
  try {
    db?.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  } catch {
    /* noop */
  }
}

export function closeDb() {
  if (db) {
    try {
      db.close();
    } catch {
      /* noop */
    }
    db = null;
  }
}

export function reopenDb() {
  closeDb();
  return initDb({ dataDir });
}

export function runInTransaction<T>(fn: () => T): T {
  const d = getDb();
  d.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    d.exec('COMMIT');
    return result;
  } catch (e) {
    try {
      d.exec('ROLLBACK');
    } catch {
      /* noop */
    }
    throw e;
  }
}

export function nextSeq(name: string): number {
  const d = getDb();
  const row = d
    .prepare('UPDATE seq SET value = value + 1 WHERE name = ? RETURNING value')
    .get(name) as { value: number } | undefined;
  if (row) return row.value;
  d.prepare('INSERT INTO seq (name, value) VALUES (?, ?)').run(name, 1);
  return 1;
}

export function getRow<T>(sql: string, ...params: unknown[]): T | undefined {
  return getDb().prepare(sql).get(...(params as SQLInputValue[])) as T | undefined;
}

export function allRows<T>(sql: string, ...params: unknown[]): T[] {
  return getDb().prepare(sql).all(...(params as SQLInputValue[])) as T[];
}

export function exec(sql: string, ...params: unknown[]) {
  const stmt = getDb().prepare(sql);
  const res = stmt.run(...(params as SQLInputValue[]));
  return { changes: Number(res.changes), lastInsertRowid: Number(res.lastInsertRowid) };
}