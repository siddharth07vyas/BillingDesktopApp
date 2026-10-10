import { getDb } from '../client';
import { nextBillNumber } from './settings';
import type { Bill, BillItem, PaymentMode } from '../../types/models';

export interface ChargeLine {
  productId: number;
  nameSnapshot: string;
  qty: number;
  unitPrice: number;
}

export interface ChargeInput {
  partyId: number | null;
  items: ChargeLine[];
  discount: number;
  paymentMode: PaymentMode;
  paidAmount: number;
}

export interface ChargeResult {
  billId: number;
  number: string;
  total: number;
}

function mapBill(row: any): Bill {
  return {
    id: row.id,
    number: row.number,
    partyId: row.party_id,
    subtotal: row.subtotal,
    discount: row.discount,
    tax: row.tax,
    total: row.total,
    paidAmount: row.paid_amount,
    paymentMode: row.payment_mode,
    createdAt: row.created_at,
    cancelledAt: row.cancelled_at ?? null,
    cancelReason: row.cancel_reason ?? null,
  };
}
function mapBillItem(row: any): BillItem {
  return {
    id: row.id,
    billId: row.bill_id,
    productId: row.product_id,
    nameSnapshot: row.name_snapshot,
    qty: row.qty,
    unitPrice: row.unit_price,
    lineTotal: row.line_total,
  };
}

/**
 * Charges a bill in one transaction: inserts the bill + line items, decrements stock and logs a
 * stock movement per line, and — if anything is left unpaid against a party — adds a udhar entry
 * to that party's ledger and raises their running balance.
 */
export async function chargeBill(input: ChargeInput): Promise<ChargeResult> {
  const db = await getDb();
  const subtotal = input.items.reduce((sum, l) => sum + l.qty * l.unitPrice, 0);
  const total = Math.max(0, subtotal - input.discount);
  const number = await nextBillNumber();

  await db.execAsync('BEGIN TRANSACTION;');
  try {
    const billResult = await db.runAsync(
      `INSERT INTO bills (number, party_id, subtotal, discount, tax, total, paid_amount, payment_mode)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [number, input.partyId, subtotal, input.discount, 0, total, input.paidAmount, input.paymentMode]
    );
    const billId = billResult.lastInsertRowId;

    for (const line of input.items) {
      const lineTotal = line.qty * line.unitPrice;
      await db.runAsync(
        `INSERT INTO bill_items (bill_id, product_id, name_snapshot, qty, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [billId, line.productId, line.nameSnapshot, line.qty, line.unitPrice, lineTotal]
      );
      await db.runAsync('UPDATE products SET stock_qty = MAX(0, stock_qty - ?) WHERE id = ?', [
        line.qty,
        line.productId,
      ]);
      await db.runAsync(
        `INSERT INTO stock_movements (product_id, type, qty_change, note, reference_bill_id)
         VALUES (?, 'sale', ?, ?, ?)`,
        [line.productId, -line.qty, number, billId]
      );
    }

    const udharAmount = total - input.paidAmount;
    if (udharAmount > 0 && input.partyId) {
      const party = await db.getFirstAsync<{ balance: number }>(
        'SELECT balance FROM parties WHERE id = ?',
        [input.partyId]
      );
      const balanceAfter = (party?.balance ?? 0) + udharAmount;
      await db.runAsync('UPDATE parties SET balance = ? WHERE id = ?', [balanceAfter, input.partyId]);
      await db.runAsync(
        `INSERT INTO party_ledger (party_id, type, amount, balance_after, note, bill_id)
         VALUES (?, 'sale', ?, ?, ?, ?)`,
        [input.partyId, udharAmount, balanceAfter, number, billId]
      );
    }

    await db.execAsync('COMMIT;');
    return { billId, number, total };
  } catch (err) {
    await db.execAsync('ROLLBACK;');
    throw err;
  }
}

/**
 * Cancels a saved bill in one transaction: marks it cancelled (it stays on record but drops out of
 * sales totals), returns every line to stock, and reverses any udhar the bill added to the party.
 */
export async function cancelBill(billId: number, reason: string | null): Promise<void> {
  const db = await getDb();
  await db.execAsync('BEGIN TRANSACTION;');
  try {
    const bill = await db.getFirstAsync<any>('SELECT * FROM bills WHERE id = ?', [billId]);
    if (!bill) throw new Error('Bill not found');
    if (bill.cancelled_at) throw new Error('This bill is already cancelled');

    await db.runAsync("UPDATE bills SET cancelled_at = datetime('now'), cancel_reason = ? WHERE id = ?", [reason, billId]);

    const items = await db.getAllAsync<{ product_id: number; qty: number }>(
      'SELECT product_id, qty FROM bill_items WHERE bill_id = ?',
      [billId]
    );
    for (const item of items) {
      await db.runAsync('UPDATE products SET stock_qty = stock_qty + ? WHERE id = ?', [item.qty, item.product_id]);
      await db.runAsync(
        `INSERT INTO stock_movements (product_id, type, qty_change, note, reference_bill_id)
         VALUES (?, 'return', ?, ?, ?)`,
        [item.product_id, item.qty, `${bill.number} cancelled`, billId]
      );
    }

    const udharAmount = bill.total - bill.paid_amount;
    if (udharAmount > 0 && bill.party_id) {
      const party = await db.getFirstAsync<{ balance: number }>('SELECT balance FROM parties WHERE id = ?', [bill.party_id]);
      const balanceAfter = (party?.balance ?? 0) - udharAmount;
      await db.runAsync('UPDATE parties SET balance = ? WHERE id = ?', [balanceAfter, bill.party_id]);
      await db.runAsync(
        `INSERT INTO party_ledger (party_id, type, amount, balance_after, note, bill_id)
         VALUES (?, 'manual', ?, ?, ?, ?)`,
        [bill.party_id, -udharAmount, balanceAfter, `Bill ${bill.number} cancelled`, billId]
      );
    }

    await db.execAsync('COMMIT;');
  } catch (err) {
    await db.execAsync('ROLLBACK;');
    throw err;
  }
}

export async function listRecentBills(limit = 20): Promise<Bill[]> {
  const db = await getDb();
  const rows = await db.getAllAsync(
    'SELECT * FROM bills ORDER BY created_at DESC, id DESC LIMIT ?',
    [limit]
  );
  return rows.map(mapBill);
}

export async function getBillItems(billId: number): Promise<BillItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync('SELECT * FROM bill_items WHERE bill_id = ?', [billId]);
  return rows.map(mapBillItem);
}

export async function todaysSalesSummary(): Promise<{
  totalSales: number;
  cashCollected: number;
  udharGiven: number;
  billCount: number;
}> {
  const db = await getDb();
  const row = await db.getFirstAsync<{
    totalSales: number | null;
    cashCollected: number | null;
    udharGiven: number | null;
    billCount: number | null;
  }>(
    `SELECT
      SUM(total) as totalSales,
      SUM(paid_amount) as cashCollected,
      SUM(total - paid_amount) as udharGiven,
      COUNT(*) as billCount
     FROM bills
     WHERE cancelled_at IS NULL AND date(created_at, 'localtime') = date('now', 'localtime')`
  );
  return {
    totalSales: row?.totalSales ?? 0,
    cashCollected: row?.cashCollected ?? 0,
    udharGiven: row?.udharGiven ?? 0,
    billCount: row?.billCount ?? 0,
  };
}
