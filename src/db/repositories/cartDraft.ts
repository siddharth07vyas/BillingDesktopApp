import { getDb } from '../client';
import type { PaymentMode } from '../../types/models';

/** The in-progress bill on the Billing screen, kept so it survives app reloads and restarts. */
export interface CartDraft {
  cart: { productId: number; qty: number }[];
  discount: string;
  paymentMode: PaymentMode;
  selectedPartyId: number | null;
  splitCash: string;
}

const KEY = 'cartDraft';

export async function loadCartDraft(): Promise<CartDraft | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [KEY]);
  if (!row) return null;
  try {
    return JSON.parse(row.value) as CartDraft;
  } catch {
    return null;
  }
}

export async function saveCartDraft(draft: CartDraft): Promise<void> {
  const db = await getDb();
  await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [KEY, JSON.stringify(draft)]);
}

export async function clearCartDraft(): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM settings WHERE key = ?', [KEY]);
}
