import { type SQLiteDatabase } from 'expo-sqlite';
import { sql as initSql } from './migrations/0001_init';
import { sql as billCancellationSql } from './migrations/0002_bill_cancellation';
import { sql as hindiNamesSql } from './migrations/0003_hindi_names';

type Migration = { version: number; sql: string };

const migrations: Migration[] = [
  { version: 1, sql: initSql },
  { version: 2, sql: billCancellationSql },
  { version: 3, sql: hindiNamesSql },
];

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  const { user_version: currentVersion } = (await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version'
  ))!;

  const pending = migrations
    .filter((m) => m.version > currentVersion)
    .sort((a, b) => a.version - b.version);

  for (const migration of pending) {
    await db.execAsync('BEGIN TRANSACTION;');
    try {
      await db.execAsync(migration.sql);
      await db.execAsync(`PRAGMA user_version = ${migration.version};`);
      await db.execAsync('COMMIT;');
    } catch (err) {
      await db.execAsync('ROLLBACK;');
      throw err;
    }
  }
}
