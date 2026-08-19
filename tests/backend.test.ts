import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initDb, closeDb } from '../src/server/db/db';
import { createApp } from '../src/server/app';
import type { Server } from 'node:http';

let tmpDir: string;
let server: Server;
let base: string;
let token = '';
let eventId = 0;
let catId = 0;
let pTorta: { id: number };
let pGaseosa: { id: number };
let tEntrada: { id: number };
let boxId = 0;

async function api(method: string, url: string, body?: unknown, auth = true) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(base + url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

before(async () => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), 'eventos-test-'));
  process.env.EVENTOS_DATA_DIR = tmpDir;
  initDb({ dataDir: tmpDir });
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const addr = server.address();
  base = `http://127.0.0.1:${(addr as { port: number }).port}/api`;
});

after(() => {
  server?.close();
  closeDb();
  try {
    rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    /* noop */
  }
});

test('setup + login superadmin', async () => {
  let r = await api('GET', '/auth/status', undefined, false);
  assert.equal(r.json.setup, true);

  r = await api('POST', '/auth/setup', { email: 'admin@evento.com', password: 'segura123', name: 'Super Admin' }, false);
  assert.equal(r.status, 200);
  assert.equal(r.json.ok, true);

  r = await api('POST', '/auth/login', { username: 'admin@evento.com', password: 'segura123' }, false);
  assert.equal(r.status, 200);
  token = r.json.token;
  assert.ok(token);
  assert.equal(r.json.user.role, 'superadmin');
});

test('crear evento', async () => {
  const r = await api('POST', '/events', { name: 'Evento 2026', venue: 'Parque Central' });
  assert.equal(r.status, 200);
  eventId = r.json.id;
  assert.ok(eventId > 0);
});

test('crear categorías y productos', async () => {
  let r = await api('POST', `/events/${eventId}/categories`, { name: 'Comidas', icon: '🍔', color: '#f59e0b' });
  catId = r.json.id;
  r = await api('POST', `/events/${eventId}/products`, { name: 'Torta', price: 5000, category_id: catId, icon: '🍰' });
  pTorta = { id: r.json.id };
  r = await api('POST', `/events/${eventId}/products`, { name: 'Gaseosa', price: 2500, category_id: catId, icon: '🥤' });
  pGaseosa = { id: r.json.id };

  const list = await api('GET', `/events/${eventId}/products`);
  assert.equal(list.json.length, 2);
  const prices = list.json.map((p: { name: string; price: number }) => p.price).sort((a: number, b: number) => a - b);
  assert.deepEqual(prices, [2500, 5000]);
});

test('crear tipo de entrada con numeración', async () => {
  const r = await api('POST', `/events/${eventId}/tickets`, {
    name: 'Entrada General',
    price: 8000,
    kind: 'entrada',
    start_number: 100,
    digits: 4,
  });
  assert.equal(r.status, 200);
  tEntrada = { id: r.json.id };
  assert.equal(r.json.last_number, 99);
});

test('crear caja', async () => {
  const r = await api('POST', `/events/${eventId}/boxes`, { name: 'Caja 1' });
  boxId = r.json.id;
});

test('venta con productos y entradas numeradas', async () => {
  const r = await api('POST', '/sales', {
    event_id: eventId,
    box_id: boxId,
    payment_method: 'efectivo',
    items: [{ product_id: pTorta.id, quantity: 3 }],
    tickets: [{ ticket_type_id: tEntrada.id, quantity: 2 }],
  });
  assert.equal(r.status, 200);
  assert.equal(r.json.sale.total, 5000 * 3 + 8000 * 2);
  assert.deepEqual(r.json.ticketNumbers[tEntrada.id], [100, 101]);
  assert.equal(r.json.sale.operation_number, 1);
});

test('numeración automática continúa', async () => {
  const r = await api('POST', '/sales', {
    event_id: eventId,
    box_id: boxId,
    payment_method: 'transferencia',
    items: [],
    tickets: [{ ticket_type_id: tEntrada.id, quantity: 5 }],
  });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.ticketNumbers[tEntrada.id], [102, 103, 104, 105, 106]);
  assert.equal(r.json.sale.operation_number, 2);
  assert.equal(r.json.sale.total, 8000 * 5);
});

test('múltiples ventas rápidas consecutivas', async () => {
  for (let i = 0; i < 40; i++) {
    const r = await api('POST', '/sales', {
      event_id: eventId,
      box_id: boxId,
      payment_method: i % 2 === 0 ? 'efectivo' : 'transferencia',
      items: [{ product_id: pGaseosa.id, quantity: 1 }],
      tickets: [],
    });
    assert.equal(r.status, 200, `venta ${i} falló`);
  }
  const list = await api('GET', `/sales?event_id=${eventId}&limit=200`);
  assert.equal(list.json.length, 42);
  const last = list.json[0];
  assert.equal(last.operation_number, 42);
});

