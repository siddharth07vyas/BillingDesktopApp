import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { closeDbForRestore, dbFilePath } from './client';

function dbFileUri(): string {
  return `file://${dbFilePath()}`;
}

export async function exportDatabaseBackup(): Promise<void> {
  const source = new File(dbFileUri());
  const dest = new File(Paths.cache, `counterbook-backup-${Date.now()}.db`);
  await source.copy(dest);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(dest.uri, {
      mimeType: 'application/octet-stream',
      dialogTitle: 'Save CounterBook backup',
    });
  }
}

/** Replaces the live database file with a previously exported backup. Closes the current
 * connection first so the copy isn't racing an open file handle; the next getDb() call re-opens
 * the restored file. */
export async function importDatabaseBackup(pickedUri: string): Promise<void> {
  await closeDbForRestore();
  const source = new File(pickedUri);
  const dest = new File(dbFileUri());
  await source.copy(dest, { overwrite: true });
}
