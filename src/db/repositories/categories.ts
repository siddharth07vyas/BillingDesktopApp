import { getDb } from '../client';
import type { Category, Subcategory } from '../../types/models';

function mapCategory(row: any): Category {
  return { id: row.id, name: row.name, nameHi: row.name_hi ?? null, sortOrder: row.sort_order };
}
function mapSubcategory(row: any): Subcategory {
  return { id: row.id, categoryId: row.category_id, name: row.name, nameHi: row.name_hi ?? null };
}

export async function listCategories(): Promise<Category[]> {
  const db = await getDb();
  const rows = await db.getAllAsync('SELECT * FROM categories ORDER BY sort_order ASC, id ASC');
  return rows.map(mapCategory);
}

export async function addCategory(name: string, nameHi: string | null = null): Promise<number> {
  const db = await getDb();
  const maxRow = await db.getFirstAsync<{ maxOrder: number | null }>(
    'SELECT MAX(sort_order) as maxOrder FROM categories'
  );
  const sortOrder = (maxRow?.maxOrder ?? -1) + 1;
  const result = await db.runAsync('INSERT INTO categories (name, name_hi, sort_order) VALUES (?, ?, ?)', [
    name,
    nameHi,
    sortOrder,
  ]);
  return result.lastInsertRowId;
}

export async function renameCategory(id: number, name: string, nameHi: string | null = null): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE categories SET name = ?, name_hi = ? WHERE id = ?', [name, nameHi, id]);
}

export async function deleteCategory(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM categories WHERE id = ?', [id]);
}

export async function moveCategory(id: number, direction: -1 | 1): Promise<void> {
  const db = await getDb();
  const categories = await listCategories();
  const index = categories.findIndex((c) => c.id === id);
  const swapWith = categories[index + direction];
  if (!swapWith) return;
  const current = categories[index];
  await db.execAsync('BEGIN TRANSACTION;');
  try {
    await db.runAsync('UPDATE categories SET sort_order = ? WHERE id = ?', [
      swapWith.sortOrder,
      current.id,
    ]);
    await db.runAsync('UPDATE categories SET sort_order = ? WHERE id = ?', [
      current.sortOrder,
      swapWith.id,
    ]);
    await db.execAsync('COMMIT;');
  } catch (err) {
    await db.execAsync('ROLLBACK;');
    throw err;
  }
}

export async function listSubcategories(categoryId?: number): Promise<Subcategory[]> {
  const db = await getDb();
  const rows = categoryId
    ? await db.getAllAsync('SELECT * FROM subcategories WHERE category_id = ? ORDER BY name ASC', [
        categoryId,
      ])
    : await db.getAllAsync('SELECT * FROM subcategories ORDER BY name ASC');
  return rows.map(mapSubcategory);
}

export async function addSubcategory(categoryId: number, name: string, nameHi: string | null = null): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    'INSERT INTO subcategories (category_id, name, name_hi) VALUES (?, ?, ?)',
    [categoryId, name, nameHi]
  );
  return result.lastInsertRowId;
}

export async function renameSubcategory(id: number, name: string, nameHi: string | null = null): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE subcategories SET name = ?, name_hi = ? WHERE id = ?', [name, nameHi, id]);
}

export async function deleteSubcategory(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM subcategories WHERE id = ?', [id]);
}
