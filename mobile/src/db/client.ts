import * as SQLite from 'expo-sqlite';
import { runMigrations, type MigrationDriver } from './migrate';

const DATABASE_NAME = 'peptide_tracker.db';

let dbInstance: SQLite.SQLiteDatabase | null = null;
let dbOpenPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  if (!dbOpenPromise) {
    dbOpenPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
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

/**
 * The same database file, opened without a migration, for the rescue export on
 * the launch error screen.
 *
 * A device that cannot finish an upgrade still holds every row it ever wrote,
 * and this is the only door to them. It is a separate connection, so it neither
 * waits for nor disturbs the one `getDb` failed on, and `query_only` makes
 * SQLite refuse every write on it. A rescue must not be able to change a
 * database Poke has already failed to upgrade.
 *
 * The caller closes it.
 */
export async function openUnmigratedDb(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME, { useNewConnection: true });
  await db.execAsync('PRAGMA query_only = ON;');
  return db;
}

/** The expo-sqlite side of the runner in `migrate.ts`. */
function driverFor(db: SQLite.SQLiteDatabase): MigrationDriver {
  return {
    execute: (sql) => db.execAsync(sql),
    run: async (sql, params) => {
      await db.runAsync(sql, params);
    },
    first: <T,>(sql: string) => db.getFirstAsync<T>(sql),
    transaction: (body) => db.withTransactionAsync(body),
  };
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  await runMigrations(driverFor(db));
}