test('venta con cantidades inválidas es rechazada', async () => {
  const r = await api('POST', '/sales', {
    event_id: eventId,
    box_id: boxId,
    payment_method: 'efectivo',
    items: [{ product_id: pTorta.id, quantity: 0 }],
    tickets: [],
  });
  assert.equal(r.status, 400);
});

test('crear cajero con PIN y login PIN', async () => {
  let r = await api('POST', '/users', { username: 'cajero1', name: 'Ana Cajero', role: 'cajero', pin: '1234' });
  assert.equal(r.status, 200);

  r = await api('POST', '/auth/login/pin', { username: 'cajero1', pin: '1234' }, false);
  assert.equal(r.status, 200);
  assert.equal(r.json.user.role, 'cajero');

  r = await api('POST', '/auth/login/pin', { username: 'cajero1', pin: '9999' }, false);
  assert.equal(r.status, 400);
});

test('rate limit: bloqueo tras 5 intentos fallidos', async () => {
  await api('POST', '/users', { username: 'cajero_llave', name: 'Cajero de prueba', role: 'cajero', pin: '4321' });
  for (let i = 0; i < 5; i++) {
    const r = await api('POST', '/auth/login/pin', { username: 'cajero_llave', pin: '0000' }, false);
    assert.equal(r.status, 400);
  }
  const blocked = await api('POST', '/auth/login/pin', { username: 'cajero_llave', pin: '4321' }, false);
  assert.equal(blocked.status, 400);
  assert.match(blocked.json.error, /Demasiados intentos/);
});

test('admin no puede crear admin', async () => {
  let r = await api('POST', '/users', { username: 'admin1', name: 'Admin Uno', role: 'admin', password: 'clave123' });
  const adminId = r.json.id;

  const login = await api('POST', '/auth/login', { username: 'admin1', password: 'clave123' }, false);
  const adminToken = login.json.token;
  const adminHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` };

  const res = await fetch(base + '/users', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ username: 'admin2', name: 'Otro', role: 'admin', password: 'clave123' }),
  });
  assert.equal(res.status, 403);

  const resOk = await fetch(base + '/users', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ username: 'cajero2', name: 'Cajero Dos', role: 'cajero', pin: '5678' }),
  });
  assert.equal(resOk.status, 200);
});

test('anulación de venta con motivo', async () => {
  const list = await api('GET', `/sales?event_id=${eventId}&limit=5`);
  const saleId = list.json[0].id;

  let r = await api('POST', `/sales/${saleId}/void`, { reason: 'Cobro por error' });
  assert.equal(r.status, 200);
  assert.equal(r.json.status, 'anulada');
  assert.equal(r.json.voided.reason, 'Cobro por error');

  r = await api('POST', `/sales/${saleId}/void`, { reason: 'Doble' });
  assert.equal(r.status, 400);
});

test('cierre de caja con diferencia', async () => {
  let r = await api('POST', '/closes/open', { event_id: eventId, box_id: boxId });
  assert.equal(r.status, 200);
  const closeId = r.json.id;

  r = await api('GET', `/closes/box/${boxId}/current`);
  const summary = r.json.summary;

  r = await api('POST', `/closes/${closeId}/close`, {
    declared_by_payment: { efectivo: summary.by_payment.efectivo, transferencia: summary.by_payment.transferencia, tarjeta: 0, otro: 0 },
  });
  assert.equal(r.status, 200);
  assert.equal(r.json.status, 'cerrado');
  assert.equal(r.json.expected_total, summary.total);
});

test('dashboard con datos reales', async () => {
  const r = await api('GET', `/dashboard?event_id=${eventId}`);
  assert.equal(r.status, 200);
  assert.ok(r.json.total_recaudado > 0);
  assert.ok(r.json.total_ventas > 0);
  assert.ok(r.json.total_entradas > 0);
});

test('estadísticas', async () => {
  const r = await api('GET', `/stats?event_id=${eventId}`);
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.json.top_productos));
  assert.ok(Array.isArray(r.json.por_hora));
  assert.ok(Array.isArray(r.json.por_pago));
});

test('reportes', async () => {
  for (const t of ['diario', 'cajeros', 'cajas', 'productos', 'entradas', 'pagos']) {
    const r = await api('GET', `/reports/${t}?event_id=${eventId}`);
    assert.equal(r.status, 200, `reporte ${t}`);
    assert.ok(r.json.columns.length > 0);
  }
});

test('backup y restauración', async () => {
  let r = await api('POST', '/backups');
  assert.equal(r.status, 200);
  const name = r.json.name;

  r = await api('GET', '/backups');
  assert.ok(r.json.some((b: { name: string }) => b.name === name));

  r = await api('POST', `/backups/${encodeURIComponent(name)}/restore`);
  assert.equal(r.status, 200);

  r = await api('DELETE', `/backups/${encodeURIComponent(name)}`);
  assert.equal(r.status, 200);
});

test('logs registran errores', async () => {
  const before = await api('GET', '/logs?limit=50');
  // genera un error controlado
  await api('POST', '/sales', {
    event_id: eventId,
    box_id: boxId,
    payment_method: 'efectivo',
    items: [{ product_id: 999999, quantity: 1 }],
    tickets: [],
  });
  const after = await api('GET', '/logs?limit=50');
  assert.ok(after.json.length > 0);
});

test('auditoría registra acciones', async () => {
  const r = await api('GET', '/audit?limit=50');
  assert.ok(r.json.length > 0);
  assert.ok(r.json.some((a: { action: string }) => a.action === 'create'));
});

test('configuración', async () => {
  let r = await api('GET', '/settings');
  assert.equal(r.status, 200);
  r = await api('PUT', '/settings', { key: 'app_name', value: 'Mi Evento' });
  assert.equal(r.json.app_name, 'Mi Evento');
});

test('cajero no puede anular ventas', async () => {
  const login = await api('POST', '/auth/login/pin', { username: 'cajero1', pin: '1234' }, false);
  const cashierToken = login.json.token;
  const res = await fetch(base + `/sales/1/void`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cashierToken}` },
    body: JSON.stringify({ reason: 'x' }),
  });
  assert.equal(res.status, 403);
});

