import { BadRequest } from '../errors';
import { allRows, exec, getRow } from '../db/db';
import { audit } from './audit.service';
import type { Category } from '../../shared/types';

export async function listCategories(eventId: number): Promise<Category[]> {
  return allRows<Category>(
    'SELECT * FROM categories WHERE event_id = ? ORDER BY sort_order, name',
    eventId,
  );
}

export async function getCategory(id: number): Promise<Category | undefined> {
  return getRow<Category>('SELECT * FROM categories WHERE id = ?', id);
}

export async function createCategory(eventId: number, input: { name: string; icon?: string; color?: string; sort_order?: number }, userId: number) {
  const name = input.name.trim();
  if (!name) throw BadRequest('El nombre de la categoría es obligatorio');
  const res = await exec(
    'INSERT INTO categories (event_id, name, icon, color, sort_order) VALUES (?, ?, ?, ?, ?)',
    eventId,
    name,
    input.icon || '📦',
    input.color || '#0ea5e9',
    input.sort_order ?? 0,
  );
  await audit(userId, 'create', 'category', res.lastInsertRowid, { event_id: eventId, name });
  return getRow<Category>('SELECT * FROM categories WHERE id = ?', res.lastInsertRowid)!;
}

export async function updateCategory(id: number, input: Partial<{ name: string; icon: string; color: string; sort_order: number }>, userId: number) {
  const cur = await getRow<Category>('SELECT * FROM categories WHERE id = ?', id);
  if (!cur) throw BadRequest('Categoría no encontrada');
  await exec(
    'UPDATE categories SET name = ?, icon = ?, color = ?, sort_order = ? WHERE id = ?',
    input.name?.trim() ?? cur.name,
    input.icon ?? cur.icon,
    input.color ?? cur.color,
    input.sort_order ?? cur.sort_order,
    id,
  );
  await audit(userId, 'update', 'category', id, {});
  return getRow<Category>('SELECT * FROM categories WHERE id = ?', id)!;
}

export async function deleteCategory(id: number, userId: number) {
  await exec('UPDATE products SET category_id = NULL WHERE category_id = ?', id);
  await exec('DELETE FROM categories WHERE id = ?', id);
  await audit(userId, 'delete', 'category', id, {});
  return true;
}

export async function setCategoryActive(id: number, active: number, userId: number) {
  await exec('UPDATE categories SET active = ? WHERE id = ?', active ? 1 : 0, id);
  await audit(userId, 'update', 'category', id, { active });
  return true;
}
