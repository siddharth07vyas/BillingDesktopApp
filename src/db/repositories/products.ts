import { getDb } from '../client';
import type { Product } from '../../types/models';

function mapProduct(row: any): Product {
  return {
    id: row.id,
    name: row.name,
    nameHi: row.name_hi ?? null,
    categoryId: row.category_id,
    subcategoryId: row.subcategory_id,
    unit: row.unit,
    price: row.price,
    costPrice: row.cost_price,
    stockQty: row.stock_qty,
    lowStockThreshold: row.low_stock_threshold,
    sku: row.sku,
    isActive: !!row.is_active,
  };
}

export async function listProducts(): Promise<Product[]> {
  const db = await getDb();
  const rows = await db.getAllAsync('SELECT * FROM products WHERE is_active = 1 ORDER BY name ASC');
  return rows.map(mapProduct);
}

export async function getProduct(id: number): Promise<Product | null> {
  const db = await getDb();
  const row = await db.getFirstAsync('SELECT * FROM products WHERE id = ?', [id]);
  return row ? mapProduct(row) : null;
}

export interface ProductInput {
  name: string;
  nameHi: string | null;
  categoryId: number;
  subcategoryId: number | null;
  unit: string;
  price: number;
  costPrice: number;
  stockQty: number;
  lowStockThreshold: number;
  sku: string | null;
}

export async function addProduct(input: ProductInput): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO products
      (name, name_hi, category_id, subcategory_id, unit, price, cost_price, stock_qty, low_stock_threshold, sku)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.name,
      input.nameHi,
      input.categoryId,
      input.subcategoryId,
      input.unit,
      input.price,
      input.costPrice,
      input.stockQty,
      input.lowStockThreshold,
      input.sku,
    ]
  );
  return result.lastInsertRowId;
}

export async function updateProduct(id: number, input: ProductInput): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE products SET
      name = ?, name_hi = ?, category_id = ?, subcategory_id = ?, unit = ?, price = ?,
      cost_price = ?, stock_qty = ?, low_stock_threshold = ?, sku = ?
     WHERE id = ?`,
    [
      input.name,
      input.nameHi,
      input.categoryId,
      input.subcategoryId,
      input.unit,
      input.price,
      input.costPrice,
      input.stockQty,
      input.lowStockThreshold,
      input.sku,
      id,
    ]
  );
}

export async function deleteProduct(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE products SET is_active = 0 WHERE id = ?', [id]);
}
