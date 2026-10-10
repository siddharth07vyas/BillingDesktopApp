import { getDb } from '../client';

export interface ShopSettings {
  shopName: string;
  address: string;
  phone: string;
  gstin: string;
  footer: string;
  paperWidth: '58mm' | '80mm';
  billCounter: number;
  printerName: string;
  printerAddress: string;
}

export async function getSettings(): Promise<ShopSettings> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    shopName: map.shopName ?? '',
    address: map.address ?? '',
    phone: map.phone ?? '',
    gstin: map.gstin ?? '',
    footer: map.footer ?? '',
    paperWidth: (map.paperWidth as '58mm' | '80mm') ?? '80mm',
    billCounter: Number(map.billCounter ?? 0),
    printerName: map.printerName ?? '',
    printerAddress: map.printerAddress ?? '',
  };
}

export async function setSettings(values: Partial<Record<keyof ShopSettings, string | number>>): Promise<void> {
  const db = await getDb();
  await db.execAsync('BEGIN TRANSACTION;');
  try {
    for (const [key, value] of Object.entries(values)) {
      await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [
        key,
        String(value),
      ]);
    }
    await db.execAsync('COMMIT;');
  } catch (err) {
    await db.execAsync('ROLLBACK;');
    throw err;
  }
}

/** Atomically increments and returns the next bill counter value. */
export async function nextBillNumber(): Promise<string> {
  const db = await getDb();
  await db.execAsync('BEGIN TRANSACTION;');
  try {
    const row = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM settings WHERE key = 'billCounter'"
    );
    const next = Number(row?.value ?? 0) + 1;
    await db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES ('billCounter', ?)", [
      String(next),
    ]);
    await db.execAsync('COMMIT;');
    return `INV-${String(next).padStart(6, '0')}`;
  } catch (err) {
    await db.execAsync('ROLLBACK;');
    throw err;
  }
}

/** Small per-device UI preferences (e.g. Billing grid/list view), stored alongside settings. */
export async function getUiPref(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', ['ui.' + key]);
  return row?.value ?? null;
}

export async function setUiPref(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['ui.' + key, value]);
}
