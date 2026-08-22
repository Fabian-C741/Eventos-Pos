"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/server/logger.ts
var import_fs, import_path, Logger, logger;
var init_logger = __esm({
  "src/server/logger.ts"() {
    "use strict";
    import_fs = require("fs");
    import_path = __toESM(require("path"));
    Logger = class {
      logDir;
      db;
      maxAgeDays = 30;
      constructor(logDir) {
        this.logDir = logDir;
        try {
          if (!(0, import_fs.existsSync)(logDir)) (0, import_fs.mkdirSync)(logDir, { recursive: true });
          this.rotate();
        } catch {
        }
      }
      setDbSink(fn) {
        this.db = fn;
      }
      fileFor(date) {
        const d = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        return import_path.default.join(this.logDir, `${d}.log`);
      }
      writeFile(entry) {
        const line = `[${(/* @__PURE__ */ new Date()).toISOString()}] [${entry.level.toUpperCase()}] [${entry.module}] ${entry.message}` + (entry.userId ? ` | user=${entry.userId}` : "") + (entry.device ? ` | device=${entry.device}` : "") + (entry.details !== void 0 ? ` | ${typeof entry.details === "string" ? entry.details : JSON.stringify(entry.details)}` : "") + "\n";
        try {
          (0, import_fs.appendFileSync)(this.fileFor(/* @__PURE__ */ new Date()), line, "utf8");
        } catch {
        }
      }
      log(entry) {
        this.writeFile(entry);
        const msg = `[${entry.level.toUpperCase()}] [${entry.module}] ${entry.message}`;
        if (entry.level === "error" || entry.level === "fatal") {
          console.error(msg, entry.details ?? "");
        } else if (entry.level === "warn") {
          console.warn(msg);
        } else {
          console.log(msg);
        }
        if (this.db && (entry.level === "error" || entry.level === "fatal" || entry.level === "warn")) {
          try {
            this.db({
              level: entry.level,
              module: entry.module,
              message: entry.message,
              details: entry.details !== void 0 ? JSON.stringify(entry.details) : null,
              userId: entry.userId ?? null,
              device: entry.device
            });
          } catch {
          }
        }
      }
      info(module2, message, details, userId, device) {
        this.log({ level: "info", module: module2, message, details, userId, device });
      }
      warn(module2, message, details, userId, device) {
        this.log({ level: "warn", module: module2, message, details, userId, device });
      }
      error(module2, message, details, userId, device) {
        this.log({ level: "error", module: module2, message, details, userId, device });
      }
      fatal(module2, message, details, userId, device) {
        this.log({ level: "fatal", module: module2, message, details, userId, device });
      }
      rotate() {
        try {
          const cutoff = Date.now() - this.maxAgeDays * 24 * 60 * 60 * 1e3;
          for (const file of (0, import_fs.readdirSync)(this.logDir)) {
            const full = import_path.default.join(this.logDir, file);
            try {
              const st = (0, import_fs.statSync)(full);
              if (st.mtimeMs < cutoff) (0, import_fs.rmSync)(full, { force: true });
            } catch {
            }
          }
        } catch {
        }
      }
    };
    logger = new Logger(import_path.default.join(process.cwd(), "logs"));
  }
});

// src/server/db/sqlite.ts
var sqlite_exports = {};
__export(sqlite_exports, {
  allRows: () => allRows,
  checkpointWal: () => checkpointWal,
  closeDb: () => closeDb,
  exec: () => exec,
  getDataDir: () => getDataDir,
  getDb: () => getDb,
  getRow: () => getRow,
  initDb: () => initDb,
  insertAppLog: () => insertAppLog,
  nextSeq: () => nextSeq,
  reopenDb: () => reopenDb,
  runInTransaction: () => runInTransaction
});
function schemaFile() {
  const candidates = [];
  if (typeof __dirname === "string") candidates.push(import_path2.default.join(__dirname, "schema.sql"));
  candidates.push(import_path2.default.join(moduleDir, "schema.sql"));
  for (const c of candidates) {
    try {
      if ((0, import_fs2.existsSync)(c)) return c;
    } catch {
    }
  }
  throw new Error("No se encontr\xF3 schema.sql");
}
async function initDb(config = {}) {
  const { DatabaseSync } = nodeRequire("node:sqlite");
  dataDir = config.dataDir ?? process.env.EVENTOS_DATA_DIR ?? import_path2.default.join(process.cwd(), "data");
  if (!(0, import_fs2.existsSync)(dataDir)) (0, import_fs2.mkdirSync)(dataDir, { recursive: true });
  const dbPath = import_path2.default.join(dataDir, "eventos.db");
  db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec("PRAGMA synchronous = NORMAL");
  const schema = (0, import_fs2.readFileSync)(schemaFile(), "utf8");
  db.exec(schema);
  const userCols = new Set(db.prepare("PRAGMA table_info(users)").all().map((c) => c.name));
  if (!userCols.has("pos_categories")) db.exec("ALTER TABLE users ADD COLUMN pos_categories TEXT");
  if (!userCols.has("pos_tickets")) db.exec("ALTER TABLE users ADD COLUMN pos_tickets INTEGER NOT NULL DEFAULT 1");
  if (!userCols.has("owner_id")) db.exec("ALTER TABLE users ADD COLUMN owner_id INTEGER");
  if (!userCols.has("pos_box_id")) db.exec("ALTER TABLE users ADD COLUMN pos_box_id INTEGER");
  const eventCols = new Set(db.prepare("PRAGMA table_info(events)").all().map((c) => c.name));
  if (!eventCols.has("owner_id")) db.exec("ALTER TABLE events ADD COLUMN owner_id INTEGER");
  const boxCols = new Set(db.prepare("PRAGMA table_info(boxes)").all().map((c) => c.name));
  if (!boxCols.has("pos_categories")) db.exec("ALTER TABLE boxes ADD COLUMN pos_categories TEXT");
  if (!boxCols.has("pos_tickets")) db.exec("ALTER TABLE boxes ADD COLUMN pos_tickets INTEGER NOT NULL DEFAULT 1");
  logger.info("db", `Base de datos inicializada en ${dbPath}`);
  return db;
}
function getDb() {
  if (!db) throw new Error("Base de datos no inicializada");
  return db;
}
function getDataDir() {
  return dataDir;
}
async function checkpointWal() {
  try {
    db?.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  } catch {
  }
}
async function closeDb() {
  if (db) {
    try {
      db.close();
    } catch {
    }
    db = null;
  }
}
async function reopenDb() {
  await closeDb();
  return initDb({ dataDir });
}
async function runInTransaction(fn) {
  const d = getDb();
  d.exec("BEGIN IMMEDIATE");
  try {
    const result = await fn();
    d.exec("COMMIT");
    return result;
  } catch (e) {
    try {
      d.exec("ROLLBACK");
    } catch {
    }
    throw e;
  }
}
async function nextSeq(name) {
  const d = getDb();
  const row = d.prepare("UPDATE seq SET value = value + 1 WHERE name = ? RETURNING value").get(name);
  if (row) return row.value;
  d.prepare("INSERT INTO seq (name, value) VALUES (?, ?)").run(name, 1);
  return 1;
}
async function getRow(sql2, ...params) {
  return getDb().prepare(sql2).get(...params);
}
async function allRows(sql2, ...params) {
  return getDb().prepare(sql2).all(...params);
}
async function exec(sql2, ...params) {
  const stmt = getDb().prepare(sql2);
  const res = stmt.run(...params);
  return { changes: Number(res.changes), lastInsertRowid: Number(res.lastInsertRowid) };
}
async function insertAppLog(level, module2, message, details, userId, device) {
  try {
    await exec(
      "INSERT INTO app_logs (level, module, message, details, user_id, device) VALUES (?, ?, ?, ?, ?, ?)",
      level,
      module2,
      message,
      details != null ? String(details) : null,
      userId ?? null,
      device ?? null
    );
  } catch {
  }
}
var import_node_module, import_fs2, import_path2, import_node_url, import_meta, nodeRequire, moduleDir, db, dataDir;
var init_sqlite = __esm({
  "src/server/db/sqlite.ts"() {
    "use strict";
    import_node_module = require("node:module");
    import_fs2 = require("fs");
    import_path2 = __toESM(require("path"));
    import_node_url = require("node:url");
    init_logger();
    import_meta = {};
    nodeRequire = (0, import_node_module.createRequire)(typeof __filename !== "undefined" ? __filename : import_meta.url);
    moduleDir = "";
    try {
      moduleDir = import_path2.default.dirname((0, import_node_url.fileURLToPath)(import_meta.url));
    } catch {
    }
    db = null;
    dataDir = "";
  }
});

