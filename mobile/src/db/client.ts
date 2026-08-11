import * as SQLite from 'expo-sqlite';
import { MIGRATIONS } from './schema';

let dbInstance: SQLite.SQLiteDatabase | null = null;
let dbOpenPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  if (!dbOpenPromise) {
    dbOpenPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('peptide_tracker.db');
      await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
      await migrate(db);
      dbInstance = db;
      return db;
    })().catch((err) => {
      dbOpenPromise = null;
      throw err;
    });
  }
  return dbOpenPromise;
}

export async function initDb(): Promise<void> {
  await getDb();
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`CREATE TABLE IF NOT EXISTS _meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM _meta WHERE key = 'schema_version'`,
  );
  const current = row ? Number(row.value) : 0;
  for (const m of MIGRATIONS) {
    if (m.version > current) {
      // The SQL and the version that records it go in together or not at all.
      // SQLite rolls DDL back inside a transaction, so an app killed mid-upgrade
      // reopens on the old schema and runs the same migration again. Without
      // this, the `ALTER` lands, the version does not, and every later launch
      // replays the migration onto columns that already exist and fails there
      // forever.
      await db.withTransactionAsync(async () => {
        await db.execAsync(m.up);
        await db.runAsync(
          `INSERT OR REPLACE INTO _meta (key, value) VALUES ('schema_version', ?)`,
          [String(m.version)],
        );
      });
    }
  }
}
