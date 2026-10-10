import { getDb } from '../client';

export type NamedTable = 'products' | 'categories' | 'subcategories' | 'parties';
const TABLES: NamedTable[] = ['products', 'categories', 'subcategories', 'parties'];

export interface NameRow {
  table: NamedTable;
  id: number;
  name: string;
}

/** Rows whose Hindi name hasn't been filled in yet (or every row, when `includeExisting`). */
export async function listNamesForTranslation(includeExisting = false): Promise<NameRow[]> {
  const db = await getDb();
  const out: NameRow[] = [];
  for (const table of TABLES) {
    const where = [table === 'products' ? 'is_active = 1' : null, includeExisting ? null : "(name_hi IS NULL OR name_hi = '')"]
      .filter(Boolean)
      .join(' AND ');
    const rows = await db.getAllAsync<{ id: number; name: string }>(
      `SELECT id, name FROM ${table}${where ? ' WHERE ' + where : ''}`
    );
    for (const r of rows) out.push({ table, id: r.id, name: r.name });
  }
  return out;
}

export async function saveHindiNames(rows: { table: NamedTable; id: number; nameHi: string }[]): Promise<void> {
  if (!rows.length) return;
  const db = await getDb();
  await db.execAsync('BEGIN TRANSACTION;');
  try {
    for (const r of rows) {
      await db.runAsync(`UPDATE ${r.table} SET name_hi = ? WHERE id = ?`, [r.nameHi, r.id]);
    }
    await db.execAsync('COMMIT;');
  } catch (err) {
    await db.execAsync('ROLLBACK;');
    throw err;
  }
}
