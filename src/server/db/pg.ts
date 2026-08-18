import postgres from 'postgres';
import { logger } from '../logger';

export interface DbConfig {
  dataDir?: string;
}

const TZ = process.env.EVENTOS_TZ || 'America/Argentina/Buenos_Aires';
process.env.TZ = process.env.TZ || TZ;

const OID_BIGINT = 20;
const OID_NUMERIC = 1700;

let sql: ReturnType<typeof postgres> | null = null;
let postgresFactory: typeof postgres = postgres;

export function _setPostgresFactoryForTest(fn: typeof postgres) {
  postgresFactory = fn;
}

let chain: Promise<unknown> = Promise.resolve();
let inTx = false;

function runLocked<T>(fn: () => Promise<T>): Promise<T> {
  if (inTx) return fn();
  const run = chain.then(async () => {
    inTx = true;
    try {
      return await fn();
    } finally {
      inTx = false;
    }
  });
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function translateSql(sqlText: string): string {
  let out = sqlText.replace(/datetime\('now','localtime'\)/g, 'NOW()');
  out = out.replace(
    /CAST\(strftime\('%H',\s*(\w+\.created_at)\)\s*AS\s*INTEGER\)/g,
    'CAST(EXTRACT(HOUR FROM $1) AS INTEGER)',
  );
  out = out.replace(/substr\((\w+\.created_at),\s*1,\s*10\)/g, "to_char($1, 'YYYY-MM-DD')");
  if (/^\s*INSERT\s+OR\s+IGNORE\s+INTO/i.test(out)) {
    out = out.replace(/^\s*INSERT\s+OR\s+IGNORE\s+INTO/i, 'INSERT INTO') + ' ON CONFLICT DO NOTHING';
  }
  let i = 0;
  out = out.replace(/\?/g, () => `$${++i}`);
  return out;
}

function fmtLocal(d: Date): string {
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function normalizeRow<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = v instanceof Date ? fmtLocal(v) : v;
  }
  return out as T;
}

function getSql() {
  if (!sql) throw new Error('Base de datos no inicializada');
  return sql;
}

export async function initDb(_config: DbConfig = {}) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL no definida para el modo nube');
  sql = postgresFactory(url, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connection: {
      application_name: 'eventos-pos',
      options: `-c timezone=${TZ}`,
    },
    types: {
      bigint: {
        to: OID_BIGINT,
        from: [OID_BIGINT],
        serialize: (x: unknown) => String(x),
        parse: (x: string) => Number(x),
      },
      numeric: {
        to: OID_NUMERIC,
        from: [OID_NUMERIC],
        serialize: (x: unknown) => String(x),
        parse: (x: string) => Number(x),
      },
    },
  } as never);
  logger.info('db', 'Conexión a Postgres inicializada');
  return sql;
}

export function getDb(): ReturnType<typeof postgres> {
  return getSql();
}

export function getDataDir(): string {
  return process.cwd();
}

export async function checkpointWal() {
  /* noop: WAL administrado por Postgres */
}

export async function closeDb() {
  if (sql) {
    try {
      await sql.end({ timeout: 5 });
    } catch {
      /* noop */
    }
    sql = null;
  }
}

export async function reopenDb() {
  await closeDb();
  return initDb({});
}

export async function runInTransaction<T>(fn: () => T | Promise<T>): Promise<T> {
  return runLocked(async () => {
    const s = getSql();
    await s.unsafe('BEGIN');
    try {
      const result = await fn();
      await s.unsafe('COMMIT');
      return result;
    } catch (e) {
      try {
        await s.unsafe('ROLLBACK');
      } catch {
        /* noop */
      }
      throw e;
    }
  });
}

export async function nextSeq(name: string): Promise<number> {
  return runLocked(async () => {
    const s = getSql();
    const rows = await s.unsafe<Record<string, unknown>[]>(
      'UPDATE seq SET value = value + 1 WHERE name = $1 RETURNING value',
      [name],
    );
    if (rows.length > 0) return Number(rows[0].value);
    await s.unsafe('INSERT INTO seq (name, value) VALUES ($1, 1)', [name]);
    return 1;
  });
}

export async function getRow<T>(sqlText: string, ...params: unknown[]): Promise<T | undefined> {
  const rows = await runLocked(async () => {
    const s = getSql();
    return s.unsafe<Record<string, unknown>[]>(translateSql(sqlText), params as never[]);
  });
  return rows[0] ? normalizeRow<T>(rows[0]) : undefined;
}

export async function allRows<T>(sqlText: string, ...params: unknown[]): Promise<T[]> {
  const rows = await runLocked(async () => {
    const s = getSql();
    return s.unsafe<Record<string, unknown>[]>(translateSql(sqlText), params as never[]);
  });
  return rows.map((r) => normalizeRow<T>(r));
}

export async function exec(sqlText: string, ...params: unknown[]) {
  return runLocked(async () => {
    const s = getSql();
    let query = translateSql(sqlText);
    const isInsert = /^\s*INSERT/i.test(query);
    if (isInsert && !/RETURNING/i.test(query)) {
      query += ' RETURNING id';
    }
    const rows = await s.unsafe<Record<string, unknown>[]>(query, params as never[]);
    if (isInsert && rows.length > 0) {
      return { changes: rows.length, lastInsertRowid: Number(rows[0].id) };
    }
    return { changes: rows.length, lastInsertRowid: 0 };
  });
}

export async function insertAppLog(
  level: string,
  module: string,
  message: string,
  details: unknown,
  userId: number | null,
  device?: string,
) {
  try {
    await exec(
      'INSERT INTO app_logs (level, module, message, details, user_id, device) VALUES (?, ?, ?, ?, ?, ?)',
      level,
      module,
      message,
      details != null ? String(details) : null,
      userId ?? null,
      device ?? null,
    );
  } catch {
    /* noop */
  }
}
