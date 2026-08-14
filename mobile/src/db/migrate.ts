/**
 * The migration runner, with no expo-sqlite inside it.
 *
 * The database arrives as a `MigrationDriver`, so the same runner drives the
 * app's expo-sqlite connection and a plain `node:sqlite` database in
 * `migrations.test.ts`. There is one copy of the SQL and one copy of the
 * ordering rules, and the test exercises both of them rather than a lookalike.
 */
import { MIGRATIONS, type Migration } from './schema';

/**
 * The four things the runner needs from a database. Every implementation runs
 * one statement at a time, because the runner splits a migration itself.
 */
export interface MigrationDriver {
  /** Runs one statement that takes no parameters. */
  execute(sql: string): Promise<void>;
  /** Runs one statement with positional parameters. */
  run(sql: string, params: (string | number | null)[]): Promise<void>;
  /** The first row of a query, or null when the query returns nothing. */
  first<T>(sql: string): Promise<T | null>;
  /** Runs `body` inside a transaction that rolls back whole when `body` throws. */
  transaction(body: () => Promise<void>): Promise<void>;
}

const META_TABLE = `CREATE TABLE IF NOT EXISTS _meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);`;
const READ_VERSION = `SELECT value FROM _meta WHERE key = 'schema_version'`;
const WRITE_VERSION = `INSERT OR REPLACE INTO _meta (key, value) VALUES ('schema_version', ?)`;

/**
 * The last migration that ever ran outside a transaction.
 *
 * `withTransactionAsync` landed on 11 August 2026, in commit 9473752. Builds
 * 1.0.1 through 1.2.2 shipped migrations 1 to 8 and applied each one as bare
 * SQL, with the `_meta` version write as a separate statement after it. A
 * device killed between the two keeps the column and loses the version, so the
 * next launch replays the whole migration. `ALTER TABLE ... ADD COLUMN` has no
 * `IF NOT EXISTS` in SQLite, so the replay dies on `duplicate column name`, and
 * it dies the same way on every launch after that. The user never gets in, and
 * the data sits on the disk unreachable.
 *
 * Do not delete this. A phone that has been in a drawer since 1.2.2 still
 * carries that half-applied state, and the skip below is the only thing that
 * repairs it. Migration 9 and every migration above it has always run inside a
 * transaction, so a duplicate column up there is a bug in the migration itself
 * and stays loud.
 */
export const LAST_UNTRANSACTED_VERSION = 8;

const TRIGGER = /\bCREATE\s+(OR\s+REPLACE\s+)?(TEMP\s+|TEMPORARY\s+)?TRIGGER\b/i;

/**
 * Cuts a migration into the statements that a semicolon separates.
 *
 * A semicolon inside a string literal, inside a quoted identifier or inside a
 * comment is not a separator, so the scan tracks all three. The one construct
 * it cannot read is a compound `BEGIN ... END` body, which only `CREATE
 * TRIGGER` brings, so a trigger is refused by name instead of being cut in
 * half. No migration holds one today, and `migrations.test.ts` splits the whole
 * real array on every run, so the day somebody adds one the test says so.
 */
export function splitStatements(sql: string): string[] {
  if (TRIGGER.test(sql)) {
    throw new Error(
      'splitStatements cannot cut a CREATE TRIGGER, whose BEGIN ... END body holds its own semicolons. Teach the scanner about compound statements before a migration adds one.',
    );
  }

  const statements: string[] = [];
  let start = 0;
  let index = 0;
  // Whether anything other than whitespace and comments has been seen since the
  // last semicolon. It keeps a trailing comment from being run as a statement.
  let meaningful = false;

  while (index < sql.length) {
    const char = sql[index];

    if (char === '-' && sql[index + 1] === '-') {
      const newline = sql.indexOf('\n', index + 2);
      index = newline === -1 ? sql.length : newline + 1;
      continue;
    }
    if (char === '/' && sql[index + 1] === '*') {
      const close = sql.indexOf('*/', index + 2);
      index = close === -1 ? sql.length : close + 2;
      continue;
    }
    if (char === ';') {
      if (meaningful) statements.push(sql.slice(start, index).trim());
      meaningful = false;
      start = index + 1;
      index += 1;
      continue;
    }

    if (!/\s/.test(char)) meaningful = true;

    if (char === `'` || char === '"' || char === '`') {
      index = afterClosing(sql, index + 1, char);
      continue;
    }
    if (char === '[') {
      index = afterClosing(sql, index + 1, ']');
      continue;
    }
    index += 1;
  }

  // SQL after the last semicolon, for a migration that does not end in one.
  if (meaningful) statements.push(sql.slice(start).trim());
  return statements;
}

