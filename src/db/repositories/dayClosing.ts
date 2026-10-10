import { getDb } from '../client';
import type { DayClosing } from '../../types/models';

function mapDayClosing(row: any): DayClosing {
  return {
    id: row.id,
    date: row.date,
    openingCash: row.opening_cash,
    countedCash: row.counted_cash,
    expectedCash: row.expected_cash,
    difference: row.difference,
    note: row.note,
    createdAt: row.created_at,
  };
}

export async function recordDayClosing(input: {
  date: string;
  openingCash: number;
  expectedCash: number;
  countedCash: number;
  note: string | null;
}): Promise<void> {
  const db = await getDb();
  const difference = input.countedCash - input.expectedCash;
  await db.runAsync(
    `INSERT INTO day_closings (date, opening_cash, counted_cash, expected_cash, difference, note)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [input.date, input.openingCash, input.countedCash, input.expectedCash, difference, input.note]
  );
}

export async function listDayClosings(limit = 30): Promise<DayClosing[]> {
  const db = await getDb();
  const rows = await db.getAllAsync(
    'SELECT * FROM day_closings ORDER BY created_at DESC, id DESC LIMIT ?',
    [limit]
  );
  return rows.map(mapDayClosing);
}