// src/server/db/pg.ts
var pg_exports = {};
__export(pg_exports, {
  _setPostgresFactoryForTest: () => _setPostgresFactoryForTest,
  allRows: () => allRows2,
  checkpointWal: () => checkpointWal2,
  closeDb: () => closeDb2,
  exec: () => exec2,
  getDataDir: () => getDataDir2,
  getDb: () => getDb2,
  getRow: () => getRow2,
  initDb: () => initDb2,
  insertAppLog: () => insertAppLog2,
  nextSeq: () => nextSeq2,
  reopenDb: () => reopenDb2,
  runInTransaction: () => runInTransaction2,
  sanitizePgUrl: () => sanitizePgUrl,
  translateSql: () => translateSql
});
function _setPostgresFactoryForTest(fn) {
  postgresFactory = fn;
}
function runLocked(fn) {
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
    () => void 0,
    () => void 0
  );
  return run;
}
function translateSql(sqlText) {
  let out = sqlText.replace(/datetime\('now','localtime'\)/g, "NOW()");
  out = out.replace(
    /CAST\(strftime\('%H',\s*(\w+\.created_at)\)\s*AS\s*INTEGER\)/g,
    "CAST(EXTRACT(HOUR FROM $1) AS INTEGER)"
  );
  out = out.replace(/substr\((\w+\.created_at),\s*1,\s*10\)/g, "to_char($1, 'YYYY-MM-DD')");
  if (/^\s*INSERT\s+OR\s+IGNORE\s+INTO/i.test(out)) {
    out = out.replace(/^\s*INSERT\s+OR\s+IGNORE\s+INTO/i, "INSERT INTO") + " ON CONFLICT DO NOTHING";
  }
  let i = 0;
  out = out.replace(/\?/g, () => `$${++i}`);
  return out;
}
function fmtLocal(d) {
  const pad = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function normalizeRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = v instanceof Date ? fmtLocal(v) : v;
  }
  return out;
}
function getSql() {
  if (!sql) throw new Error("Base de datos no inicializada");
  return sql;
}
function sanitizePgUrl(rawUrl) {
  const url = String(rawUrl || "").replace(/^[\uFEFF\u00A0]+/, "").trim();
  try {
    new URL(url);
    return url;
  } catch {
    const m = url.match(/^([^:]+:\/\/[^:]+:)([^@]*)@(.*)$/);
    if (m) {
      const encoded = m[2].replace(/%/g, "%25").replace(/[^A-Za-z0-9\-._~]/g, (c) => encodeURIComponent(c));
      return `${m[1]}${encoded}@${m[3]}`;
    }
    throw new Error("DATABASE_URL inv\xE1lida");
  }
}
async function initDb2(_config = {}) {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) throw new Error("DATABASE_URL no definida para el modo nube");
  const url = sanitizePgUrl(rawUrl);
  sql = postgresFactory(url, {
    max: 5,
    ssl: { rejectUnauthorized: false },
    connection: {
      application_name: "eventos-pos",
      options: `-c timezone=${TZ}`
    },
    types: {
      bigint: {
        to: OID_BIGINT,
        from: [OID_BIGINT],
        serialize: (x) => String(x),
        parse: (x) => Number(x)
      },
      numeric: {
        to: OID_NUMERIC,
        from: [OID_NUMERIC],
        serialize: (x) => String(x),
        parse: (x) => Number(x)
      }
    }
  });
  try {
    await sql.unsafe(
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS pos_categories TEXT; ALTER TABLE users ADD COLUMN IF NOT EXISTS pos_tickets INTEGER NOT NULL DEFAULT 1; ALTER TABLE users ADD COLUMN IF NOT EXISTS owner_id INTEGER; ALTER TABLE users ADD COLUMN IF NOT EXISTS pos_box_id INTEGER; ALTER TABLE events ADD COLUMN IF NOT EXISTS owner_id INTEGER; ALTER TABLE boxes ADD COLUMN IF NOT EXISTS pos_categories TEXT; ALTER TABLE boxes ADD COLUMN IF NOT EXISTS pos_tickets INTEGER NOT NULL DEFAULT 1;"
    );
  } catch {
  }
  logger.info("db", "Conexi\xF3n a Postgres inicializada");
  return sql;
}
function getDb2() {
  return getSql();
}
function getDataDir2() {
  return process.cwd();
}
async function checkpointWal2() {
}
async function closeDb2() {
  if (sql) {
    try {
      await sql.end({ timeout: 5 });
    } catch {
    }
    sql = null;
  }
}
async function reopenDb2() {
  await closeDb2();
  return initDb2({});
}
async function runInTransaction2(fn) {
  return runLocked(async () => {
    const s = getSql();
    await s.unsafe("BEGIN");
    try {
      const result = await fn();
      await s.unsafe("COMMIT");
      return result;
    } catch (e) {
      try {
        await s.unsafe("ROLLBACK");
      } catch {
      }
      throw e;
    }
  });
}
async function nextSeq2(name) {
  return runLocked(async () => {
    const s = getSql();
    const rows = await s.unsafe(
      "UPDATE seq SET value = value + 1 WHERE name = $1 RETURNING value",
      [name]
    );
    if (rows.length > 0) return Number(rows[0].value);
    await s.unsafe("INSERT INTO seq (name, value) VALUES ($1, 1)", [name]);
    return 1;
  });
}
async function getRow2(sqlText, ...params) {
  const rows = await runLocked(async () => {
    const s = getSql();
    return s.unsafe(translateSql(sqlText), params);
  });
  return rows[0] ? normalizeRow(rows[0]) : void 0;
}
async function allRows2(sqlText, ...params) {
  const rows = await runLocked(async () => {
    const s = getSql();
    return s.unsafe(translateSql(sqlText), params);
  });
  return rows.map((r) => normalizeRow(r));
}
async function tableHasId(table) {
  if (idTables.has(table)) return true;
  const s = getSql();
  const rows = await s.unsafe(
    `SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'id') AS has`,
    [table]
  );
  const has = !!rows[0]?.has;
  if (has) idTables.add(table);
  return has;
}
async function exec2(sqlText, ...params) {
  return runLocked(async () => {
    const s = getSql();
    let query = translateSql(sqlText);
    const isInsert = /^\s*INSERT/i.test(query);
    if (isInsert && !/RETURNING/i.test(query)) {
      const m = query.match(/^\s*INSERT\s+INTO\s+([\w."]+)/i);
      const table = m?.[1]?.replace(/["']/g, "");
      if (table && await tableHasId(table)) {
        query += " RETURNING id";
      }
    }
    const rows = await s.unsafe(query, params);
    if (isInsert && rows.length > 0 && "id" in rows[0]) {
      return { changes: rows.length, lastInsertRowid: Number(rows[0].id) };
    }
    return { changes: rows.length, lastInsertRowid: 0 };
  });
}
async function insertAppLog2(level, module2, message, details, userId, device) {
  try {
    await exec2(
      "INSERT INTO app_logs (level, module, message, details, user_id, device) VALUES (?, ?, ?, ?, ?, ?)",
      level,
      module2,
      message,
      details != null ? String(details) : null,
      userId ?? null,
      device ?? null
    );
  } catch {
  }
}
var import_postgres, TZ, OID_BIGINT, OID_NUMERIC, sql, postgresFactory, chain, inTx, idTables;
var init_pg = __esm({
  "src/server/db/pg.ts"() {
    "use strict";
    import_postgres = __toESM(require("postgres"));
    init_logger();
    TZ = process.env.EVENTOS_TZ || "America/Argentina/Buenos_Aires";
    process.env.TZ = TZ;
    OID_BIGINT = 20;
    OID_NUMERIC = 1700;
    sql = null;
    postgresFactory = import_postgres.default;
    chain = Promise.resolve();
    inTx = false;
    idTables = /* @__PURE__ */ new Set();
  }
});

// src/server/db/db.ts
var db_exports = {};
__export(db_exports, {
  allRows: () => allRows3,
  checkpointWal: () => checkpointWal3,
  closeDb: () => closeDb3,
  exec: () => exec3,
  getDataDir: () => getDataDir3,
  getDb: () => getDb3,
  getRow: () => getRow3,
  initDb: () => initDb3,
  insertAppLog: () => insertAppLog3,
  nextSeq: () => nextSeq3,
  reopenDb: () => reopenDb3,
  runInTransaction: () => runInTransaction3
});
var impl, initDb3, getDb3, getDataDir3, checkpointWal3, closeDb3, reopenDb3, runInTransaction3, nextSeq3, getRow3, allRows3, exec3, insertAppLog3;
var init_db = __esm({
  "src/server/db/db.ts"() {
    "use strict";
    init_sqlite();
    init_pg();
    impl = process.env.DATABASE_URL ? pg_exports : sqlite_exports;
    initDb3 = impl.initDb;
    getDb3 = impl.getDb;
    getDataDir3 = impl.getDataDir;
    checkpointWal3 = impl.checkpointWal;
    closeDb3 = impl.closeDb;
    reopenDb3 = impl.reopenDb;
    runInTransaction3 = impl.runInTransaction;
    nextSeq3 = impl.nextSeq;
    getRow3 = impl.getRow;
    allRows3 = impl.allRows;
    exec3 = impl.exec;
    insertAppLog3 = impl.insertAppLog;
  }
});

// src/server/errors.ts
function BadRequest(message) {
  return Object.assign(new Error(message), { statusCode: 400 });
}
function NotFound(message) {
  return Object.assign(new Error(message), { statusCode: 404 });
}
var init_errors = __esm({
  "src/server/errors.ts"() {
    "use strict";
  }
});

// src/server/security.ts
function hashPassword(password) {
  const salt = (0, import_crypto.randomBytes)(16).toString("hex");
  const hash = (0, import_crypto.scryptSync)(password, salt, KEYLEN).toString("hex");
  return `${salt}:${hash}`;
}
function verifyPassword(password, stored) {
  try {
    const [salt, hash] = stored.split(":");
    if (!salt || !hash) return false;
    const test = (0, import_crypto.scryptSync)(password, salt, KEYLEN);
    const expected = Buffer.from(hash, "hex");
    return test.length === expected.length && (0, import_crypto.timingSafeEqual)(test, expected);
  } catch {
    return false;
  }
}
function randomToken(bytes = 32) {
  return (0, import_crypto.randomBytes)(bytes).toString("hex");
}
function safePin(pin) {
  return /^\d{4}$/.test(pin);
}
function sanitizeInput(value, maxLen = 200) {
  return String(value ?? "").trim().slice(0, maxLen);
}
var import_crypto, KEYLEN;
var init_security = __esm({
  "src/server/security.ts"() {
    "use strict";
    import_crypto = require("crypto");
    KEYLEN = 64;
  }
});

// src/server/services/auth.service.ts
function checkLocked(username) {
  const rec = loginAttempts.get(username);
  if (rec?.lockedUntil && rec.lockedUntil > Date.now()) {
    const mins = Math.max(1, Math.ceil((rec.lockedUntil - Date.now()) / 6e4));
    logger.warn("auth", `Intento de login bloqueado: ${username}`);
    throw BadRequest(`Demasiados intentos fallidos. Prob\xE1 de nuevo en ${mins} min.`);
  }
  if (rec?.lockedUntil && rec.lockedUntil <= Date.now()) loginAttempts.delete(username);
}
function recordFailedAttempt(username) {
  const rec = loginAttempts.get(username) ?? { fails: 0, lockedUntil: null };
  rec.fails += 1;
  if (rec.fails >= MAX_FAILED_ATTEMPTS) {
    rec.lockedUntil = Date.now() + LOCK_MINUTES * 60 * 1e3;
    rec.fails = 0;
    logger.warn("auth", `Cuenta bloqueada temporalmente por intentos fallidos: ${username}`);
  }
  loginAttempts.set(username, rec);
}
function recordSuccess(username) {
  loginAttempts.delete(username);
}
async function upsertSeqFor(name, base) {
  if (!await getRow3("SELECT name FROM seq WHERE name = ?", name)) {
    await exec3("INSERT INTO seq (name, value) VALUES (?, ?)", name, base);
  }
}
async function initSequenceCounters() {
  const events = await allRows3("SELECT id FROM events");
  for (const ev of events) {
    await upsertSeqFor(`event_op_${ev.id}`, "0");
  }
  const types = await allRows3("SELECT id, last_number FROM ticket_types");
  for (const t of types) {
    await upsertSeqFor(`ticket_${t.id}`, String(t.last_number ?? 0));
  }
}
async function needsSetup() {
  const row = await getRow3("SELECT COUNT(*) AS c FROM users");
  return (row?.c ?? 0) === 0;
}
async function createSuperadmin(email, password, name) {
  const emailNorm = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
    throw BadRequest("Ingres\xE1 un email v\xE1lido");
  }
  if (password.length < 6) {
    throw BadRequest("La contrase\xF1a debe tener al menos 6 caracteres");
  }
  if (!await needsSetup()) {
    throw BadRequest("El sistema ya est\xE1 configurado");
  }
  await exec3(
    "INSERT INTO users (username, password_hash, role, name) VALUES (?, ?, ?, ?)",
    emailNorm,
    hashPassword(password),
    "superadmin",
    name.trim() || "Super Administrador"
  );
  logger.info("auth", "Superadministrador creado");
  return true;
}
async function login(username, password, device) {
  const usernameNorm = username.trim().toLowerCase();
  checkLocked(usernameNorm);
  const user = await getRow3("SELECT * FROM users WHERE username = ? AND active = 1", usernameNorm);
  if (!user || !verifyPassword(password, user.password_hash)) {
    recordFailedAttempt(usernameNorm);
    logger.warn("auth", `Login fallido: ${usernameNorm}`, void 0, void 0, device);
    throw Object.assign(new Error("Usuario o contrase\xF1a incorrectos"), { friendly: "Usuario o contrase\xF1a incorrectos" });
  }
  recordSuccess(usernameNorm);
  return createSession(user, device);
}
async function loginPin(username, pin, device) {
  if (!safePin(pin)) {
    throw Object.assign(new Error("PIN inv\xE1lido"), { friendly: "El PIN debe tener 4 d\xEDgitos" });
  }
  const usernameNorm = username.trim().toLowerCase();
  checkLocked(usernameNorm);
  const user = await getRow3("SELECT * FROM users WHERE username = ? AND role = ? AND active = 1", usernameNorm, "cajero");
  if (!user || !verifyPassword(pin, user.password_hash)) {
    recordFailedAttempt(usernameNorm);
    logger.warn("auth", `Login PIN fallido: ${usernameNorm}`, void 0, void 0, device);
    throw Object.assign(new Error("PIN incorrecto"), { friendly: "PIN incorrecto. Prob\xE1 de nuevo" });
  }
  recordSuccess(usernameNorm);
  return createSession(user, device);
}
async function createSession(user, device) {
  const token = randomToken(32);
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1e3).toISOString();
  await exec3("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)", token, user.id, expires);
  await exec3("UPDATE users SET last_login_at = datetime('now','localtime') WHERE id = ?", user.id);
  logger.info("auth", `Login: ${user.username} (${user.role})`, void 0, user.id, device);
  const { password_hash: _ph, ...safe } = user;
  return { token, user: safe };
}
async function validateSession(token) {
  if (!token) return null;
  const row = await getRow3(
    `SELECT u.id, u.username, u.name, u.role, u.active, u.created_at, u.last_login_at, u.pos_categories, u.pos_tickets, u.pos_box_id, u.owner_id
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > ?`,
    token,
    (/* @__PURE__ */ new Date()).toISOString()
  );
  if (!row) return null;
  if (!row.active) return null;
  return row;
}
async function logout(token) {
  if (token) await exec3("DELETE FROM sessions WHERE token = ?", token);
}
async function listUsers(actor) {
  let filter = "";
  const params = [];
  if (actor.role === "admin") {
    filter = "WHERE role = ? AND owner_id = ?";
    params.push("cajero", actor.id);
  }
  return allRows3(
    `SELECT id, username, name, role, active, pos_categories, pos_tickets, pos_box_id, owner_id, created_at, last_login_at
     FROM users ${filter} ORDER BY CASE role WHEN 'superadmin' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, name`,
    ...params
  );
}
async function createUser(input, actor) {
  const { username, name, role } = input;
  const usernameNorm = username.trim().toLowerCase();
  if (!usernameNorm) throw BadRequest("El usuario es obligatorio");
  if (role === "superadmin" && actor.role !== "superadmin") throw BadRequest("Solo el superadministrador puede crear administradores");
  if (role === "admin" && actor.role !== "superadmin") throw BadRequest("Solo el superadministrador puede crear administradores");
  if (await getRow3("SELECT id FROM users WHERE username = ?", usernameNorm)) {
    throw BadRequest("Ese usuario ya existe");
  }
  let ownerId;
  if (role === "cajero") {
    if (actor.role === "admin") {
      ownerId = actor.id;
    } else {
      ownerId = input.owner_id ?? null;
    }
    if (ownerId !== null) {
      const owner = await getRow3("SELECT id FROM users WHERE id = ? AND role = ?", ownerId, "admin");
      if (!owner) throw BadRequest("El cajero debe pertenecer a un administrador");
    }
  } else {
    ownerId = null;
  }
  let pwd;
  if (role === "cajero") {
    const pin = input.pin ?? "0000";
    if (!safePin(pin)) throw BadRequest("El PIN debe tener 4 d\xEDgitos");
    pwd = hashPassword(pin);
  } else {
    if (!input.password || input.password.length < 6) throw BadRequest("La contrase\xF1a debe tener al menos 6 caracteres");
    pwd = hashPassword(input.password);
  }
  const res = await exec3(
    "INSERT INTO users (username, password_hash, role, name, pos_categories, pos_tickets, pos_box_id, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    usernameNorm,
    pwd,
    role,
    name.trim() || usernameNorm,
    role === "cajero" ? input.pos_categories ?? null : null,
    role === "cajero" ? input.pos_tickets ?? 1 : 1,
    role === "cajero" ? input.pos_box_id ?? null : null,
    ownerId
  );
  return res.lastInsertRowid;
}
async function updateUser(id, input, actor) {
  const target = await getRow3("SELECT * FROM users WHERE id = ?", id);
  if (!target) throw BadRequest("Usuario no encontrado");
  if (target.role === "superadmin" && target.id !== actor.id) throw BadRequest("No pod\xE9s modificar al superadministrador");
  if (actor.role === "admin") {
    if (target.role !== "cajero" || target.owner_id !== actor.id) throw BadRequest("Solo pod\xE9s modificar a tus cajeros");
  } else if (target.role === "admin" && actor.role !== "superadmin") {
    throw BadRequest("Solo el superadministrador puede modificar administradores");
  }
  if (input.name !== void 0) await exec3("UPDATE users SET name = ? WHERE id = ?", input.name.trim(), id);
  if (input.active !== void 0) await exec3("UPDATE users SET active = ? WHERE id = ?", input.active ? 1 : 0, id);
  if (input.password && target.role !== "cajero") {
    if (input.password.length < 6) throw BadRequest("La contrase\xF1a debe tener al menos 6 caracteres");
    await exec3("UPDATE users SET password_hash = ? WHERE id = ?", hashPassword(input.password), id);
  }
  if (input.pin && target.role === "cajero") {
    if (!safePin(input.pin)) throw BadRequest("El PIN debe tener 4 d\xEDgitos");
    await exec3("UPDATE users SET password_hash = ? WHERE id = ?", hashPassword(input.pin), id);
  }
  if (input.pos_categories !== void 0) await exec3("UPDATE users SET pos_categories = ? WHERE id = ?", input.pos_categories, id);
  if (input.pos_tickets !== void 0) await exec3("UPDATE users SET pos_tickets = ? WHERE id = ?", input.pos_tickets ? 1 : 0, id);
  if (input.pos_box_id !== void 0) await exec3("UPDATE users SET pos_box_id = ? WHERE id = ?", input.pos_box_id, id);
  if (input.owner_id !== void 0 && actor.role === "superadmin" && target.role === "cajero") {
    const ownerId = input.owner_id ?? null;
    if (ownerId !== null) {
      const owner = await getRow3("SELECT id FROM users WHERE id = ? AND role = ?", ownerId, "admin");
      if (!owner) throw BadRequest("El cajero debe pertenecer a un administrador");
    }
    await exec3("UPDATE users SET owner_id = ? WHERE id = ?", ownerId, id);
  }
  return true;
}
async function deleteUser(id, actor) {
  const target = await getRow3("SELECT * FROM users WHERE id = ?", id);
  if (!target) throw BadRequest("Usuario no encontrado");
  if (target.role === "superadmin") throw BadRequest("No se puede eliminar al superadministrador");
  if (actor.role === "admin") {
    if (target.role !== "cajero" || target.owner_id !== actor.id) throw BadRequest("Solo pod\xE9s eliminar a tus cajeros");
  } else if (target.role === "admin" && actor.role !== "superadmin") {
    throw BadRequest("Solo el superadministrador puede eliminar administradores");
  }
  const sales = await getRow3("SELECT COUNT(*) AS c FROM sales WHERE user_id = ?", id);
  if ((sales?.c ?? 0) > 0) {
    await exec3("UPDATE users SET active = 0 WHERE id = ?", id);
    return "disabled";
  }
  await exec3("DELETE FROM users WHERE id = ?", id);
  return "deleted";
}
async function listActiveCashiers() {
  return allRows3(
    `SELECT id, username, name, role, active, pos_categories, pos_tickets, owner_id, created_at, last_login_at
     FROM users WHERE role = 'cajero' AND active = 1 ORDER BY name`
  );
}
async function changeOwnPassword(userId, current, next) {
  const user = await getRow3("SELECT * FROM users WHERE id = ?", userId);
  if (!user || !verifyPassword(current, user.password_hash)) {
    throw BadRequest("La contrase\xF1a actual es incorrecta");
  }
  if (next.length < 6) throw BadRequest("La nueva contrase\xF1a debe tener al menos 6 caracteres");
  await exec3("UPDATE users SET password_hash = ? WHERE id = ?", hashPassword(next), userId);
  return true;
}
var SESSION_DAYS, MAX_FAILED_ATTEMPTS, LOCK_MINUTES, loginAttempts;
var init_auth_service = __esm({
  "src/server/services/auth.service.ts"() {
    "use strict";
    init_errors();
    init_db();
    init_security();
    init_logger();
    SESSION_DAYS = 14;
    MAX_FAILED_ATTEMPTS = 5;
    LOCK_MINUTES = 10;
    loginAttempts = /* @__PURE__ */ new Map();
  }
});

// src/server/services/audit.service.ts
async function audit(userId, action, entity, entityId, details) {
  try {
    await exec3(
      "INSERT INTO audit_log (user_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?)",
      userId,
      action,
      entity,
      entityId,
      details !== void 0 ? JSON.stringify(details) : null
    );
  } catch {
  }
}
var init_audit_service = __esm({
  "src/server/services/audit.service.ts"() {
    "use strict";
    init_db();
  }
});

// src/server/auth.ts
function attachDevice(req) {
  const viaHeader = req.headers["x-device"] || "";
  const viaUserAgent = req.headers["user-agent"] || "";
  return (viaHeader || viaUserAgent).slice(0, 120);
}
async function requireAuth(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    const user = await validateSession(token);
    if (!user) {
      res.status(401).json({ error: "Sesi\xF3n inv\xE1lida o expirada", code: "UNAUTHORIZED" });
      return;
    }
    req.user = user;
    req.device = attachDevice(req);
    next();
  } catch (e) {
    next(e);
  }
}
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: "No autenticado", code: "UNAUTHORIZED" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "No ten\xE9s permisos para esta acci\xF3n", code: "FORBIDDEN" });
      return;
    }
    next();
  };
}
function errorHandler(err, req, res, _next) {
  const friendly = err?.friendly;
  const statusCode = err?.statusCode;
  const message = err?.message || "Error interno del servidor";
  const stack = err?.stack;
  logger.error("api", message, { stack: stack?.slice(0, 1e3) }, req.user?.id, req.device);
  if (statusCode && statusCode < 500) {
    res.status(statusCode).json({ error: message, code: "VALIDATION" });
  } else if (friendly) {
    res.status(400).json({ error: friendly, code: "VALIDATION" });
  } else {
    res.status(500).json({ error: message, code: "SERVER_ERROR" });
  }
}
function asyncHandler(fn) {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
var init_auth = __esm({
  "src/server/auth.ts"() {
    "use strict";
    init_auth_service();
    init_logger();
  }
});

// src/server/services/settings.service.ts
var settings_service_exports = {};
__export(settings_service_exports, {
  clearAppLogs: () => clearAppLogs,
  getSetting: () => getSetting,
  getSettings: () => getSettings,
  listAppLogs: () => listAppLogs,
  listAudit: () => listAudit,
  pruneAppLogs: () => pruneAppLogs,
  setSetting: () => setSetting
});
async function getSetting(key) {
  const row = await getRow3("SELECT value FROM settings WHERE key = ?", key);
  if (row) return row.value;
  const def = DEFAULT_SETTINGS[key];
  if (def !== void 0) {
    await exec3("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", key, def);
    return def;
  }
  return "";
}
async function getSettings() {
  return {
    app_name: await getSetting("app_name"),
    sound_enabled: await getSetting("sound_enabled"),
    auto_backup: await getSetting("auto_backup"),
    device_name: await getSetting("device_name"),
    currency_symbol: await getSetting("currency_symbol"),
    receipt_footer: await getSetting("receipt_footer"),
    login_logo: await getSetting("login_logo"),
    payment_tarjeta: await getSetting("payment_tarjeta")
  };
}
async function setSetting(key, value, userId) {
  const allowed = Object.keys(DEFAULT_SETTINGS);
  if (!allowed.includes(key)) throw BadRequest("Configuraci\xF3n no v\xE1lida");
  const maxLen = key === "login_logo" ? 1e5 : 200;
  await exec3("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", key, String(value).slice(0, maxLen));
  await audit(userId, "update", "settings", null, { key });
  return true;
}
async function clearAppLogs() {
  await exec3("DELETE FROM app_logs");
  return true;
}
async function pruneAppLogs(days = 30) {
  await exec3("DELETE FROM app_logs WHERE created_at < ?", new Date(Date.now() - days * 24 * 60 * 60 * 1e3).toISOString());
  return true;
}
async function listAppLogs(filters) {
  const now = Date.now();
  if (now - lastLogPrune > 60 * 60 * 1e3) {
    lastLogPrune = now;
    try {
      await pruneAppLogs();
    } catch {
    }
  }
  const where = [];
  const params = [];
  if (filters.level) {
    where.push("level = ?");
    params.push(filters.level);
  }
  if (filters.module) {
    where.push("module LIKE ?");
    params.push("%" + filters.module + "%");
  }
  if (filters.from) {
    where.push("created_at >= ?");
    params.push(filters.from + " 00:00:00");
  }
  if (filters.to) {
    where.push("created_at <= ?");
    params.push(filters.to + " 23:59:59");
  }
  const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";
  const limit = Math.min(filters.limit ?? 200, 1e3);
  return allRows3(
    `SELECT id, level, module, message, details, user_id, device, created_at
     FROM app_logs ${whereSql} ORDER BY id DESC LIMIT ?`,
    ...params,
    limit
  );
}
async function listAudit(filters) {
  const where = [];
  const params = [];
  if (filters.user_id) {
    where.push("user_id = ?");
    params.push(filters.user_id);
  }
  if (filters.from) {
    where.push("created_at >= ?");
    params.push(filters.from + " 00:00:00");
  }
  if (filters.to) {
    where.push("created_at <= ?");
    params.push(filters.to + " 23:59:59");
  }
  const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";
  const limit = Math.min(filters.limit ?? 200, 1e3);
  return allRows3(
    `SELECT a.id, a.user_id, u.name AS user_name, a.action, a.entity, a.entity_id, a.details, a.created_at
     FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
     ${whereSql} ORDER BY a.id DESC LIMIT ?`,
    ...params,
    limit
  );
}
var DEFAULT_SETTINGS, lastLogPrune;
var init_settings_service = __esm({
  "src/server/services/settings.service.ts"() {
    "use strict";
    init_errors();
    init_db();
    init_audit_service();
    DEFAULT_SETTINGS = {
      app_name: "Eventos POS",
      sound_enabled: "1",
      auto_backup: "1",
      device_name: "Caja central",
      currency_symbol: "$",
      receipt_footer: "",
      login_logo: "",
      payment_tarjeta: "0"
    };
    lastLogPrune = 0;
  }
});

// src/server/routes/auth.routes.ts
var import_express, router, auth_routes_default;
var init_auth_routes = __esm({
  "src/server/routes/auth.routes.ts"() {
    "use strict";
    import_express = require("express");
    init_auth_service();
    init_security();
    init_audit_service();
    init_auth();
    init_logger();
    init_auth_service();
    init_settings_service();
    router = (0, import_express.Router)();
    router.get("/login-config", asyncHandler(async (_req, res) => {
      res.json({ app_name: await getSetting("app_name"), login_logo: await getSetting("login_logo") });
    }));
    router.get("/pos-config", requireAuth, asyncHandler(async (_req, res) => {
      res.json({ tarjeta: await getSetting("payment_tarjeta") === "1" });
    }));
    router.get("/status", asyncHandler(async (_req, res) => {
      res.json({ setup: await needsSetup() });
    }));
    router.get("/cashiers", asyncHandler(async (_req, res) => {
      res.json(await listActiveCashiers());
    }));
    router.post("/setup", async (req, res, next) => {
      try {
        if (!await needsSetup()) {
          res.status(400).json({ error: "El sistema ya est\xE1 configurado", code: "VALIDATION" });
          return;
        }
        await createSuperadmin(
          sanitizeInput(req.body.email, 100),
          String(req.body.password ?? ""),
          sanitizeInput(req.body.name, 100)
        );
        logger.info("auth", "Setup completado");
        res.json({ ok: true });
      } catch (e) {
        next(e);
      }
    });
    router.post("/login", async (req, res, next) => {
      try {
        const device = attachDevice(req);
        const { token, user } = await login(
          sanitizeInput(req.body.username, 100),
          String(req.body.password ?? ""),
          device
        );
        await audit(user.id, "login", "session", null, { device });
        res.json({ token, user });
      } catch (e) {
        next(e);
      }
    });
    router.post("/login/pin", async (req, res, next) => {
      try {
        const device = attachDevice(req);
        const { token, user } = await loginPin(
          sanitizeInput(req.body.username, 100),
          String(req.body.pin ?? ""),
          device
        );
        await audit(user.id, "login_pin", "session", null, { device });
        res.json({ token, user });
      } catch (e) {
        next(e);
      }
    });
    router.post("/logout", requireAuth, asyncHandler(async (req, res) => {
      const token = (req.headers.authorization || "").replace("Bearer ", "");
      await logout(token);
      res.json({ ok: true });
    }));
    router.get("/me", requireAuth, asyncHandler(async (req, res) => {
      res.json(req.user);
    }));
    router.post("/change-password", requireAuth, async (req, res, next) => {
      try {
        await changeOwnPassword(req.user.id, String(req.body.current ?? ""), String(req.body.next ?? ""));
        await audit(req.user.id, "change_password", "user", req.user.id, {});
        res.json({ ok: true });
      } catch (e) {
        next(e);
      }
    });
    router.post("/init-sequences", requireAuth, asyncHandler(async (_req, res) => {
      await initSequenceCounters();
      res.json({ ok: true });
    }));
    auth_routes_default = router;
  }
});

// src/server/services/events.service.ts
function tenantScope(actor) {
  if (actor.role === "superadmin") return "all";
  if (actor.role === "admin") return actor.id;
  return actor.owner_id ?? "none";
}
async function canAccessEvent(actor, eventId) {
  const scope = tenantScope(actor);
  if (scope === "none") return false;
  if (scope === "all") {
    return !!await getRow3("SELECT id FROM events WHERE id = ?", eventId);
  }
  return !!await getRow3("SELECT id FROM events WHERE id = ? AND owner_id = ?", eventId, scope);
}
async function assertEventAccess(actor, eventId) {
  if (!await canAccessEvent(actor, eventId)) throw NotFound("Evento no encontrado");
}
async function listEvents(actor, includeInactive = true) {
  const scope = tenantScope(actor);
  if (scope === "none") return [];
  const clauses = [];
  const params = [];
  if (scope !== "all") {
    clauses.push("owner_id = ?");
    params.push(scope);
  }
  if (!includeInactive) clauses.push("active = 1");
  const whereSql = clauses.length ? "WHERE " + clauses.join(" AND ") : "";
  const sql2 = `SELECT * FROM events ${whereSql} ORDER BY active DESC, start_date DESC, name`;
  return allRows3(sql2, ...params);
}
async function getEvent(id) {
  return getRow3("SELECT * FROM events WHERE id = ?", id);
}
async function createEvent(input, actor) {
  const name = input.name.trim();
  if (!name) throw BadRequest("El nombre del evento es obligatorio");
  let ownerId;
  if (actor.role === "superadmin") {
    ownerId = input.owner_id ?? null;
  } else {
    ownerId = actor.id;
  }
  if (ownerId !== null) {
    const owner = await getRow3("SELECT id FROM users WHERE id = ? AND role = ?", ownerId, "admin");
    if (!owner) throw BadRequest("El due\xF1o del evento debe ser un administrador");
  }
  const res = await exec3(
    "INSERT INTO events (name, description, venue, start_date, end_date, active, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
    name,
    input.description ?? "",
    input.venue ?? "",
    input.start_date ?? "",
    input.end_date ?? "",
    input.active === 0 ? 0 : 1,
    ownerId
  );
  const id = res.lastInsertRowid;
  await audit(actor.id, "create", "event", id, { name, owner_id: ownerId });
  return getEvent(id);
}
async function updateEvent(id, input, actor) {
  const cur = await getEvent(id);
  if (!cur) throw NotFound("Evento no encontrado");
  await assertEventAccess(actor, id);
  let ownerId = cur.owner_id ?? null;
  if (actor.role === "superadmin" && input.owner_id !== void 0) {
    ownerId = input.owner_id ?? null;
    if (ownerId !== null) {
      const owner = await getRow3("SELECT id FROM users WHERE id = ? AND role = ?", ownerId, "admin");
      if (!owner) throw BadRequest("El due\xF1o del evento debe ser un administrador");
    }
  }
  await exec3(
    `UPDATE events SET name = ?, description = ?, venue = ?, start_date = ?, end_date = ?, active = ?, owner_id = ? WHERE id = ?`,
    input.name?.trim() ?? cur.name,
    input.description ?? cur.description,
    input.venue ?? cur.venue,
    input.start_date ?? cur.start_date,
    input.end_date ?? cur.end_date,
    input.active === void 0 ? cur.active : input.active ? 1 : 0,
    ownerId,
    id
  );
  await audit(actor.id, "update", "event", id, { name: input.name, owner_id: input.owner_id });
  return getEvent(id);
}
async function deleteEvent(id, actor) {
  const cur = await getEvent(id);
  if (!cur) throw NotFound("Evento no encontrado");
  await assertEventAccess(actor, id);
  await runInTransaction3(async () => {
    await exec3("DELETE FROM sale_tickets WHERE sale_id IN (SELECT id FROM sales WHERE event_id = ?)", id);
    await exec3("DELETE FROM tickets WHERE sale_id IN (SELECT id FROM sales WHERE event_id = ?)", id);
    await exec3("DELETE FROM voids WHERE sale_id IN (SELECT id FROM sales WHERE event_id = ?)", id);
    await exec3("DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE event_id = ?)", id);
    await exec3("DELETE FROM sales WHERE event_id = ?", id);
    await exec3("DELETE FROM closes WHERE event_id = ?", id);
    await exec3("DELETE FROM boxes WHERE event_id = ?", id);
    await exec3("DELETE FROM products WHERE event_id = ?", id);
    await exec3("DELETE FROM categories WHERE event_id = ?", id);
    await exec3("DELETE FROM ticket_types WHERE event_id = ?", id);
    await exec3("DELETE FROM events WHERE id = ?", id);
  });
  await audit(actor.id, "delete", "event", id, {});
  return true;
}
var init_events_service = __esm({
  "src/server/services/events.service.ts"() {
    "use strict";
    init_errors();
    init_db();
    init_audit_service();
  }
});

// src/server/services/categories.service.ts
async function listCategories(eventId) {
  return allRows3(
    "SELECT * FROM categories WHERE event_id = ? ORDER BY sort_order, name",
    eventId
  );
}
async function getCategory(id) {
  return getRow3("SELECT * FROM categories WHERE id = ?", id);
}
async function createCategory(eventId, input, userId) {
  const name = input.name.trim();
  if (!name) throw BadRequest("El nombre de la categor\xEDa es obligatorio");
  const res = await exec3(
    "INSERT INTO categories (event_id, name, icon, color, sort_order) VALUES (?, ?, ?, ?, ?)",
    eventId,
    name,
    input.icon || "\u{1F4E6}",
    input.color || "#0ea5e9",
    input.sort_order ?? 0
  );
  await audit(userId, "create", "category", res.lastInsertRowid, { event_id: eventId, name });
  return getRow3("SELECT * FROM categories WHERE id = ?", res.lastInsertRowid);
}
async function updateCategory(id, input, userId) {
  const cur = await getRow3("SELECT * FROM categories WHERE id = ?", id);
  if (!cur) throw BadRequest("Categor\xEDa no encontrada");
  await exec3(
    "UPDATE categories SET name = ?, icon = ?, color = ?, sort_order = ? WHERE id = ?",
    input.name?.trim() ?? cur.name,
    input.icon ?? cur.icon,
    input.color ?? cur.color,
    input.sort_order ?? cur.sort_order,
    id
  );
  await audit(userId, "update", "category", id, {});
  return getRow3("SELECT * FROM categories WHERE id = ?", id);
}
async function deleteCategory(id, userId) {
  await exec3("UPDATE products SET category_id = NULL WHERE category_id = ?", id);
  await exec3("DELETE FROM categories WHERE id = ?", id);
  await audit(userId, "delete", "category", id, {});
  return true;
}
var init_categories_service = __esm({
  "src/server/services/categories.service.ts"() {
    "use strict";
    init_errors();
    init_db();
    init_audit_service();
  }
});

// src/server/services/products.service.ts
async function listProducts(eventId, includeInactive = true) {
  const sql2 = includeInactive ? "SELECT * FROM products WHERE event_id = ? ORDER BY active DESC, sort_order, name" : "SELECT * FROM products WHERE event_id = ? AND active = 1 ORDER BY sort_order, name";
  return allRows3(sql2, eventId);
}
async function getProduct(id) {
  return getRow3("SELECT * FROM products WHERE id = ?", id);
}
async function createProduct(eventId, input, userId) {
  const name = input.name.trim();
  if (!name) throw BadRequest("El nombre del producto es obligatorio");
  const price = Math.round(Number(input.price));
  if (isNaN(price) || price < 0) throw BadRequest("El precio debe ser un n\xFAmero v\xE1lido");
  const res = await exec3(
    "INSERT INTO products (event_id, category_id, name, price, icon, color, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
    eventId,
    input.category_id ?? null,
    name,
    price,
    input.icon || "\u{1F37D}\uFE0F",
    input.color || "#0ea5e9",
    input.sort_order ?? 0
  );
  await audit(userId, "create", "product", res.lastInsertRowid, { event_id: eventId, name, price });
  return getProduct(res.lastInsertRowid);
}
async function updateProduct(id, input, userId) {
  const cur = await getProduct(id);
  if (!cur) throw BadRequest("Producto no encontrado");
  const price = input.price !== void 0 ? Math.round(Number(input.price)) : cur.price;
  if (isNaN(price) || price < 0) throw BadRequest("El precio debe ser un n\xFAmero v\xE1lido");
  await exec3(
    `UPDATE products SET name = ?, price = ?, category_id = ?, icon = ?, color = ?, sort_order = ?, active = ? WHERE id = ?`,
    input.name?.trim() ?? cur.name,
    price,
    input.category_id === void 0 ? cur.category_id : input.category_id,
    input.icon ?? cur.icon,
    input.color ?? cur.color,
    input.sort_order ?? cur.sort_order,
    input.active === void 0 ? cur.active : input.active ? 1 : 0,
    id
  );
  await audit(userId, "update", "product", id, { name: input.name, price });
  return getProduct(id);
}
async function deleteProduct(id, userId) {
  const used = await getRow3("SELECT COUNT(*) AS c FROM sale_items WHERE product_id = ?", id);
  if ((used?.c ?? 0) > 0) {
    throw BadRequest("No se puede eliminar un producto ya vendido. Pod\xE9s desactivarlo.");
  }
  await exec3("DELETE FROM products WHERE id = ?", id);
  await audit(userId, "delete", "product", id, {});
  return true;
}
async function duplicateProduct(id, userId) {
  const cur = await getProduct(id);
  if (!cur) throw BadRequest("Producto no encontrado");
  const res = await exec3(
    "INSERT INTO products (event_id, category_id, name, price, icon, color, sort_order, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    cur.event_id,
    cur.category_id,
    cur.name + " (copia)",
    cur.price,
    cur.icon,
    cur.color,
    cur.sort_order,
    cur.active
  );
  await audit(userId, "duplicate", "product", res.lastInsertRowid, { from: id });
  return getProduct(res.lastInsertRowid);
}
var init_products_service = __esm({
  "src/server/services/products.service.ts"() {
    "use strict";
    init_errors();
    init_db();
    init_audit_service();
  }
});

// src/server/services/tickets.service.ts
async function listTicketTypes(eventId) {
  return allRows3(
    "SELECT * FROM ticket_types WHERE event_id = ? ORDER BY active DESC, sort_order, name",
    eventId
  );
}
async function getTicketType(id) {
  return getRow3("SELECT * FROM ticket_types WHERE id = ?", id);
}
async function createTicketType(eventId, input, userId) {
  const name = input.name.trim();
  if (!name) throw BadRequest("El nombre es obligatorio");
  const price = Math.round(Number(input.price));
  if (isNaN(price) || price < 0) throw BadRequest("El precio debe ser un n\xFAmero v\xE1lido");
  const digits = Math.max(1, Math.min(10, Math.round(input.digits ?? 4)));
  const res = await exec3(
    "INSERT INTO ticket_types (event_id, name, price, kind, start_number, last_number, digits, icon, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    eventId,
    name,
    price,
    input.kind ?? "entrada",
    input.start_number ?? null,
    input.start_number ? input.start_number > 0 ? input.start_number - 1 : null : null,
    digits,
    input.icon || "\u{1F39F}\uFE0F",
    input.color || "#8b5cf6"
  );
  const id = res.lastInsertRowid;
  await audit(userId, "create", "ticket_type", id, { event_id: eventId, name, price, kind: input.kind });
  return getTicketType(id);
}
async function updateTicketType(id, input, userId) {
  const cur = await getTicketType(id);
  if (!cur) throw BadRequest("Tipo no encontrado");
  const price = input.price !== void 0 ? Math.round(Number(input.price)) : cur.price;
  if (isNaN(price) || price < 0) throw BadRequest("El precio debe ser un n\xFAmero v\xE1lido");
  const sold = await getRow3("SELECT COUNT(*) AS c FROM tickets WHERE ticket_type_id = ?", id);
  const start = input.start_number !== void 0 ? input.start_number : cur.start_number;
  let last = cur.last_number;
  if (input.start_number !== void 0 && (sold?.c ?? 0) === 0) {
    last = start && start > 0 ? start - 1 : null;
  }
  await exec3(
    `UPDATE ticket_types SET name = ?, price = ?, kind = ?, start_number = ?, last_number = ?, digits = ?, icon = ?, color = ?, active = ? WHERE id = ?`,
    input.name?.trim() ?? cur.name,
    price,
    input.kind ?? cur.kind,
    start,
    last,
    input.digits ?? cur.digits,
    input.icon ?? cur.icon,
    input.color ?? cur.color,
    input.active === void 0 ? cur.active : input.active ? 1 : 0,
    id
  );
  await audit(userId, "update", "ticket_type", id, { name: input.name, price });
  return getTicketType(id);
}
async function deleteTicketType(id, userId) {
  const sold = await getRow3("SELECT COUNT(*) AS c FROM tickets WHERE ticket_type_id = ?", id);
  if ((sold?.c ?? 0) > 0) {
    throw BadRequest("No se puede eliminar un tipo de entrada ya vendido. Pod\xE9s desactivarlo.");
  }
  await exec3("DELETE FROM ticket_types WHERE id = ?", id);
  await audit(userId, "delete", "ticket_type", id, {});
  return true;
}
async function allocateTicketNumbers(ticketTypeId, quantity) {
  const type = await getTicketType(ticketTypeId);
  if (!type) throw BadRequest("Tipo de entrada no encontrado");
  const start = (type.last_number ?? 0) + 1;
  const numbers = [];
  for (let i = 0; i < quantity; i++) {
    numbers.push(start + i);
  }
  await exec3("UPDATE ticket_types SET last_number = ? WHERE id = ?", start + quantity - 1, ticketTypeId);
  return { type, numbers };
}
async function lastTicketNumbers(eventId) {
  return allRows3(
    "SELECT id, name, last_number, digits FROM ticket_types WHERE event_id = ? AND active = 1 ORDER BY name",
    eventId
  );
}
var init_tickets_service = __esm({
  "src/server/services/tickets.service.ts"() {
    "use strict";
    init_errors();
    init_db();
    init_audit_service();
  }
});

// src/server/services/boxes.service.ts
async function listBoxes(eventId) {
  return allRows3("SELECT * FROM boxes WHERE event_id = ? ORDER BY active DESC, name", eventId);
}
async function getBox(id) {
  return getRow3("SELECT * FROM boxes WHERE id = ?", id);
}
async function createBox(eventId, input, userId) {
  const n = input.name.trim();
  if (!n) throw BadRequest("El nombre de la caja es obligatorio");
  const res = await exec3(
    "INSERT INTO boxes (event_id, name, pos_categories, pos_tickets) VALUES (?, ?, ?, ?)",
    eventId,
    n,
    input.pos_categories ?? null,
    input.pos_tickets === void 0 ? 1 : input.pos_tickets ? 1 : 0
  );
  await audit(userId, "create", "box", res.lastInsertRowid, { event_id: eventId, name: n });
  return getBox(res.lastInsertRowid);
}
async function updateBox(id, input, userId) {
  const cur = await getBox(id);
  if (!cur) throw BadRequest("Caja no encontrada");
  await exec3(
    "UPDATE boxes SET name = ?, active = ?, pos_categories = ?, pos_tickets = ? WHERE id = ?",
    input.name?.trim() ?? cur.name,
    input.active === void 0 ? cur.active : input.active ? 1 : 0,
    input.pos_categories === void 0 ? cur.pos_categories ?? null : input.pos_categories,
    input.pos_tickets === void 0 ? cur.pos_tickets ?? 1 : input.pos_tickets ? 1 : 0,
    id
  );
  await audit(userId, "update", "box", id, {});
  return getBox(id);
}
async function deleteBox(id, userId) {
  const used = await getRow3("SELECT COUNT(*) AS c FROM sales WHERE box_id = ?", id);
  if ((used?.c ?? 0) > 0) {
    throw BadRequest("No se puede eliminar una caja con ventas. Pod\xE9s desactivarla.");
  }
  await exec3("DELETE FROM boxes WHERE id = ?", id);
  await audit(userId, "delete", "box", id, {});
  return true;
}
var init_boxes_service = __esm({
  "src/server/services/boxes.service.ts"() {
    "use strict";
    init_errors();
    init_db();
    init_audit_service();
  }
});

// src/server/routes/helpers.ts
function parseNumber(v) {
  const n = Number(v);
  if (isNaN(n)) throw BadRequest("Valor num\xE9rico inv\xE1lido");
  return n;
}
function parseOptionalInt(v) {
  if (v === void 0 || v === null || v === "") return void 0;
  const n = Number(v);
  return isNaN(n) ? void 0 : n;
}
var init_helpers = __esm({
  "src/server/routes/helpers.ts"() {
    "use strict";
    init_errors();
  }
});

// src/server/routes/data.routes.ts
async function gateEvent(req, eventId) {
  await assertEventAccess(req.user, eventId);
}
async function gateEntity(req, id, getter) {
  const entity = await getter(id);
  if (!entity) throw NotFound("No encontrado");
  await assertEventAccess(req.user, entity.event_id);
}
var import_express2, router2, data_routes_default;
var init_data_routes = __esm({
  "src/server/routes/data.routes.ts"() {
    "use strict";
    import_express2 = require("express");
    init_auth();
    init_events_service();
    init_categories_service();
    init_products_service();
    init_tickets_service();
    init_boxes_service();
    init_auth_service();
    init_errors();
    init_helpers();
    router2 = (0, import_express2.Router)();
    router2.use(requireAuth);
    router2.get("/users", requireRole("superadmin", "admin"), asyncHandler(async (req, res) => {
      res.json(await listUsers(req.user));
    }));
    router2.post("/users", requireRole("superadmin", "admin"), async (req, res, next) => {
      try {
        const { username, name, role, password, pin, pos_categories, pos_tickets, pos_box_id, owner_id } = req.body;
        if (req.user.role !== "superadmin" && role !== "cajero") {
          res.status(403).json({ error: "Solo el superadministrador puede crear administradores", code: "FORBIDDEN" });
          return;
        }
        const id = await createUser({ username, name, role, password, pin, pos_categories, pos_tickets, pos_box_id, owner_id }, req.user);
        res.json({ id });
      } catch (e) {
        next(e);
      }
    });
    router2.put("/users/:id", requireRole("superadmin", "admin"), async (req, res, next) => {
      try {
        const id = parseNumber(req.params.id);
        await updateUser(id, req.body, req.user);
        res.json({ ok: true });
      } catch (e) {
        next(e);
      }
    });
    router2.delete("/users/:id", requireRole("superadmin", "admin"), async (req, res, next) => {
      try {
        const id = parseNumber(req.params.id);
        const result = await deleteUser(id, req.user);
        res.json({ result });
      } catch (e) {
        next(e);
      }
    });
    router2.get("/events", asyncHandler(async (req, res) => {
      res.json(await listEvents(req.user));
    }));
    router2.get("/events/:id", async (req, res, next) => {
      try {
        await gateEvent(req, parseNumber(req.params.id));
        const ev = await getEvent(parseNumber(req.params.id));
        if (!ev) {
          res.status(404).json({ error: "Evento no encontrado" });
          return;
        }
        res.json(ev);
      } catch (e) {
        next(e);
      }
    });
    router2.post("/events", requireRole("superadmin", "admin"), async (req, res, next) => {
      try {
        const ev = await createEvent(req.body, req.user);
        res.json(ev);
      } catch (e) {
        next(e);
      }
    });
    router2.put("/events/:id", requireRole("superadmin", "admin"), async (req, res, next) => {
      try {
        await gateEvent(req, parseNumber(req.params.id));
        const ev = await updateEvent(parseNumber(req.params.id), req.body, req.user);
        res.json(ev);
      } catch (e) {
        next(e);
      }
    });
    router2.delete("/events/:id", requireRole("superadmin", "admin"), async (req, res, next) => {
      try {
        await deleteEvent(parseNumber(req.params.id), req.user);
        res.json({ ok: true });
      } catch (e) {
        next(e);
      }
    });
    router2.get("/events/:eventId/categories", async (req, res, next) => {
      try {
        await gateEvent(req, parseNumber(req.params.eventId));
        res.json(await listCategories(parseNumber(req.params.eventId)));
      } catch (e) {
        next(e);
      }
    });
    router2.post("/events/:eventId/categories", requireRole("superadmin", "admin"), async (req, res, next) => {
      try {
        await gateEvent(req, parseNumber(req.params.eventId));
        res.json(await createCategory(parseNumber(req.params.eventId), req.body, req.user.id));
      } catch (e) {
        next(e);
      }
    });
    router2.put("/categories/:id", requireRole("superadmin", "admin"), async (req, res, next) => {
      try {
        await gateEntity(req, parseNumber(req.params.id), getCategory);
        res.json(await updateCategory(parseNumber(req.params.id), req.body, req.user.id));
      } catch (e) {
        next(e);
      }
    });
    router2.delete("/categories/:id", requireRole("superadmin", "admin"), async (req, res, next) => {
      try {
        await gateEntity(req, parseNumber(req.params.id), getCategory);
        await deleteCategory(parseNumber(req.params.id), req.user.id);
        res.json({ ok: true });
      } catch (e) {
        next(e);
      }
    });
    router2.get("/events/:eventId/products", async (req, res, next) => {
      try {
        await gateEvent(req, parseNumber(req.params.eventId));
        res.json(await listProducts(parseNumber(req.params.eventId)));
      } catch (e) {
        next(e);
      }
    });
    router2.post("/events/:eventId/products", requireRole("superadmin", "admin"), async (req, res, next) => {
      try {
        await gateEvent(req, parseNumber(req.params.eventId));
        res.json(await createProduct(parseNumber(req.params.eventId), req.body, req.user.id));
      } catch (e) {
        next(e);
      }
    });
    router2.put("/products/:id", requireRole("superadmin", "admin"), async (req, res, next) => {
      try {
        await gateEntity(req, parseNumber(req.params.id), getProduct);
        res.json(await updateProduct(parseNumber(req.params.id), req.body, req.user.id));
      } catch (e) {
        next(e);
      }
    });
    router2.post("/products/:id/duplicate", requireRole("superadmin", "admin"), async (req, res, next) => {
      try {
        await gateEntity(req, parseNumber(req.params.id), getProduct);
        res.json(await duplicateProduct(parseNumber(req.params.id), req.user.id));
      } catch (e) {
        next(e);
      }
    });
    router2.delete("/products/:id", requireRole("superadmin", "admin"), async (req, res, next) => {
      try {
        await gateEntity(req, parseNumber(req.params.id), getProduct);
        await deleteProduct(parseNumber(req.params.id), req.user.id);
        res.json({ ok: true });
      } catch (e) {
        next(e);
      }
    });
    router2.get("/events/:eventId/tickets", async (req, res, next) => {
      try {
        await gateEvent(req, parseNumber(req.params.eventId));
        res.json(await listTicketTypes(parseNumber(req.params.eventId)));
      } catch (e) {
        next(e);
      }
    });
    router2.post("/events/:eventId/tickets", requireRole("superadmin", "admin"), async (req, res, next) => {
      try {
        await gateEvent(req, parseNumber(req.params.eventId));
        res.json(await createTicketType(parseNumber(req.params.eventId), req.body, req.user.id));
      } catch (e) {
        next(e);
      }
    });
    router2.put("/tickets/:id", requireRole("superadmin", "admin"), async (req, res, next) => {
      try {
        await gateEntity(req, parseNumber(req.params.id), getTicketType);
        res.json(await updateTicketType(parseNumber(req.params.id), req.body, req.user.id));
      } catch (e) {
        next(e);
      }
    });
    router2.delete("/tickets/:id", requireRole("superadmin", "admin"), async (req, res, next) => {
      try {
        await gateEntity(req, parseNumber(req.params.id), getTicketType);
        await deleteTicketType(parseNumber(req.params.id), req.user.id);
        res.json({ ok: true });
      } catch (e) {
        next(e);
      }
    });
    router2.get("/events/:eventId/tickets/last-numbers", async (req, res, next) => {
      try {
        await gateEvent(req, parseNumber(req.params.eventId));
        res.json(await lastTicketNumbers(parseNumber(req.params.eventId)));
      } catch (e) {
        next(e);
      }
    });
    router2.get("/events/:eventId/boxes", async (req, res, next) => {
      try {
        await gateEvent(req, parseNumber(req.params.eventId));
        res.json(await listBoxes(parseNumber(req.params.eventId)));
      } catch (e) {
        next(e);
      }
    });
    router2.post("/events/:eventId/boxes", requireRole("superadmin", "admin"), async (req, res, next) => {
      try {
        await gateEvent(req, parseNumber(req.params.eventId));
        const { name, pos_categories, pos_tickets } = req.body;
        res.json(await createBox(parseNumber(req.params.eventId), { name, pos_categories, pos_tickets }, req.user.id));
      } catch (e) {
        next(e);
      }
    });
    router2.get("/boxes/:id", async (req, res, next) => {
      try {
        await gateEntity(req, parseNumber(req.params.id), getBox);
        res.json(await getBox(parseNumber(req.params.id)));
      } catch (e) {
        next(e);
      }
    });
    router2.put("/boxes/:id", requireRole("superadmin", "admin"), async (req, res, next) => {
      try {
        await gateEntity(req, parseNumber(req.params.id), getBox);
        res.json(await updateBox(parseNumber(req.params.id), req.body, req.user.id));
      } catch (e) {
        next(e);
      }
    });
    router2.delete("/boxes/:id", requireRole("superadmin", "admin"), async (req, res, next) => {
      try {
        await gateEntity(req, parseNumber(req.params.id), getBox);
        await deleteBox(parseNumber(req.params.id), req.user.id);
        res.json({ ok: true });
      } catch (e) {
        next(e);
      }
    });
    data_routes_default = router2;
  }
});

// src/server/services/sales.service.ts
async function createSale(input) {
  const event = await getEvent(input.event_id);
  if (!event) throw BadRequest("Evento no encontrado");
  if (input.box_id) {
    const box = await getBox(input.box_id);
    if (!box) throw BadRequest("Caja no encontrada");
  }
  if (!["efectivo", "transferencia", "tarjeta", "otro"].includes(input.payment_method)) {
    throw BadRequest("Forma de pago inv\xE1lida");
  }
  const items = await Promise.all(
    (input.items || []).map(async (it) => {
      const p = await getProduct(it.product_id);
      const q = Math.floor(Number(it.quantity));
      if (!p) throw BadRequest("Producto no encontrado");
      if (!p.active) throw BadRequest(`El producto "${p.name}" est\xE1 desactivado`);
      if (isNaN(q) || q <= 0) throw BadRequest("Cantidad inv\xE1lida");
      return { product: p, quantity: q };
    })
  );
  const tickets = await Promise.all(
    (input.tickets || []).map(async (it) => {
      const t = await getTicketType(it.ticket_type_id);
      const q = Math.floor(Number(it.quantity));
      if (!t) throw BadRequest("Tipo de entrada no encontrado");
      if (!t.active) throw BadRequest(`"${t.name}" est\xE1 desactivado`);
      if (isNaN(q) || q <= 0) throw BadRequest("Cantidad inv\xE1lida");
      return { type: t, quantity: q };
    })
  );
  if (items.length === 0 && tickets.length === 0) {
    throw BadRequest("La venta no tiene productos");
  }
  const sale = await runInTransaction3(async () => {
    const opNumber = await nextSeq3(`event_op_${input.event_id}`);
    const itemRows = items.map((it) => ({
      product_id: it.product.id,
      name: it.product.name,
      unit_price: it.product.price,
      quantity: it.quantity,
      subtotal: it.product.price * it.quantity
    }));
    const ticketRows = tickets.map((it) => ({
      ticket_type_id: it.type.id,
      name: it.type.name,
      unit_price: it.type.price,
      quantity: it.quantity,
      subtotal: it.type.price * it.quantity
    }));
    const total = itemRows.reduce((s, r) => s + r.subtotal, 0) + ticketRows.reduce((s, r) => s + r.subtotal, 0);
    const res = await exec3(
      "INSERT INTO sales (event_id, box_id, user_id, operation_number, total, payment_method, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
      input.event_id,
      input.box_id,
      input.user_id,
      opNumber,
      total,
      input.payment_method,
      "activa"
    );
    const saleId = Number(res.lastInsertRowid);
    for (const r of itemRows) {
      await exec3(
        "INSERT INTO sale_items (sale_id, product_id, product_name, unit_price, quantity, subtotal) VALUES (?, ?, ?, ?, ?, ?)",
        saleId,
        r.product_id,
        r.name,
        r.unit_price,
        r.quantity,
        r.subtotal
      );
    }
    const ticketNumbers = {};
    for (const r of ticketRows) {
      await exec3(
        "INSERT INTO sale_tickets (sale_id, ticket_type_id, ticket_type_name, unit_price, quantity, subtotal) VALUES (?, ?, ?, ?, ?, ?)",
        saleId,
        r.ticket_type_id,
        r.name,
        r.unit_price,
        r.quantity,
        r.subtotal
      );
      const allocated = await allocateTicketNumbers(r.ticket_type_id, r.quantity);
      ticketNumbers[r.ticket_type_id] = allocated.numbers;
      for (const num of allocated.numbers) {
        await exec3("INSERT INTO tickets (sale_id, ticket_type_id, number) VALUES (?, ?, ?)", saleId, r.ticket_type_id, num);
      }
    }
    const saleRow = await getSaleDetail(saleId);
    return { sale: saleRow, ticketNumbers };
  });
  logger.info("sales", `Venta ${sale.sale.operation_number} registrada: $${sale.sale.total} (${sale.sale.payment_method})`, void 0, input.user_id, input.device);
  await audit(input.user_id, "create", "sale", sale.sale.id, { op: sale.sale.operation_number, total: sale.sale.total });
  return sale;
}
async function listSales(filters) {
  const where = [];
  const params = [];
  if (filters.event_id) {
    where.push("s.event_id = ?");
    params.push(filters.event_id);
  } else if (filters.event_ids && filters.event_ids.length > 0) {
    where.push("s.event_id IN (" + filters.event_ids.map(() => "?").join(", ") + ")");
    params.push(...filters.event_ids);
  }
  if (filters.box_id) {
    where.push("s.box_id = ?");
    params.push(filters.box_id);
  }
  if (filters.user_id) {
    where.push("s.user_id = ?");
    params.push(filters.user_id);
  }
  if (filters.payment_method) {
    where.push("s.payment_method = ?");
    params.push(filters.payment_method);
  }
  if (filters.status) {
    where.push("s.status = ?");
    params.push(filters.status);
  }
  if (filters.from) {
    where.push("s.created_at >= ?");
    params.push(filters.from + " 00:00:00");
  }
  if (filters.to) {
    where.push("s.created_at <= ?");
    params.push(filters.to + " 23:59:59");
  }
  const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";
  const limit = Math.min(filters.limit ?? 500, 2e3);
  const sql2 = `SELECT s.id, s.event_id, e.name AS event_name, s.box_id, b.name AS box_name,
      s.user_id, u.name AS user_name, s.operation_number, s.total, s.payment_method, s.status, s.created_at
    FROM sales s
    LEFT JOIN events e ON e.id = s.event_id
    LEFT JOIN boxes b ON b.id = s.box_id
    LEFT JOIN users u ON u.id = s.user_id
    ${whereSql}
    ORDER BY s.id DESC
    LIMIT ? OFFSET ?`;
  params.push(limit, filters.offset ?? 0);
  return allRows3(sql2, ...params);
}
async function getSaleDetail(id) {
  const sale = await getRow3(
    `SELECT s.id, s.event_id, e.name AS event_name, s.box_id, b.name AS box_name,
       s.user_id, u.name AS user_name, s.operation_number, s.total, s.payment_method, s.status, s.created_at
     FROM sales s
     LEFT JOIN events e ON e.id = s.event_id
     LEFT JOIN boxes b ON b.id = s.box_id
     LEFT JOIN users u ON u.id = s.user_id
     WHERE s.id = ?`,
    id
  );
  if (!sale) throw BadRequest("Venta no encontrada");
  const items = await allRows3(
    `SELECT si.id, si.product_id, si.product_name, si.unit_price, si.quantity, si.subtotal,
       p.icon, p.color
     FROM sale_items si LEFT JOIN products p ON p.id = si.product_id
     WHERE si.sale_id = ? ORDER BY si.id`,
    id
  );
  const tickets = await allRows3(
    `SELECT st.id, st.ticket_type_id, st.ticket_type_name, st.unit_price, st.quantity, st.subtotal,
       t.icon, t.color
     FROM sale_tickets st LEFT JOIN ticket_types t ON t.id = st.ticket_type_id
     WHERE st.sale_id = ? ORDER BY st.id`,
    id
  );
  const v = await getRow3(
    `SELECT v.reason, u.name AS user_name, v.created_at
     FROM voids v LEFT JOIN users u ON u.id = v.user_id WHERE v.sale_id = ?`,
    id
  );
  return { ...sale, items, tickets, voided: v ?? null };
}
async function voidSale(saleId, userId, reason, device) {
  const sale = await getRow3("SELECT * FROM sales WHERE id = ?", saleId);
  if (!sale) throw BadRequest("Venta no encontrada");
  if (sale.status === "anulada") throw BadRequest("La venta ya est\xE1 anulada");
  const r = reason.trim();
  if (!r) throw BadRequest("Deb\xE9s indicar el motivo de la anulaci\xF3n");
  await runInTransaction3(async () => {
    await exec3("UPDATE sales SET status = ? WHERE id = ?", "anulada", saleId);
    await exec3("INSERT INTO voids (sale_id, user_id, reason) VALUES (?, ?, ?)", saleId, userId, r);
  });
  logger.warn("sales", `Venta ${sale.operation_number} anulada: ${r}`, void 0, userId, device);
  await audit(userId, "void", "sale", saleId, { op: sale.operation_number, reason: r });
  return getSaleDetail(saleId);
}
async function getOperationNumber(eventId) {
  return nextSeq3(`event_op_${eventId}`);
}
async function lastSalesForBox(boxId, limit = 8) {
  return allRows3(
    `SELECT s.id, s.event_id, s.box_id, s.user_id, s.operation_number, s.total, s.payment_method, s.status, s.created_at,
       u.name AS user_name
     FROM sales s LEFT JOIN users u ON u.id = s.user_id
     WHERE s.box_id = ? AND s.status = 'activa'
     ORDER BY s.id DESC LIMIT ?`,
    boxId,
    limit
  );
}
var init_sales_service = __esm({
  "src/server/services/sales.service.ts"() {
    "use strict";
    init_errors();
    init_db();
    init_audit_service();
    init_logger();
    init_tickets_service();
    init_products_service();
    init_boxes_service();
    init_events_service();
  }
});

// src/server/routes/sales.routes.ts
async function validateEventAccess(req, eventId) {
  await assertEventAccess(req.user, eventId);
  const ev = await getEvent(eventId);
  if (!ev) throw BadRequest("Evento no encontrado");
  if (ev.active !== 1) {
    throw Object.assign(new Error("El evento est\xE1 inactivo"), { friendly: "El evento est\xE1 inactivo. No se pueden registrar ventas." });
  }
  return ev;
}
var import_express3, router3, sales_routes_default;
var init_sales_routes = __esm({
  "src/server/routes/sales.routes.ts"() {
    "use strict";
    init_errors();
    import_express3 = require("express");
    init_auth();
    init_sales_service();
    init_boxes_service();
    init_events_service();
    init_helpers();
    router3 = (0, import_express3.Router)();
    router3.use(requireAuth);
    router3.post("/", async (req, res, next) => {
      try {
        const eventId = parseNumber(req.body.event_id);
        await validateEventAccess(req, eventId);
        const boxId = req.body.box_id ? parseNumber(req.body.box_id) : null;
        if (boxId) {
          const box = await getBox(boxId);
          if (!box) throw BadRequest("Caja no encontrada");
        }
        const payment = req.body.payment_method;
        const result = await createSale({
          event_id: eventId,
          box_id: boxId,
          user_id: req.user.id,
          items: Array.isArray(req.body.items) ? req.body.items : [],
          tickets: Array.isArray(req.body.tickets) ? req.body.tickets : [],
          payment_method: payment,
          device: req.device
        });
        res.json(result);
      } catch (e) {
        next(e);
      }
    });
    router3.get("/", asyncHandler(async (req, res) => {
      const q = req.query;
      const eventId = parseOptionalInt(q.event_id);
      if (eventId) {
        await assertEventAccess(req.user, eventId);
      }
      let eventIds;
      if (!eventId && req.user.role !== "superadmin") {
        const tid = req.user.role === "admin" ? req.user.id : req.user.owner_id ?? null;
        if (tid === null) {
          res.json([]);
          return;
        }
        const rows = await listEvents(req.user);
        eventIds = rows.map((r) => r.id);
        if (eventIds.length === 0) {
          res.json([]);
          return;
        }
      }
      const sales = await listSales({
        event_id: eventId,
        event_ids: eventIds,
        box_id: parseOptionalInt(q.box_id),
        user_id: parseOptionalInt(q.user_id),
        payment_method: q.payment_method,
        status: q.status || void 0,
        from: q.from,
        to: q.to,
        limit: parseOptionalInt(q.limit) ?? 200,
        offset: parseOptionalInt(q.offset) ?? 0
      });
      res.json(sales);
    }));
    router3.get("/operation", async (req, res, next) => {
      try {
        const eventId = parseNumber(req.query.event_id);
        await assertEventAccess(req.user, eventId);
        const op = await getOperationNumber(eventId);
        res.json({ operation_number: op });
      } catch (e) {
        next(e);
      }
    });
    router3.get("/box/:boxId/recent", async (req, res, next) => {
      try {
        const box = await getBox(parseNumber(req.params.boxId));
        if (!box) throw BadRequest("Caja no encontrada");
        await assertEventAccess(req.user, box.event_id);
        res.json(await lastSalesForBox(parseNumber(req.params.boxId)));
      } catch (e) {
        next(e);
      }
    });
    router3.get("/:id", async (req, res, next) => {
      try {
        const sale = await getSaleDetail(parseNumber(req.params.id));
        await assertEventAccess(req.user, sale.event_id);
        res.json(sale);
      } catch (e) {
        next(e);
      }
    });
    router3.post("/:id/void", requireRole("superadmin", "admin"), async (req, res, next) => {
      try {
        const sale = await getSaleDetail(parseNumber(req.params.id));
        await assertEventAccess(req.user, sale.event_id);
        const detail = await voidSale(parseNumber(req.params.id), req.user.id, String(req.body.reason ?? ""), req.device);
        res.json(detail);
      } catch (e) {
        next(e);
      }
    });
    sales_routes_default = router3;
  }
});

// src/shared/format.ts
function nowLocalIso() {
  const d = /* @__PURE__ */ new Date();
  const pad = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
var init_format = __esm({
  "src/shared/format.ts"() {
    "use strict";
  }
});

// src/server/services/closes.service.ts
async function openClose(eventId, boxId, userId) {
  const existing = await getRow3("SELECT * FROM closes WHERE box_id = ? AND status = ?", boxId, "abierto");
  if (existing) return existing;
  const now = nowLocalIso();
  const res = await exec3(
    "INSERT INTO closes (event_id, box_id, user_id, opened_at, status) VALUES (?, ?, ?, ?, ?)",
    eventId,
    boxId,
    userId,
    now,
    "abierto"
  );
  await audit(userId, "open", "close", res.lastInsertRowid, { box_id: boxId });
  return await getRow3("SELECT * FROM closes WHERE id = ?", res.lastInsertRowid);
}
async function currentOpenClose(boxId) {
  return getRow3("SELECT * FROM closes WHERE box_id = ? AND status = ?", boxId, "abierto");
}
async function computeCloseSummary(closeId) {
  const close = await getRow3("SELECT * FROM closes WHERE id = ?", closeId);
  if (!close) throw BadRequest("Cierre no encontrado");
  const rows = await allRows3(
    `SELECT s.payment_method, COALESCE(SUM(s.total), 0) AS total
     FROM sales s WHERE s.box_id = ? AND s.status = 'activa' AND s.created_at >= ?
     GROUP BY s.payment_method`,
    close.box_id,
    close.opened_at
  );
  const by_payment = {
    efectivo: 0,
    transferencia: 0,
    tarjeta: 0,
    otro: 0
  };
  for (const r of rows) by_payment[r.payment_method] = Number(r.total);
  const total = Object.values(by_payment).reduce((s, v) => s + v, 0);
  const sales_count = (await getRow3(
    `SELECT COUNT(*) AS c FROM sales WHERE box_id = ? AND status = 'activa' AND created_at >= ?`,
    close.box_id,
    close.opened_at
  ))?.c ?? 0;
  return { sales_count, by_payment, total };
}
async function closeBox(closeId, userId, declaredByPayment) {
  const close = await getRow3("SELECT * FROM closes WHERE id = ?", closeId);
  if (!close) throw BadRequest("Cierre no encontrado");
  if (close.status === "cerrado") throw BadRequest("La caja ya est\xE1 cerrada");
  const summary = await computeCloseSummary(closeId);
  const declared_total = Math.round(
    (declaredByPayment.efectivo ?? 0) + (declaredByPayment.transferencia ?? 0) + (declaredByPayment.tarjeta ?? 0) + (declaredByPayment.otro ?? 0)
  );
  const difference = declared_total - summary.total;
  const now = nowLocalIso();
  await runInTransaction3(async () => {
    await exec3(
      "UPDATE closes SET closed_at = ?, expected_total = ?, declared_total = ?, difference = ?, status = ? WHERE id = ?",
      now,
      summary.total,
      declared_total,
      difference,
      "cerrado",
      closeId
    );
  });
  await audit(userId, "close", "close", closeId, { box_id: close.box_id, expected: summary.total, declared: declared_total, diff: difference });
  return await getRow3("SELECT * FROM closes WHERE id = ?", closeId);
}
async function listCloses(filters) {
  const where = [];
  const params = [];
  if (filters.event_id) {
    where.push("c.event_id = ?");
    params.push(filters.event_id);
  } else if (filters.event_ids && filters.event_ids.length > 0) {
    where.push("c.event_id IN (" + filters.event_ids.map(() => "?").join(", ") + ")");
    params.push(...filters.event_ids);
  }
  if (filters.box_id) {
    where.push("c.box_id = ?");
    params.push(filters.box_id);
  }
  if (filters.status) {
    where.push("c.status = ?");
    params.push(filters.status);
  }
  const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";
  return allRows3(
    `SELECT c.id, c.event_id, c.box_id, b.name AS box_name, c.user_id, u.name AS user_name,
       c.opened_at, c.closed_at, c.expected_total, c.declared_total, c.difference, c.status
     FROM closes c
     LEFT JOIN boxes b ON b.id = c.box_id
     LEFT JOIN users u ON u.id = c.user_id
     ${whereSql}
     ORDER BY c.id DESC`,
    ...params
  );
}
async function ensureOpenClose(eventId, boxId, userId) {
  const existing = await currentOpenClose(boxId);
  if (existing) return existing;
  return openClose(eventId, boxId, userId);
}
var init_closes_service = __esm({
  "src/server/services/closes.service.ts"() {
    "use strict";
    init_errors();
    init_db();
    init_audit_service();
    init_format();
  }
});

// src/server/routes/closes.routes.ts
var import_express4, router4, closes_routes_default;
var init_closes_routes = __esm({
  "src/server/routes/closes.routes.ts"() {
    "use strict";
    init_errors();
    import_express4 = require("express");
    init_auth();
    init_db();
    init_closes_service();
    init_boxes_service();
    init_events_service();
    init_helpers();
    router4 = (0, import_express4.Router)();
    router4.use(requireAuth);
    router4.post("/open", async (req, res, next) => {
      try {
        const eventId = parseNumber(req.body.event_id);
        const boxId = parseNumber(req.body.box_id);
        await assertEventAccess(req.user, eventId);
        const ev = await getEvent(eventId);
        const box = await getBox(boxId);
        if (!ev) throw BadRequest("Evento no encontrado");
        if (!box) throw BadRequest("Caja no encontrada");
        res.json(await openClose(eventId, boxId, req.user.id));
      } catch (e) {
        next(e);
      }
    });
    router4.get("/box/:boxId/current", async (req, res, next) => {
      try {
        const box = await getBox(parseNumber(req.params.boxId));
        if (!box) throw BadRequest("Caja no encontrada");
        await assertEventAccess(req.user, box.event_id);
        const close = await currentOpenClose(parseNumber(req.params.boxId));
        if (!close) {
          res.json(null);
          return;
        }
        res.json({ close, summary: await computeCloseSummary(close.id) });
      } catch (e) {
        next(e);
      }
    });
    router4.post("/box/:boxId/ensure", async (req, res, next) => {
      try {
        const boxId = parseNumber(req.params.boxId);
        const eventId = parseNumber(req.body.event_id);
        await assertEventAccess(req.user, eventId);
        const close = await ensureOpenClose(eventId, boxId, req.user.id);
        res.json(close);
      } catch (e) {
        next(e);
      }
    });
    router4.get("/:id/summary", async (req, res, next) => {
      try {
        const close = await getRow3("SELECT event_id FROM closes WHERE id = ?", parseNumber(req.params.id));
        if (!close) throw BadRequest("Cierre no encontrado");
        await assertEventAccess(req.user, close.event_id);
        res.json(await computeCloseSummary(parseNumber(req.params.id)));
      } catch (e) {
        next(e);
      }
    });
    router4.post("/:id/close", requireRole("superadmin", "admin"), async (req, res, next) => {
      try {
        const close = await getRow3("SELECT event_id FROM closes WHERE id = ?", parseNumber(req.params.id));
        if (!close) throw BadRequest("Cierre no encontrado");
        await assertEventAccess(req.user, close.event_id);
        const declared = req.body.declared_by_payment;
        if (!declared || typeof declared !== "object") {
          res.status(400).json({ error: "Datos de cierre inv\xE1lidos" });
          return;
        }
        const closed = await closeBox(parseNumber(req.params.id), req.user.id, {
          efectivo: Number(declared.efectivo ?? 0),
          transferencia: Number(declared.transferencia ?? 0),
          tarjeta: Number(declared.tarjeta ?? 0),
          otro: Number(declared.otro ?? 0)
        });
        res.json(closed);
      } catch (e) {
        next(e);
      }
    });
    router4.get("/", asyncHandler(async (req, res) => {
      const q = req.query;
      const eventId = parseOptionalInt(q.event_id);
      if (eventId) {
        await assertEventAccess(req.user, eventId);
      }
      let eventIds;
      if (!eventId && req.user.role !== "superadmin") {
        const rows = await listEvents(req.user);
        eventIds = rows.map((r) => r.id);
        if (eventIds.length === 0) {
          res.json([]);
          return;
        }
      }
      res.json(
        await listCloses({
          event_id: eventId,
          event_ids: eventIds,
          box_id: parseOptionalInt(q.box_id),
          status: q.status
        })
      );
    }));
    closes_routes_default = router4;
  }
});

// src/server/services/dashboard.service.ts
async function dashboard(eventId, from, to) {
  const where = ["s.status = 'activa'"];
  const params = [];
  if (eventId) {
    where.push("s.event_id = ?");
    params.push(eventId);
  }
  if (from) {
    where.push("s.created_at >= ?");
    params.push(from + " 00:00:00");
  }
  if (to) {
    where.push("s.created_at <= ?");
    params.push(to + " 23:59:59");
  }
  const whereSql = where.join(" AND ");
  const totals = await getRow3(
    `SELECT COALESCE(SUM(s.total), 0) AS total,
       COALESCE(SUM(CASE WHEN s.payment_method = 'efectivo' THEN s.total ELSE 0 END), 0) AS efectivo,
       COALESCE(SUM(CASE WHEN s.payment_method = 'transferencia' THEN s.total ELSE 0 END), 0) AS transferencia,
       COALESCE(SUM(CASE WHEN s.payment_method = 'tarjeta' THEN s.total ELSE 0 END), 0) AS tarjeta,
       COALESCE(SUM(CASE WHEN s.payment_method = 'otro' THEN s.total ELSE 0 END), 0) AS otro,
       COUNT(*) AS ventas
     FROM sales s WHERE ${whereSql}`,
    ...params
  );
  const tickets = await getRow3(
    `SELECT
       COALESCE(SUM(CASE WHEN t.kind = 'entrada' THEN st.quantity ELSE 0 END), 0) AS entradas,
       COALESCE(SUM(CASE WHEN t.kind = 'boleta' THEN st.quantity ELSE 0 END), 0) AS boletas,
       COALESCE(SUM(CASE WHEN t.kind = 'rifa' THEN st.quantity ELSE 0 END), 0) AS rifas,
       COALESCE(SUM(CASE WHEN t.kind = 'bono' THEN st.quantity ELSE 0 END), 0) AS bonos
     FROM sale_tickets st
     LEFT JOIN ticket_types t ON t.id = st.ticket_type_id
     LEFT JOIN sales s ON s.id = st.sale_id
     WHERE ${whereSql}`,
    ...params
  );
  const productos = await getRow3(
    `SELECT COALESCE(SUM(si.quantity), 0) AS c
     FROM sale_items si LEFT JOIN sales s ON s.id = si.sale_id WHERE ${whereSql}`,
    ...params
  );
  const anuladas = await getRow3(
    `SELECT COUNT(*) AS ventas, COALESCE(SUM(total), 0) AS monto
     FROM sales WHERE status = 'anulada' ${eventId ? "AND event_id = ?" : ""} ${from ? "AND created_at >= ?" : ""} ${to ? "AND created_at <= ?" : ""}`,
    ...eventId ? [eventId] : [],
    ...from ? [from + " 00:00:00"] : [],
    ...to ? [to + " 23:59:59"] : []
  );
  return {
    total_recaudado: totals.total,
    total_efectivo: totals.efectivo,
    total_transferencia: totals.transferencia,
    total_tarjeta: totals.tarjeta,
    total_otro: totals.otro,
    total_ventas: totals.ventas,
    total_entradas: tickets.entradas,
    total_boletas: tickets.boletas,
    total_productos: productos.c,
    ventas_anuladas: anuladas.ventas,
    monto_anulado: anuladas.monto
  };
}
async function stats(eventId, from, to) {
  const where = ["s.status = 'activa'"];
  const params = [];
  if (eventId) {
    where.push("s.event_id = ?");
    params.push(eventId);
  }
  if (from) {
    where.push("s.created_at >= ?");
    params.push(from + " 00:00:00");
  }
  if (to) {
    where.push("s.created_at <= ?");
    params.push(to + " 23:59:59");
  }
  const whereSql = where.join(" AND ");
  const porHoraRows = await allRows3(
    `SELECT CAST(strftime('%H', s.created_at) AS INTEGER) AS h, s.payment_method, COALESCE(SUM(s.total), 0) AS v
     FROM sales s WHERE ${whereSql} GROUP BY h, s.payment_method`,
    ...params
  );
  const porHora = [];
  for (let h = 0; h < 24; h++) {
    const pt = { label: String(h).padStart(2, "0"), efectivo: 0, transferencia: 0, tarjeta: 0, otro: 0 };
    for (const r of porHoraRows) {
      const key = r.payment_method;
      pt[key] = Number(r.v);
    }
    if (porHora.some((p) => p.label === pt.label)) continue;
    porHora.push(pt);
  }
  const porDiaRows = await allRows3(
    `SELECT substr(s.created_at, 1, 10) AS d, s.payment_method, COALESCE(SUM(s.total), 0) AS v
     FROM sales s WHERE ${whereSql} GROUP BY d, s.payment_method ORDER BY d`,
    ...params
  );
  const porDiaMap = /* @__PURE__ */ new Map();
  for (const r of porDiaRows) {
    if (!porDiaMap.has(r.d)) {
      porDiaMap.set(r.d, { label: r.d, efectivo: 0, transferencia: 0, tarjeta: 0, otro: 0 });
    }
    const pt = porDiaMap.get(r.d);
    const key = r.payment_method;
    pt[key] = Number(r.v);
  }
  const porDia = [...porDiaMap.values()].slice(-14);
  const topProductosRows = await allRows3(
    `SELECT si.product_name AS name, COALESCE(SUM(si.quantity), 0) AS v
     FROM sale_items si LEFT JOIN sales s ON s.id = si.sale_id
     WHERE ${whereSql}
     GROUP BY si.product_name ORDER BY v DESC LIMIT 10`,
    ...params
  );
  const topProductos = topProductosRows.map((r) => ({ label: r.name, value: Number(r.v) }));
  const porCategoriaRows = await allRows3(
    `SELECT COALESCE(c.name, 'Sin categor\xEDa') AS name, COALESCE(SUM(si.subtotal), 0) AS v
     FROM sale_items si
     LEFT JOIN products p ON p.id = si.product_id
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN sales s ON s.id = si.sale_id
     WHERE ${whereSql}
     GROUP BY COALESCE(c.name, 'Sin categor\xEDa') ORDER BY v DESC LIMIT 12`,
    ...params
  );
  const porCategoria = porCategoriaRows.map((r) => ({ label: r.name, value: Number(r.v) }));
  const porCajeroRows = await allRows3(
    `SELECT COALESCE(u.name, 'Eliminado') AS name, COALESCE(SUM(s.total), 0) AS v
     FROM sales s LEFT JOIN users u ON u.id = s.user_id
     WHERE ${whereSql} GROUP BY COALESCE(u.name, 'Eliminado') ORDER BY v DESC`,
    ...params
  );
  const porCajero = porCajeroRows.map((r) => ({ label: r.name || "Sin nombre", value: Number(r.v) }));
  const porCajaRows = await allRows3(
    `SELECT COALESCE(b.name, 'Sin caja') AS name, COALESCE(SUM(s.total), 0) AS v
     FROM sales s LEFT JOIN boxes b ON b.id = s.box_id
     WHERE ${whereSql} GROUP BY COALESCE(b.name, 'Sin caja') ORDER BY v DESC`,
    ...params
  );
  const porCaja = porCajaRows.map((r) => ({ label: r.name || "Sin caja", value: Number(r.v) }));
  const porPagoRows = await allRows3(
    `SELECT s.payment_method, COALESCE(SUM(s.total), 0) AS v
     FROM sales s WHERE ${whereSql} GROUP BY s.payment_method`,
    ...params
  );
  const labels = { efectivo: "Efectivo", transferencia: "Transferencia", tarjeta: "Tarjeta", otro: "Otro" };
  const porPago = porPagoRows.map((r) => ({
    label: labels[r.payment_method] || r.payment_method,
    value: Number(r.v)
  }));
  const porTipoTicketRows = await allRows3(
    `SELECT COALESCE(st.ticket_type_name, 'Otro') AS name, COALESCE(SUM(st.quantity), 0) AS v
     FROM sale_tickets st LEFT JOIN sales s ON s.id = st.sale_id
     WHERE ${whereSql}
     GROUP BY st.ticket_type_name ORDER BY v DESC LIMIT 10`,
    ...params
  );
  const porTipoTicket = porTipoTicketRows.map((r) => ({ label: r.name, value: Number(r.v) }));
  return { por_hora: porHora, por_dia: porDia, top_productos: topProductos, por_categoria: porCategoria, por_cajero: porCajero, por_caja: porCaja, por_pago: porPago, por_tipo_ticket: porTipoTicket };
}
var init_dashboard_service = __esm({
  "src/server/services/dashboard.service.ts"() {
    "use strict";
    init_db();
  }
});

// src/server/services/reports.service.ts
function buildWhere(f, activeOnly = true) {
  const where = [];
  const params = [];
  if (activeOnly) {
    where.push("s.status = 'activa'");
  }
  if (f.event_id) {
    where.push("s.event_id = ?");
    params.push(f.event_id);
  }
  if (f.box_id) {
    where.push("s.box_id = ?");
    params.push(f.box_id);
  }
  if (f.user_id) {
    where.push("s.user_id = ?");
    params.push(f.user_id);
  }
  if (f.from) {
    where.push("s.created_at >= ?");
    params.push(f.from + " 00:00:00");
  }
  if (f.to) {
    where.push("s.created_at <= ?");
    params.push(f.to + " 23:59:59");
  }
  return { where, params };
}
async function reporteDiario(f) {
  const { where, params } = buildWhere(f);
  const rows = await allRows3(
    `SELECT substr(s.created_at, 1, 10) AS fecha,
       COALESCE(SUM(CASE WHEN s.payment_method = 'efectivo' THEN s.total ELSE 0 END), 0) AS efectivo,
       COALESCE(SUM(CASE WHEN s.payment_method = 'transferencia' THEN s.total ELSE 0 END), 0) AS transferencia,
       COALESCE(SUM(CASE WHEN s.payment_method = 'tarjeta' THEN s.total ELSE 0 END), 0) AS tarjeta,
       COALESCE(SUM(CASE WHEN s.payment_method = 'otro' THEN s.total ELSE 0 END), 0) AS otro,
       COALESCE(SUM(s.total), 0) AS total,
       COUNT(*) AS ventas
     FROM sales s WHERE ${where.join(" AND ")}
     GROUP BY substr(s.created_at, 1, 10) ORDER BY fecha`,
    ...params
  );
  return {
    type: "diario",
    title: "Reporte diario",
    columns: [
      { key: "fecha", label: "Fecha" },
      { key: "ventas", label: "Ventas" },
      { key: "efectivo", label: "Efectivo" },
      { key: "transferencia", label: "Transferencia" },
      { key: "tarjeta", label: "Tarjeta" },
      { key: "otro", label: "Otro" },
      { key: "total", label: "Total" }
    ],
    rows
  };
}
async function reporteCajeros(f) {
  const { where, params } = buildWhere(f);
  const rows = await allRows3(
    `SELECT COALESCE(u.name, 'Eliminado') AS cajero, u.role AS rol,
       COUNT(*) AS ventas,
       COALESCE(SUM(CASE WHEN s.payment_method = 'efectivo' THEN s.total ELSE 0 END), 0) AS efectivo,
       COALESCE(SUM(CASE WHEN s.payment_method = 'transferencia' THEN s.total ELSE 0 END), 0) AS transferencia,
       COALESCE(SUM(CASE WHEN s.payment_method = 'tarjeta' THEN s.total ELSE 0 END), 0) AS tarjeta,
       COALESCE(SUM(s.total), 0) AS total
     FROM sales s LEFT JOIN users u ON u.id = s.user_id
     WHERE ${where.join(" AND ")}
     GROUP BY u.name, u.role ORDER BY total DESC`,
    ...params
  );
  return {
    type: "cajeros",
    title: "Reporte por cajero",
    columns: [
      { key: "cajero", label: "Cajero" },
      { key: "rol", label: "Rol" },
      { key: "ventas", label: "Ventas" },
      { key: "efectivo", label: "Efectivo" },
      { key: "transferencia", label: "Transferencia" },
      { key: "tarjeta", label: "Tarjeta" },
      { key: "total", label: "Total" }
    ],
    rows
  };
}
async function reporteCajas(f) {
  const { where, params } = buildWhere(f);
  const rows = await allRows3(
    `SELECT COALESCE(b.name, 'Sin caja') AS caja,
       COUNT(*) AS ventas,
       COALESCE(SUM(s.total), 0) AS total,
       COALESCE(SUM(CASE WHEN s.payment_method = 'efectivo' THEN s.total ELSE 0 END), 0) AS efectivo,
       COALESCE(SUM(CASE WHEN s.payment_method = 'transferencia' THEN s.total ELSE 0 END), 0) AS transferencia
     FROM sales s LEFT JOIN boxes b ON b.id = s.box_id
     WHERE ${where.join(" AND ")}
     GROUP BY b.name ORDER BY total DESC`,
    ...params
  );
  return {
    type: "cajas",
    title: "Reporte por caja",
    columns: [
      { key: "caja", label: "Caja" },
      { key: "ventas", label: "Ventas" },
      { key: "efectivo", label: "Efectivo" },
      { key: "transferencia", label: "Transferencia" },
      { key: "total", label: "Total" }
    ],
    rows
  };
}
async function reporteProductos(f) {
  const { where, params } = buildWhere(f);
  const rows = await allRows3(
    `SELECT si.product_name AS producto,
       COALESCE(SUM(si.quantity), 0) AS cantidad,
       COALESCE(SUM(si.subtotal), 0) AS total
     FROM sale_items si LEFT JOIN sales s ON s.id = si.sale_id
     WHERE ${where.join(" AND ")}
     GROUP BY si.product_name ORDER BY total DESC`,
    ...params
  );
  return {
    type: "productos",
    title: "Reporte de productos",
    columns: [
      { key: "producto", label: "Producto" },
      { key: "cantidad", label: "Cantidad" },
      { key: "total", label: "Total" }
    ],
    rows
  };
}
async function reporteEntradas(f) {
  const { where, params } = buildWhere(f);
  const rows = await allRows3(
    `SELECT st.ticket_type_name AS tipo, t.kind AS clase,
       COALESCE(SUM(st.quantity), 0) AS cantidad,
       COALESCE(SUM(st.subtotal), 0) AS total
     FROM sale_tickets st
     LEFT JOIN ticket_types t ON t.id = st.ticket_type_id
     LEFT JOIN sales s ON s.id = st.sale_id
     WHERE ${where.join(" AND ")}
     GROUP BY st.ticket_type_name, t.kind ORDER BY total DESC`,
    ...params
  );
  return {
    type: "entradas",
    title: "Reporte de entradas y boletas",
    columns: [
      { key: "tipo", label: "Tipo" },
      { key: "clase", label: "Clase" },
      { key: "cantidad", label: "Cantidad" },
      { key: "total", label: "Total" }
    ],
    rows
  };
}
async function reportePagos(f) {
  const { where, params } = buildWhere(f);
  const rows = await allRows3(
    `SELECT s.payment_method AS pago,
       COUNT(*) AS ventas,
       COALESCE(SUM(s.total), 0) AS total
     FROM sales s WHERE ${where.join(" AND ")}
     GROUP BY s.payment_method ORDER BY total DESC`,
    ...params
  );
  return {
    type: "pagos",
    title: "Reporte por forma de pago",
    columns: [
      { key: "pago", label: "Forma de pago" },
      { key: "ventas", label: "Ventas" },
      { key: "total", label: "Total" }
    ],
    rows: rows.map((r) => ({ ...r, pago: P_LABEL[r.pago] || r.pago }))
  };
}
async function reporteVentas(f) {
  const { where, params } = buildWhere(f);
  const rows = await allRows3(
    `SELECT COALESCE(u.name, 'Eliminado') AS vendedor, si.product_name AS producto,
       COALESCE(SUM(si.quantity), 0) AS cantidad,
       COALESCE(SUM(si.subtotal), 0) AS total
     FROM sale_items si
     LEFT JOIN sales s ON s.id = si.sale_id
     LEFT JOIN users u ON u.id = s.user_id
     WHERE ${where.join(" AND ")}
     GROUP BY u.name, si.product_name
     ORDER BY total DESC`,
    ...params
  );
  return {
    type: "ventas",
    title: "Ventas por producto y vendedor",
    columns: [
      { key: "vendedor", label: "Vendedor" },
      { key: "producto", label: "Producto" },
      { key: "cantidad", label: "Cantidad" },
      { key: "total", label: "Total" }
    ],
    rows
  };
}
async function reporteCierres(f) {
  const where = [];
  const params = [];
  if (f.event_id) {
    where.push("c.event_id = ?");
    params.push(f.event_id);
  }
  if (f.box_id) {
    where.push("c.box_id = ?");
    params.push(f.box_id);
  }
  if (f.user_id) {
    where.push("c.user_id = ?");
    params.push(f.user_id);
  }
  if (f.from) {
    where.push("c.opened_at >= ?");
    params.push(f.from + " 00:00:00");
  }
  if (f.to) {
    where.push("c.closed_at <= ?");
    params.push(f.to + " 23:59:59");
  }
  const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";
  const rows = await allRows3(
    `SELECT c.id, b.name AS caja, u.name AS cajero,
       c.opened_at AS apertura, c.closed_at AS cierre,
       c.expected_total AS esperado, c.declared_total AS declarado, c.difference AS diferencia,
       c.status AS estado
     FROM closes c
     LEFT JOIN boxes b ON b.id = c.box_id
     LEFT JOIN users u ON u.id = c.user_id
     ${whereSql}
     ORDER BY c.id DESC`,
    ...params
  );
  return {
    type: "cierres",
    title: "Reporte de cierres de caja",
    columns: [
      { key: "id", label: "N\xB0" },
      { key: "caja", label: "Caja" },
      { key: "cajero", label: "Encargado" },
      { key: "apertura", label: "Apertura" },
      { key: "cierre", label: "Cierre" },
      { key: "esperado", label: "Esperado" },
      { key: "declarado", label: "Declarado" },
      { key: "diferencia", label: "Diferencia" },
      { key: "estado", label: "Estado" }
    ],
    rows
  };
}
async function getReport(type, f) {
  switch (type) {
    case "diario":
      return reporteDiario(f);
    case "cajeros":
      return reporteCajeros(f);
    case "cajas":
      return reporteCajas(f);
    case "productos":
      return reporteProductos(f);
    case "entradas":
      return reporteEntradas(f);
    case "pagos":
      return reportePagos(f);
    case "ventas":
      return reporteVentas(f);
    case "cierres":
      return reporteCierres(f);
    default:
      throw BadRequest("Reporte no v\xE1lido");
  }
}
var P_LABEL;
var init_reports_service = __esm({
  "src/server/services/reports.service.ts"() {
    "use strict";
    init_errors();
    init_db();
    P_LABEL = {
      efectivo: "Efectivo",
      transferencia: "Transferencia",
      tarjeta: "Tarjeta",
      otro: "Otro"
    };
  }
});

// src/server/routes/dashboard.routes.ts
async function resolveEventScope(req, eventId) {
  if (eventId) {
    await assertEventAccess(req.user, eventId);
    return eventId;
  }
  if (req.user.role === "superadmin") return void 0;
  const events = await listEvents(req.user);
  return events[0]?.id;
}
var import_express5, router5, dashboard_routes_default;
var init_dashboard_routes = __esm({
  "src/server/routes/dashboard.routes.ts"() {
    "use strict";
    import_express5 = require("express");
    init_auth();
    init_dashboard_service();
    init_reports_service();
    init_events_service();
    init_helpers();
    router5 = (0, import_express5.Router)();
    router5.use(requireAuth);
    router5.get("/dashboard", asyncHandler(async (req, res) => {
      const q = req.query;
      const eventId = parseOptionalInt(q.event_id);
      const scope = await resolveEventScope(req, eventId);
      if (eventId === void 0 && scope === void 0 && req.user.role !== "superadmin") {
        res.json({ total_recaudado: 0, total_efectivo: 0, total_transferencia: 0, total_tarjeta: 0, total_otro: 0, total_ventas: 0, total_entradas: 0, total_boletas: 0, total_productos: 0, ventas_anuladas: 0, monto_anulado: 0 });
        return;
      }
      res.json(await dashboard(scope, q.from, q.to));
    }));
    router5.get("/stats", asyncHandler(async (req, res) => {
      const q = req.query;
      const eventId = parseOptionalInt(q.event_id);
      const scope = await resolveEventScope(req, eventId);
      if (eventId === void 0 && scope === void 0 && req.user.role !== "superadmin") {
        res.json({ por_hora: [], por_dia: [], top_productos: [], por_categoria: [], por_cajero: [], por_caja: [], por_pago: [], por_tipo_ticket: [] });
        return;
      }
      res.json(await stats(scope, q.from, q.to));
    }));
    router5.get("/reports/:type", async (req, res, next) => {
      try {
        const q = req.query;
        const eventId = parseOptionalInt(q.event_id);
        await assertEventAccess(req.user, eventId ?? 0);
        const result = await getReport(req.params.type, {
          event_id: eventId,
          box_id: parseOptionalInt(q.box_id),
          user_id: parseOptionalInt(q.user_id),
          from: q.from,
          to: q.to
        });
        res.json(result);
      } catch (e) {
        next(e);
      }
    });
    dashboard_routes_default = router5;
  }
});

// src/server/services/backup.service.ts
function cloudDisabled(what) {
  throw BadRequest(`En la versi\xF3n nube los backups se manejan con los nativos de ${what === "Supabase" ? "Supabase" : "la plataforma"}.`);
}
function initBackupService() {
  const backupsDir = import_path3.default.join(process.cwd(), "backups");
  try {
    if (!(0, import_fs3.existsSync)(backupsDir)) (0, import_fs3.mkdirSync)(backupsDir, { recursive: true });
  } catch {
  }
  const stamp = () => {
    const d = /* @__PURE__ */ new Date();
    const pad = (x) => String(x).padStart(2, "0");
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  };
  async function createBackup(userId) {
    if (IS_CLOUD) cloudDisabled("Supabase");
    const src = import_path3.default.join(getDataDir3(), "eventos.db");
    const name = `backup_${stamp()}.db`;
    const dest = import_path3.default.join(backupsDir, name);
    if (!(0, import_fs3.existsSync)(src)) throw BadRequest("No hay base de datos que respaldar");
    await checkpointWal3();
    (0, import_fs3.copyFileSync)(src, dest);
    const info = infoFor(dest);
    logger.info("backup", `Backup creado: ${name}`);
    await audit(userId ?? null, "backup", "backup", null, { name });
    return info;
  }
  function infoFor(p) {
    const st = (0, import_fs3.statSync)(p);
    return {
      name: import_path3.default.basename(p),
      size: st.size,
      created_at: st.mtime.toISOString()
    };
  }
  async function listBackups() {
    if (IS_CLOUD) return [];
    if (!(0, import_fs3.existsSync)(backupsDir)) return [];
    const list = (0, import_fs3.readdirSync)(backupsDir).filter((f) => f.endsWith(".db")).map((f) => {
      try {
        return infoFor(import_path3.default.join(backupsDir, f));
      } catch {
        return null;
      }
    }).filter((x) => x !== null);
    return list.sort((a, b) => a.created_at < b.created_at ? 1 : -1);
  }
  async function deleteBackup(name) {
    if (IS_CLOUD) cloudDisabled("Supabase");
    const safe = import_path3.default.basename(name);
    if (!safe.startsWith("backup_")) throw BadRequest("Nombre de backup inv\xE1lido");
    const full = import_path3.default.join(backupsDir, safe);
    if (!(0, import_fs3.existsSync)(full)) throw BadRequest("Backup no encontrado");
    (0, import_fs3.unlinkSync)(full);
    return true;
  }
  async function restoreBackup(name) {
    if (IS_CLOUD) cloudDisabled("Supabase");
    const safe = import_path3.default.basename(name);
    const full = import_path3.default.join(backupsDir, safe);
    if (!(0, import_fs3.existsSync)(full)) throw BadRequest("Backup no encontrado");
    const target = import_path3.default.join(getDataDir3(), "eventos.db");
    const journal = import_path3.default.join(getDataDir3(), "eventos.db-wal");
    const shm = import_path3.default.join(getDataDir3(), "eventos.db-shm");
    await checkpointWal3();
    await closeDb3();
    try {
      for (const extra of [journal, shm]) {
        if ((0, import_fs3.existsSync)(extra)) (0, import_fs3.unlinkSync)(extra);
      }
      (0, import_fs3.copyFileSync)(full, target);
      logger.info("backup", `Backup restaurado: ${safe}`);
      await audit(null, "restore", "backup", null, { name: safe });
    } finally {
      await reopenDb3();
    }
  }
  async function autoBackupIfEnabled() {
    if (IS_CLOUD) return;
    const { getSetting: getSetting2 } = (init_settings_service(), __toCommonJS(settings_service_exports));
    if (await getSetting2("auto_backup") === "1") {
      try {
        await createBackup(null);
      } catch (e) {
        logger.error("backup", "Error en backup autom\xE1tico", e);
      }
    }
  }
  return { backupsDir, createBackup, listBackups, deleteBackup, restoreBackup, autoBackupIfEnabled };
}
var import_fs3, import_path3, IS_CLOUD;
var init_backup_service = __esm({
  "src/server/services/backup.service.ts"() {
    "use strict";
    init_errors();
    import_fs3 = require("fs");
    import_path3 = __toESM(require("path"));
    init_db();
    init_logger();
    init_audit_service();
    IS_CLOUD = !!process.env.DATABASE_URL;
  }
});

// src/server/routes/system.routes.ts
var import_express6, import_fs4, import_path4, router6, IS_CLOUD2, backup, system_routes_default;
var init_system_routes = __esm({
  "src/server/routes/system.routes.ts"() {
    "use strict";
    import_express6 = require("express");
    import_fs4 = require("fs");
    import_path4 = __toESM(require("path"));
    init_auth();
    init_settings_service();
    init_backup_service();
    init_logger();
    init_helpers();
    init_db();
    router6 = (0, import_express6.Router)();
    router6.use(requireAuth);
    IS_CLOUD2 = !!process.env.DATABASE_URL;
    backup = initBackupService();
    router6.get("/settings", requireRole("superadmin", "admin"), async (_req, res) => {
      res.json(await getSettings());
    });
    router6.put("/settings", requireRole("superadmin", "admin"), async (req, res, next) => {
      try {
        const body = req.body || {};
        if ("key" in body && "value" in body) {
          await setSetting(String(body.key), String(body.value), req.user.id);
        } else {
          for (const [k, v] of Object.entries(body)) {
            if (v !== void 0 && v !== null) await setSetting(k, String(v), req.user.id);
          }
        }
        res.json(await getSettings());
      } catch (e) {
        next(e);
      }
    });
    router6.get("/logs", requireRole("superadmin"), async (req, res) => {
      const q = req.query;
      res.json(
        await listAppLogs({
          level: q.level,
          from: q.from,
          to: q.to,
          module: q.module,
          limit: parseOptionalInt(q.limit) ?? 200
        })
      );
    });
    router6.delete("/logs", requireRole("superadmin"), async (_req, res) => {
      await clearAppLogs();
      res.json({ ok: true });
    });
    router6.get("/audit", requireRole("superadmin"), async (req, res) => {
      const q = req.query;
      res.json(
        await listAudit({
          user_id: parseOptionalInt(q.user_id),
          from: q.from,
          to: q.to,
          limit: parseOptionalInt(q.limit) ?? 200
        })
      );
    });
    router6.get("/backups", requireRole("superadmin"), async (_req, res) => {
      res.json(await backup.listBackups());
    });
    router6.post("/backups", requireRole("superadmin"), async (req, res, next) => {
      try {
        const info = await backup.createBackup(req.user.id);
        res.json(info);
      } catch (e) {
        next(e);
      }
    });
    router6.delete("/backups/:name", requireRole("superadmin"), async (req, res, next) => {
      try {
        await backup.deleteBackup(decodeURIComponent(req.params.name));
        res.json({ ok: true });
      } catch (e) {
        next(e);
      }
    });
    router6.post("/backups/:name/restore", requireRole("superadmin"), async (req, res, next) => {
      try {
        await backup.restoreBackup(decodeURIComponent(req.params.name));
        res.json({ ok: true });
      } catch (e) {
        next(e);
      }
    });
    router6.get("/backups/download/:name", requireRole("superadmin"), (req, res) => {
      if (IS_CLOUD2) {
        res.status(400).json({ error: "En la versi\xF3n nube los backups se manejan con los nativos de Supabase", code: "VALIDATION" });
        return;
      }
      const name = decodeURIComponent(req.params.name);
      const safe = import_path4.default.basename(name);
      const full = import_path4.default.join(backup.backupsDir, safe);
      if (!(0, import_fs4.existsSync)(full)) {
        res.status(404).json({ error: "Backup no encontrado" });
        return;
      }
      res.download(full, safe);
    });
    router6.get("/db/download", requireRole("superadmin"), (_req, res) => {
      if (IS_CLOUD2) {
        res.status(400).json({ error: "En la versi\xF3n nube los datos se administran desde Supabase", code: "VALIDATION" });
        return;
      }
      const src = import_path4.default.join(getDataDir3(), "eventos.db");
      if (!(0, import_fs4.existsSync)(src)) {
        res.status(404).json({ error: "No hay base de datos" });
        return;
      }
      res.download(src, "eventos_pos_backup.db");
    });
    router6.get("/health", (_req, res) => {
      res.json({ ok: true, time: (/* @__PURE__ */ new Date()).toISOString() });
    });
    router6.get("/time", (_req, res) => {
      const d = /* @__PURE__ */ new Date();
      const pad = (x) => String(x).padStart(2, "0");
      res.json({
        iso: d.toISOString(),
        local: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
        epoch: d.getTime()
      });
    });
    router6.post("/log/client", (req, res) => {
      const { level, module: module2, message, details } = req.body || {};
      logger.log({
        level: ["info", "warn", "error", "fatal"].includes(level) ? level : "error",
        module: String(module2 || "client"),
        message: String(message || "Error de cliente"),
        details,
        userId: req.user?.id,
        device: req.device
      });
      res.json({ ok: true });
    });
    system_routes_default = router6;
  }
});

// src/server/rateLimit.ts
function getClientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string") return fwd.split(",")[0].trim();
  return req.ip || req.socket.remoteAddress || "unknown";
}
function createLimiter(windowMs, max) {
  const buckets = /* @__PURE__ */ new Map();
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, b] of buckets) {
      if (now >= b.resetAt) buckets.delete(key);
    }
  }, Math.max(windowMs, 6e4));
  if (timer.unref) timer.unref();
  if (!process.env.DATABASE_URL || process.env.NODE_ENV === "test") {
    return (_req, _res, next) => next();
  }
  return (req, res, next) => {
    const ip = getClientIp(req);
    const now = Date.now();
    let bucket = buckets.get(ip);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(ip, bucket);
    }
    bucket.count++;
    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, max - bucket.count));
    res.setHeader("X-RateLimit-Reset", Math.ceil(bucket.resetAt / 1e3));
    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1e3);
      res.setHeader("Retry-After", retryAfter);
      res.status(429).json({ error: "Demasiadas solicitudes. Esper\xE1 e intent\xE1 de nuevo.", code: "RATE_LIMIT" });
      return;
    }
    next();
  };
}
var rateLimitGeneral, rateLimitAuth, rateLimitSales;
var init_rateLimit = __esm({
  "src/server/rateLimit.ts"() {
    "use strict";
    rateLimitGeneral = createLimiter(6e4, 100);
    rateLimitAuth = createLimiter(6e4, 10);
    rateLimitSales = createLimiter(6e4, 30);
  }
});

