import { BadRequest } from '../errors';
import { allRows, exec, getRow } from '../db/db';
import { audit } from './audit.service';
import type { Product } from '../../shared/types';

export async function listProducts(eventId: number, includeInactive = true): Promise<Product[]> {
  const sql = includeInactive
    ? 'SELECT * FROM products WHERE event_id = ? ORDER BY active DESC, sort_order, name'
    : 'SELECT * FROM products WHERE event_id = ? AND active = 1 ORDER BY sort_order, name';
  return allRows<Product>(sql, eventId);
}

export async function getProduct(id: number): Promise<Product | undefined> {
  return getRow<Product>('SELECT * FROM products WHERE id = ?', id);
}

export async function createProduct(eventId: number, input: { name: string; price: number; category_id?: number | null; icon?: string; color?: string; sort_order?: number }, userId: number) {
  const name = input.name.trim();
  if (!name) throw BadRequest('El nombre del producto es obligatorio');
  const price = Math.round(Number(input.price));
  if (isNaN(price) || price < 0) throw BadRequest('El precio debe ser un número válido');
  const res = await exec(
    'INSERT INTO products (event_id, category_id, name, price, icon, color, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
    eventId,
    input.category_id ?? null,
    name,
    price,
    input.icon || '🍽️',
    input.color || '#0ea5e9',
    input.sort_order ?? 0,
  );
  await audit(userId, 'create', 'product', res.lastInsertRowid, { event_id: eventId, name, price });
  return getProduct(res.lastInsertRowid)!;
}

export async function updateProduct(id: number, input: Partial<{ name: string; price: number; category_id: number | null; icon: string; color: string; sort_order: number; active: number }>, userId: number) {
  const cur = await getProduct(id);
  if (!cur) throw BadRequest('Producto no encontrado');
  const price = input.price !== undefined ? Math.round(Number(input.price)) : cur.price;
  if (isNaN(price) || price < 0) throw BadRequest('El precio debe ser un número válido');
  await exec(
    `UPDATE products SET name = ?, price = ?, category_id = ?, icon = ?, color = ?, sort_order = ?, active = ? WHERE id = ?`,
    input.name?.trim() ?? cur.name,
    price,
    input.category_id === undefined ? cur.category_id : input.category_id,
    input.icon ?? cur.icon,
    input.color ?? cur.color,
    input.sort_order ?? cur.sort_order,
    input.active === undefined ? cur.active : input.active ? 1 : 0,
    id,
  );
  await audit(userId, 'update', 'product', id, { name: input.name, price });
  return getProduct(id)!;
}

export async function deleteProduct(id: number, userId: number) {
  const used = await getRow<{ c: number }>('SELECT COUNT(*) AS c FROM sale_items WHERE product_id = ?', id);
  if ((used?.c ?? 0) > 0) {
    throw BadRequest('No se puede eliminar un producto ya vendido. Podés desactivarlo.');
  }
  await exec('DELETE FROM products WHERE id = ?', id);
  await audit(userId, 'delete', 'product', id, {});
  return true;
}

export async function duplicateProduct(id: number, userId: number) {
  const cur = await getProduct(id);
  if (!cur) throw BadRequest('Producto no encontrado');
  const res = await exec(
    'INSERT INTO products (event_id, category_id, name, price, icon, color, sort_order, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    cur.event_id,
    cur.category_id,
    cur.name + ' (copia)',
    cur.price,
    cur.icon,
    cur.color,
    cur.sort_order,
    cur.active,
  );
  await audit(userId, 'duplicate', 'product', res.lastInsertRowid, { from: id });
  return getProduct(res.lastInsertRowid)!;
}
