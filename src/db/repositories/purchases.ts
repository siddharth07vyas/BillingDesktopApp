import { getDb } from '../client';
import type { Purchase, PurchaseItem } from '../../types/models';

export interface PurchaseLineInput {
  productId: number;
  nameSnapshot: string;
  qty: number;
  unitCost: number;
}

export interface PurchaseInput {
  supplier: string;
  items: PurchaseLineInput[];
  paidAmount: number;
}

function mapPurchase(row: any): Purchase {
  return {
    id: row.id,
    supplier: row.supplier,
    total: row.total,
    paidAmount: row.paid_amount,
    createdAt: row.created_at,
  };
}
function mapPurchaseItem(row: any): PurchaseItem {
  return {
    id: row.id,
    purchaseId: row.purchase_id,
    productId: row.product_id,
    nameSnapshot: row.name_snapshot,
    qty: row.qty,
    unitCost: row.unit_cost,
  };
}

export async function listPurchases(limit = 30): Promise<Purchase[]> {
  const db = await getDb();
  const rows = await db.getAllAsync(
    'SELECT * FROM purchases ORDER BY created_at DESC, id DESC LIMIT ?',
    [limit]
  );
  return rows.map(mapPurchase);
}

export async function listItemsForPurchase(purchaseId: number): Promise<PurchaseItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync('SELECT * FROM purchase_items WHERE purchase_id = ?', [
    purchaseId,
  ]);
  return rows.map(mapPurchaseItem);
}

/**
 * Records a purchase: adds stock + updates cost price for every line, logs a stock movement per
 * line, and stores how much was paid now (the rest is implicitly due to the supplier).
 */
export async function recordPurchase(input: PurchaseInput): Promise<number> {
  const db = await getDb();
  const total = input.items.reduce((sum, l) => sum + l.qty * l.unitCost, 0);
  await db.execAsync('BEGIN TRANSACTION;');
  try {
    const result = await db.runAsync(
      'INSERT INTO purchases (supplier, total, paid_amount) VALUES (?, ?, ?)',
      [input.supplier, total, input.paidAmount]
    );
    const purchaseId = result.lastInsertRowId;
    for (const line of input.items) {
      await db.runAsync(
        'INSERT INTO purchase_items (purchase_id, product_id, name_snapshot, qty, unit_cost) VALUES (?, ?, ?, ?, ?)',
        [purchaseId, line.productId, line.nameSnapshot, line.qty, line.unitCost]
      );
      await db.runAsync('UPDATE products SET stock_qty = stock_qty + ?, cost_price = ? WHERE id = ?', [
        line.qty,
        line.unitCost,
        line.productId,
      ]);
      await db.runAsync(
        `INSERT INTO stock_movements (product_id, type, qty_change, note, reference_purchase_id)
         VALUES (?, 'purchase', ?, ?, ?)`,
        [line.productId, line.qty, `Purchase · ${input.supplier}`, purchaseId]
      );
    }
    await db.execAsync('COMMIT;');
    return purchaseId;
  } catch (err) {
    await db.execAsync('ROLLBACK;');
    throw err;
  }
}

export async function cashPaidTodayForPurchases(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ total: number | null }>(
    "SELECT SUM(paid_amount) as total FROM purchases WHERE date(created_at) = date('now', 'localtime')"
  );
  return row?.total ?? 0;
}
