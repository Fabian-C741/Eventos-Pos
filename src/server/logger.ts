import { appendFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'fs';
import path from 'path';

export type LogLevel = 'info' | 'warn' | 'error' | 'fatal';

export interface LogPayload {
  level: LogLevel;
  module: string;
  message: string;
  details?: unknown;
  userId?: number | null;
  device?: string;
}

export class Logger {
  private logDir: string;
  private db?: (entry: Omit<LogPayload, 'device'> & { device?: string }) => void;
  private maxAgeDays = 30;

  constructor(logDir: string) {
    this.logDir = logDir;
    if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
    this.rotate();
  }

  setDbSink(fn: (entry: Omit<LogPayload, 'device'> & { device?: string }) => void) {
    this.db = fn;
  }

  private fileFor(date: Date): string {
    const d = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return path.join(this.logDir, `${d}.log`);
  }

  private writeFile(entry: LogPayload) {
    const line = `[${new Date().toISOString()}] [${entry.level.toUpperCase()}] [${entry.module}] ${entry.message}` +
      (entry.userId ? ` | user=${entry.userId}` : '') +
      (entry.device ? ` | device=${entry.device}` : '') +
      (entry.details !== undefined ? ` | ${typeof entry.details === 'string' ? entry.details : JSON.stringify(entry.details)}` : '') +
      '\n';
    try {
      appendFileSync(this.fileFor(new Date()), line, 'utf8');
    } catch {
      /* noop */
    }
  }

  log(entry: LogPayload) {
    this.writeFile(entry);
    const msg = `[${entry.level.toUpperCase()}] [${entry.module}] ${entry.message}`;
    if (entry.level === 'error' || entry.level === 'fatal') {
      console.error(msg, entry.details ?? '');
    } else if (entry.level === 'warn') {
      console.warn(msg);
    } else {
      console.log(msg);
    }
    if (this.db && (entry.level === 'error' || entry.level === 'fatal' || entry.level === 'warn')) {
      try {
        this.db({
          level: entry.level,
          module: entry.module,
          message: entry.message,
          details: entry.details !== undefined ? JSON.stringify(entry.details) : null,
          userId: entry.userId ?? null,
          device: entry.device,
        });
      } catch {
        /* noop */
      }
    }
  }

  info(module: string, message: string, details?: unknown, userId?: number | null, device?: string) {
    this.log({ level: 'info', module, message, details, userId, device });
  }

  warn(module: string, message: string, details?: unknown, userId?: number | null, device?: string) {
    this.log({ level: 'warn', module, message, details, userId, device });
  }

  error(module: string, message: string, details?: unknown, userId?: number | null, device?: string) {
    this.log({ level: 'error', module, message, details, userId, device });
  }

  fatal(module: string, message: string, details?: unknown, userId?: number | null, device?: string) {
    this.log({ level: 'fatal', module, message, details, userId, device });
  }

  rotate() {
    try {
      const cutoff = Date.now() - this.maxAgeDays * 24 * 60 * 60 * 1000;
      for (const file of readdirSync(this.logDir)) {
        const full = path.join(this.logDir, file);
        try {
          const st = statSync(full);
          if (st.mtimeMs < cutoff) rmSync(full, { force: true });
        } catch {
          /* noop */
        }
      }
    } catch {
      /* noop */
    }
  }
}

export const logger = new Logger(path.join(process.cwd(), 'logs'));