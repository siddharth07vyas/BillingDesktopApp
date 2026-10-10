import * as SQLite from 'expo-sqlite';
import { runMigrations } from './migrator';

const DB_NAME = 'counterbook.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync('PRAGMA foreign_keys = ON;');
      await runMigrations(db);
      return db;
    })();
  }
  return dbPromise;
}

export function dbFilePath(): string {
  return `${SQLite.defaultDatabaseDirectory}/${DB_NAME}`;
}

/** Closes the current connection and clears the cached promise so the next getDb() re-opens the
 * file from disk — used after a backup restore replaces the underlying .db file. */
export async function closeDbForRestore(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    await db.closeAsync();
    dbPromise = null;
  }
}