test('seguridad: sesión inválida rechazada', async () => {
  const res = await fetch(base + '/events', {
    headers: { Authorization: 'Bearer token-invalido' },
  });
  assert.equal(res.status, 401);
});

test('reporte por vendedor incluye quien vendió', async () => {
  const r = await api('GET', `/reports/ventas?event_id=${eventId}`);
  assert.equal(r.status, 200);
  assert.ok(r.json.rows.length > 0);
  assert.ok(r.json.columns.some((c: { key: string }) => c.key === 'vendedor'));
  const row = r.json.rows[0];
  assert.ok(row.producto);
  assert.ok(row.vendedor);
  assert.ok(Number(row.total) > 0);
});

test('cajero puede cerrar su propia caja', async () => {
  const login = await api('POST', '/auth/login/pin', { username: 'cajero1', pin: '1234' }, false);
  const cashierToken = login.json.token;
  const ensure = await fetch(base + `/closes/box/${boxId}/ensure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cashierToken}` },
    body: JSON.stringify({ event_id: eventId }),
  });
  const close = await ensure.json();
  assert.ok(close.id > 0);
  const res = await fetch(base + `/closes/${close.id}/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cashierToken}` },
    body: JSON.stringify({ declared_by_payment: { efectivo: 0, transferencia: 0, tarjeta: 0, otro: 0 } }),
  });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).status, 'cerrado');
});

test('eliminar evento borra ventas, productos y categorías', async () => {
  const r = await api('DELETE', `/events/${eventId}`);
  assert.equal(r.status, 200);
  assert.equal(r.json.ok, true);
  const prods = await api('GET', `/events/${eventId}/products`);
  assert.equal(prods.json.length, 0);
  const cats = await api('GET', `/events/${eventId}/categories`);
  assert.equal(cats.json.length, 0);
  const sales = await api('GET', `/sales?event_id=${eventId}`);
  assert.equal(sales.json.length, 0);
  const closes = await api('GET', `/closes?event_id=${eventId}`);
  assert.equal(closes.json.length, 0);
});

test('editar cajero: cambiar solo el nombre respeta el PIN actual', async () => {
  const list = await api('GET', '/users');
  const cajero = list.json.find((u: { username: string }) => u.username === 'cajero1');
  assert.ok(cajero);

  const r = await api('PUT', `/users/${cajero.id}`, { name: 'Ana Nuevo Nombre', active: 1 });
  assert.equal(r.status, 200);

  const login = await api('POST', '/auth/login/pin', { username: 'cajero1', pin: '1234' }, false);
  assert.equal(login.status, 200);
  assert.equal(login.json.user.name, 'Ana Nuevo Nombre');

  const me = await fetch(base + '/auth/me', {
    headers: { Authorization: `Bearer ${login.json.token}` },
  });
  assert.equal((await me.json()).name, 'Ana Nuevo Nombre');

  const r2 = await api('PUT', `/users/${cajero.id}`, { name: 'Ana Final', pin: '5678' });
  assert.equal(r2.status, 200);
  const login2 = await api('POST', '/auth/login/pin', { username: 'cajero1', pin: '5678' }, false);
  assert.equal(login2.status, 200);
  assert.equal(login2.json.user.name, 'Ana Final');
});