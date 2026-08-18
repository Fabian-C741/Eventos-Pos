import * as sqliteImpl from './sqlite';
import * as pgImpl from './pg';

const impl = process.env.DATABASE_URL ? pgImpl : sqliteImpl;

export const initDb = impl.initDb;
export const getDb = impl.getDb;
export const getDataDir = impl.getDataDir;
export const checkpointWal = impl.checkpointWal;
export const closeDb = impl.closeDb;
export const reopenDb = impl.reopenDb;
export const runInTransaction = impl.runInTransaction;
export const nextSeq = impl.nextSeq;
export const getRow = impl.getRow;
export const allRows = impl.allRows;
export const exec = impl.exec;
export const insertAppLog = impl.insertAppLog;
