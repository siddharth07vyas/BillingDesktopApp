import { getDb } from '../client';
import type { Party, PartyLedgerEntry } from '../../types/models';

function mapParty(row: any): Party {
  return { id: row.id, name: row.name, nameHi: row.name_hi ?? null, phone: row.phone, address: row.address, balance: row.balance };
}
function mapLedgerEntry(row: any): PartyLedgerEntry {
  return {
    id: row.id,
    partyId: row.party_id,
    type: row.type,
    amount: row.amount,
    balanceAfter: row.balance_after,
    note: row.note,
    billId: row.bill_id,
    createdAt: row.created_at,
  };
}

export async function listParties(): Promise<Party[]> {
  const db = await getDb();
  const rows = await db.getAllAsync('SELECT * FROM parties ORDER BY name ASC');
  return rows.map(mapParty);
}

export async function addParty(input: {
  name: string;
  nameHi: string | null;
  phone: string | null;
  address: string | null;
  openingBalance: number;
}): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    'INSERT INTO parties (name, name_hi, phone, address, balance) VALUES (?, ?, ?, ?, ?)',
    [input.name, input.nameHi, input.phone, input.address, input.openingBalance]
  );
  return result.lastInsertRowId;
}

export async function listLedgerForParty(partyId: number): Promise<PartyLedgerEntry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync(
    'SELECT * FROM party_ledger WHERE party_id = ? ORDER BY created_at DESC, id DESC',
    [partyId]
  );
  return rows.map(mapLedgerEntry);
}

/** Adds a manual udhar entry (credit given outside a bill) or records a payment. Positive amount = udhar given, negative = payment received. */
export async function addLedgerEntry(
  partyId: number,
  type: 'manual' | 'payment',
  amount: number,
  note: string | null
): Promise<void> {
  const db = await getDb();
  await db.execAsync('BEGIN TRANSACTION;');
  try {
    const party = await db.getFirstAsync<{ balance: number }>(
      'SELECT balance FROM parties WHERE id = ?',
      [partyId]
    );
    if (!party) throw new Error('Party not found');
    const balanceAfter = party.balance + amount;
    await db.runAsync('UPDATE parties SET balance = ? WHERE id = ?', [balanceAfter, partyId]);
    await db.runAsync(
      'INSERT INTO party_ledger (party_id, type, amount, balance_after, note) VALUES (?, ?, ?, ?, ?)',
      [partyId, type, amount, balanceAfter, note]
    );
    await db.execAsync('COMMIT;');
  } catch (err) {
    await db.execAsync('ROLLBACK;');
    throw err;
  }
}
