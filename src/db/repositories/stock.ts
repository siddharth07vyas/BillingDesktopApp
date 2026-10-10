import { getDb } from '../client';
import type { StockMovement } from '../../types/models';

function mapMovement(row: any): StockMovement {
  return {
    id: row.id,
    productId: row.product_id,
    type: row.type,
    qtyChange: row.qty_change,
    note: row.note,
    referenceBillId: row.reference_bill_id,
    referencePurchaseId: row.reference_purchase_id,
    createdAt: row.created_at,
  };
}

export async function listRecentMovements(limit = 30): Promise<StockMovement[]> {
  const db = await getDb();
  const rows = await db.getAllAsync(
    'SELECT * FROM stock_movements ORDER BY created_at DESC, id DESC LIMIT ?',
    [limit]
  );
  return rows.map(mapMovement);
}

/** Manual correction (damage, recount, etc). Positive qtyChange increases stock, negative decreases it. */
export async function adjustStock(productId: number, qtyChange: number, note: string): Promise<void> {
  const db = await getDb();
  await db.execAsync('BEGIN TRANSACTION;');
  try {
    await db.runAsync('UPDATE products SET stock_qty = MAX(0, stock_qty + ?) WHERE id = ?', [
      qtyChange,
      productId,
    ]);
    await db.runAsync(
      'INSERT INTO stock_movements (product_id, type, qty_change, note) VALUES (?, ?, ?, ?)',
      [productId, 'adjustment', qtyChange, note]
    );
    await db.execAsync('COMMIT;');
  } catch (err) {
    await db.execAsync('ROLLBACK;');
    throw err;
  }
}
