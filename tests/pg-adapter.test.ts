import { test } from 'node:test';
import assert from 'node:assert';
import { _setPostgresFactoryForTest, initDb, exec, getRow, allRows, nextSeq, runInTransaction, closeDb } from '../src/server/db/pg';

process.env.DATABASE_URL = 'postgres://u:p@localhost:5432/db';
process.env.EVENTOS_TZ = 'America/Argentina/Buenos_Aires';

function makeFakePg() {
  const tables = new Map<string, { cols: string[]; rows: Record<string, unknown>[]; nextId: number }>();
  const fakeSql = {
    async unsafe(query: string, params: unknown[] = []) {
      const q = query.trim();
      if (q === 'BEGIN' || q === 'COMMIT' || q === 'ROLLBACK') return [];
      if (q.startsWith('CREATE')) {
        const m = q.match(/CREATE TABLE (\w+) \(([\s\S]*)\)/);
        const name = m![1];
        const cols = m![2]
          .split(',')
          .map((c: string) => c.trim().split(/\s+/)[0])
          .filter((c: string) => c !== 'id');
        tables.set(name, { cols, rows: [], nextId: 1 });
        return [];
      }
      const insert = q.match(/INSERT INTO (\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)\s*(RETURNING (\w+))?/i);
      if (insert) {
        const [, name, colsRaw, valsRaw, , retCol] = insert;
        const cols = colsRaw.split(',').map((c: string) => c.trim());
        const vals = valsRaw.split(',').map((v: string) => v.trim());
        const t = tables.get(name)!;
        const row: Record<string, unknown> = { id: t.nextId++ };
        for (let i = 0; i < cols.length; i++) {
          row[cols[i]] = params[Number(vals[i].replace('$', '')) - 1];
        }
        t.rows.push(row);
        if (retCol) return [row];
        return [];
      }
      const update = q.match(/UPDATE (\w+) SET\s+([\s\S]*?) WHERE name = \$1 RETURNING value/i);
      if (update) {
        const t = tables.get(update[1])!;
        const row = t.rows.find((r) => r.name === params[0]);
        if (row) {
          row.value = Number(row.value) + 1;
          return [{ value: row.value }];
        }
        t.rows.push({ name: params[0], value: 1 });
        return [];
      }
      const select = q.match(/SELECT \* FROM (\w+) WHERE (\w+) = \$1/i);
      if (select) {
        const t = tables.get(select[1])!;
        const col = select[2];
        return t.rows.filter((r) => r[col] === params[0]);
      }
      if (/DELETE FROM (\w+) WHERE (\w+) = \$1/.test(q)) {
        const m = q.match(/DELETE FROM (\w+) WHERE (\w+) = \$1/);
        const t = tables.get(m![1])!;
        t.rows = t.rows.filter((r) => r[m![2]] !== params[0]);
        return [];
      }
      throw new Error('Fake no soporta: ' + q);
    },
    async end() {},
  };
  return fakeSql;
}

test('adaptador pg: exec retorna lastInsertRowid via RETURNING', async () => {
  _setPostgresFactoryForTest((() => makeFakePg()) as never);
  await initDb({});
  await exec('CREATE TABLE users (id BIGSERIAL, username TEXT, active INTEGER)');
  const res = await exec('INSERT INTO users (username, active) VALUES (?, ?)', 'ana', 1);
  assert.strictEqual(res.lastInsertRowid, 1);
  assert.strictEqual(res.changes, 1);
  const row = await getRow<{ username: string; active: number }>('SELECT * FROM users WHERE id = ?', 1);
  assert.strictEqual(row!.username, 'ana');
  assert.strictEqual(row!.active, 1);
});

test('adaptador pg: nextSeq y runInTransaction serializan', async () => {
  _setPostgresFactoryForTest((() => makeFakePg()) as never);
  await initDb({});
  await exec('CREATE TABLE seq (name TEXT, value INTEGER)');
  const a = await nextSeq('event_op_1');
  const b = await nextSeq('event_op_1');
  assert.strictEqual(a, 1);
  assert.strictEqual(b, 2);
  const out = await runInTransaction(async () => {
    await exec('INSERT INTO seq (name, value) VALUES (?, ?)', 'x', 1);
    return nextSeq('event_op_1');
  });
  assert.strictEqual(out, 3);
  const rows = await allRows<{ name: string }>('SELECT * FROM seq WHERE name = $1', 'x');
  assert.strictEqual(rows.length, 1);
  await closeDb();
});