/** The index after the next `closer`, or the end of the string when it never closes. */
function afterClosing(sql: string, from: number, closer: string): number {
  const close = sql.indexOf(closer, from);
  return close === -1 ? sql.length : close + 1;
}

/**
 * SQLite's own words for the one failure a replay is allowed to skip. The text
 * is `duplicate column name: <column>`, and it has read that way since 3.x.
 */
export function isDuplicateColumnError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes('duplicate column name');
}

/** `ALTER TABLE x ADD COLUMN y ...`, the only statement shape a replay may skip. */
export function isAddColumnStatement(sql: string): boolean {
  const body = sql.replace(/^(\s|--[^\n]*\n?|\/\*[\s\S]*?\*\/)+/, '');
  return /^ALTER\s+TABLE\s+\S+\s+ADD\s+(COLUMN\s+)?\S/i.test(body);
}

/**
 * True only for a column that migration 1 to 8 already added on a device the
 * old runner left half-upgraded. Three things must hold at once, and each one
 * rules out a different kind of real failure:
 *
 * 1. The migration is one of the eight that ever ran without a transaction. A
 *    duplicate column in a newer migration is an authoring mistake.
 * 2. The statement is an `ALTER TABLE ... ADD COLUMN`. `CREATE TABLE` raises
 *    the same message for two columns of one name, and that is a mistake too.
 * 3. SQLite said `duplicate column name`. Every other error, from a missing
 *    table to a failed constraint to a full disk, still throws and still rolls
 *    the transaction back.
 */
function isRepairableReplay(version: number, statement: string, error: unknown): boolean {
  return version <= LAST_UNTRANSACTED_VERSION
    && isAddColumnStatement(statement)
    && isDuplicateColumnError(error);
}

/**
 * Brings the database up to the newest migration and answers the version it
 * lands on.
 *
 * Each migration goes in with the `_meta` version write, inside one
 * transaction: SQLite rolls DDL back, so an app killed mid-upgrade reopens on
 * the old schema and runs the same migration again from the start. The skip
 * above is what lets that second run get past the columns the old runner
 * already wrote.
 *
 * Statements run one at a time so the skip is per statement. A migration that
 * added column A and died before column B skips A on the replay and still adds
 * B. `CREATE TABLE` and `CREATE INDEX` need no such help, because every one of
 * them in `MIGRATIONS` is written `IF NOT EXISTS`, and the `UPDATE` statements
 * are all written to reach the same rows twice without doubling anything.
 */
export async function runMigrations(
  driver: MigrationDriver,
  migrations: readonly Migration[] = MIGRATIONS,
): Promise<number> {
  await driver.execute(META_TABLE);
  const row = await driver.first<{ value: string }>(READ_VERSION);
  let current = row ? Number(row.value) : 0;

  for (const migration of migrations) {
    if (migration.version <= current) continue;
    await driver.transaction(async () => {
      for (const statement of splitStatements(migration.up)) {
        try {
          await driver.execute(statement);
        } catch (error: unknown) {
          if (!isRepairableReplay(migration.version, statement, error)) throw error;
        }
      }
      await driver.run(WRITE_VERSION, [String(migration.version)]);
    });
    current = migration.version;
  }

  return current;
}
