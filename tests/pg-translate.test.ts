import { test } from 'node:test';
import assert from 'node:assert';
import { translateSql } from '../src/server/db/pg';

test('traduce placeholders ? a $n', () => {
  assert.strictEqual(
    translateSql('SELECT * FROM users WHERE id = ? AND active = ?'),
    'SELECT * FROM users WHERE id = $1 AND active = $2',
  );
});

test('traduce datetime now localtime a NOW()', () => {
  assert.strictEqual(
    translateSql("UPDATE users SET last_login_at = datetime('now','localtime') WHERE id = ?"),
    'UPDATE users SET last_login_at = NOW() WHERE id = $1',
  );
});

test('traduce strftime hora a EXTRACT', () => {
  assert.strictEqual(
    translateSql("SELECT CAST(strftime('%H', s.created_at) AS INTEGER) AS h FROM sales s"),
    'SELECT CAST(EXTRACT(HOUR FROM s.created_at) AS INTEGER) AS h FROM sales s',
  );
});

test('traduce substr de fecha a to_char', () => {
  assert.strictEqual(
    translateSql('SELECT substr(s.created_at, 1, 10) AS d FROM sales s GROUP BY d ORDER BY d'),
    "SELECT to_char(s.created_at, 'YYYY-MM-DD') AS d FROM sales s GROUP BY d ORDER BY d",
  );
});

test('traduce INSERT OR IGNORE a ON CONFLICT DO NOTHING', () => {
  assert.strictEqual(
    translateSql('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'),
    'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT DO NOTHING',
  );
});

test('no toca ON CONFLICT existente ni LIMIT OFFSET', () => {
  assert.strictEqual(
    translateSql('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'),
    'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  );
  assert.strictEqual(
    translateSql('SELECT * FROM sales ORDER BY id DESC LIMIT ? OFFSET ?'),
    'SELECT * FROM sales ORDER BY id DESC LIMIT $1 OFFSET $2',
  );
});