// src/server/app.ts
var app_exports = {};
__export(app_exports, {
  createApp: () => createApp,
  startServer: () => startServer
});
function createApp() {
  const app2 = (0, import_express7.default)();
  app2.disable("x-powered-by");
  app2.use(import_express7.default.json({ limit: "2mb" }));
  logger.setDbSink((entry) => {
    insertAppLog3(entry.level, entry.module, entry.message, entry.details, entry.userId ?? null, entry.device).catch(() => {
    });
  });
  app2.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    );
    next();
  });
  app2.use("/api/auth", rateLimitAuth, auth_routes_default);
  app2.use("/api", rateLimitGeneral, data_routes_default);
  app2.use("/api/sales", rateLimitSales, sales_routes_default);
  app2.use("/api/closes", rateLimitGeneral, closes_routes_default);
  app2.use("/api", rateLimitGeneral, dashboard_routes_default);
  app2.use("/api", rateLimitGeneral, system_routes_default);
  const publicDir = [import_path5.default.join(process.cwd(), "dist", "public"), import_path5.default.join(process.cwd(), "public")].find((p) => (0, import_fs5.existsSync)(p));
  if (publicDir) {
    app2.use(import_express7.default.static(publicDir));
    app2.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) return next();
      res.sendFile(import_path5.default.join(publicDir, "index.html"));
    });
  } else {
    app2.get("/", (_req, res) => {
      res.send("Servidor Eventos POS corriendo. Ejecut\xE1 el frontend con `npm run dev`");
    });
  }
  app2.use(errorHandler);
  return app2;
}
function startServer(port = 4100) {
  const app2 = createApp();
  const server = app2.listen(port, "0.0.0.0", () => {
    logger.info("server", `Servidor escuchando en http://localhost:${port}`);
  });
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      logger.error("server", `El puerto ${port} ya est\xE1 en uso`, err);
    } else {
      logger.error("server", "Error del servidor", err);
    }
  });
  return server;
}
var import_express7, import_path5, import_fs5;
var init_app = __esm({
  "src/server/app.ts"() {
    "use strict";
    import_express7 = __toESM(require("express"));
    import_path5 = __toESM(require("path"));
    import_fs5 = require("fs");
    init_auth_routes();
    init_data_routes();
    init_sales_routes();
    init_closes_routes();
    init_dashboard_routes();
    init_system_routes();
    init_auth();
    init_logger();
    init_db();
    init_rateLimit();
  }
});

// serverless/entry.ts
var db2 = (init_db(), __toCommonJS(db_exports));
var appModule = (init_app(), __toCommonJS(app_exports));
var initPromise = null;
var app = null;
async function handler(req, res) {
  if (!initPromise) {
    initPromise = db2.initDb().then(() => {
      app = appModule.createApp();
    });
  }
  try {
    await initPromise;
    app(req, res);
  } catch (e) {
    initPromise = null;
    const message = e && e.message || "Error interno del servidor";
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: message, code: "SERVER_ERROR" }));
  }
}
module.exports = handler;
