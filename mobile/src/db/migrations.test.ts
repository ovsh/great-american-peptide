/**
 * The migration chain, run for real.
 *
 * expo-sqlite cannot load outside an app, so the driver here is `node:sqlite`.
 * Nothing else is a stand-in: the array is the shipped `MIGRATIONS`, the runner
 * is the shipped `runMigrations`, and the SQL is plain SQLite that does not
 * care which library executes it.
 *
 *     npx tsx src/db/migrations.test.ts
 */
import { DatabaseSync } from 'node:sqlite';

import {
  LAST_UNTRANSACTED_VERSION,
  isAddColumnStatement,
  isDuplicateColumnError,
  runMigrations,
  splitStatements,
  type MigrationDriver,
} from './migrate.ts';
import { MIGRATIONS, SCHEMA_VERSION } from './schema.ts';

/**
 * Every table the app opens, and every column it reads off one. Typed out by
 * hand on purpose: a migration that forgets a column, and a migration that adds
 * one nobody declared, both have to fail here.
 */
const EXPECTED: Record<string, string[]> = {
  _meta: ['key', 'value'],
  medications: [
    'id', 'name', 'preset_id', 'default_dose', 'default_unit', 'default_route',
    'frequency_kind', 'frequency_value', 'half_life_hours', 'tmax_hours', 'color_index',
    'status', 'sort_order', 'cycle_days_on', 'cycle_days_off', 'cycle_started_at',
    'paused_at', 'composition', 'dose_by_day', 'vial_mg', 'vial_form', 'diluent_ml',
    'created_at', 'updated_at',
  ],
  injections: [
    'id', 'medication_id', 'dose', 'unit', 'route', 'site_id', 'taken_at',
    'scheduled_at', 'notes', 'deleted_at', 'created_at',
  ],
  measurements: [
    'id', 'kind', 'value', 'unit', 'taken_at', 'source', 'source_id', 'notes',
    'deleted_at', 'created_at',
  ],
  side_effect_logs: ['id', 'effect', 'severity', 'taken_at', 'notes', 'deleted_at', 'created_at'],
  preferences: [
    'id', 'weight_unit', 'height_unit', 'reminder_time', 'notifications_enabled',
    'disclaimer_accepted_at', 'onboarding_completed_at', 'start_weight', 'start_weight_at',
    'height', 'updated_at', 'goal_weight', 'review_event_count', 'review_first_event_at',
    'review_last_prompted_at', 'review_prompted_version', 'goal_kind', 'display_name',
    'side_effect_concerns', 'review_prompt_log', 'review_triggers_used', 'journey_stage',
    'sex', 'birth_year', 'activity_level', 'motivation', 'weekly_pace', 'last_shot_at',
    'tester_pro_at', 'focused_medication_id', 'notif_checkin_enabled',
    'notif_checkin_delay_hours', 'notif_missed_enabled', 'health_sync_enabled',
    'health_synced_at', 'notif_cycle_enabled', 'tester_id', 'experience_level',
    'goal_tags',
  ],
};

async function main(): Promise<void> {
  await test('the versions are one strictly increasing run, sorted, with no gaps', () => {
    const versions = MIGRATIONS.map((migration) => migration.version);
    assert(versions[0] === 1, `the chain starts at 1, received ${versions[0]}`);
    versions.forEach((version, index) => {
      assert(version === index + 1, `version ${version} sits at index ${index}, so a number is out of place, duplicated or missing`);
    });
  });

  await test('SCHEMA_VERSION is the newest migration and nothing else', () => {
    const newest = Math.max(...MIGRATIONS.map((migration) => migration.version));
    assert(SCHEMA_VERSION === newest, `SCHEMA_VERSION is ${SCHEMA_VERSION}, the newest migration is ${newest}`);
    assert(SCHEMA_VERSION === MIGRATIONS[MIGRATIONS.length - 1].version, 'the last entry holds the newest version');
  });

  await test('every shipped migration cuts into statements the runner can execute', () => {
    for (const migration of MIGRATIONS) {
      const statements = splitStatements(migration.up);
      assert(statements.length > 0, `migration ${migration.version} produced no statement`);
      for (const statement of statements) {
        assert(statement.length > 0, `migration ${migration.version} produced an empty statement`);
      }
    }
  });

  await test('a fresh database holds every table and column the app reads', async () => {
    const db = await migrated();
    assert(readVersion(db) === SCHEMA_VERSION, `a fresh install lands on ${SCHEMA_VERSION}, received ${readVersion(db)}`);
    for (const [table, expected] of Object.entries(EXPECTED)) {
      const found = columnNames(db, table);
      assert(found.length > 0, `table ${table} is missing`);
      assert(
        [...found].sort().join(',') === [...expected].sort().join(','),
        `table ${table} holds [${found.join(', ')}], expected [${expected.join(', ')}]`,
      );
    }
  });

  await test('a device on any shipped version upgrades to exactly the fresh schema', async () => {
    const fresh = schemaShape(await migrated());
    for (let stop = 1; stop < SCHEMA_VERSION; stop += 1) {
      const db = await migrated(stop);
      assert(readVersion(db) === stop, `the staged database sits at ${stop}`);
      // The upgrade a real user performs: the rest of the chain, in one launch.
      await runMigrations(driverFor(db));
      assert(readVersion(db) === SCHEMA_VERSION, `version ${stop} upgraded to ${readVersion(db)}`);
      assert(schemaShape(db) === fresh, `an upgrade from version ${stop} did not reach the fresh schema`);
    }
  });

  await test('a second launch changes nothing', async () => {
    const db = await migrated();
    const before = schemaShape(db);
    await runMigrations(driverFor(db));
    assert(schemaShape(db) === before, 'the runner is not idempotent');
    assert(readVersion(db) === SCHEMA_VERSION, 'the version did not move');
  });

  await test('the rows written before an upgrade survive it', async () => {
    const db = await migrated(1);
    db.exec(`INSERT INTO medications
      (id, name, default_dose, default_unit, default_route, frequency_kind, color_index, created_at, updated_at)
      VALUES ('m1', 'Semaglutide', 0.25, 'mg', 'sc', 'weekly', 0, 1000, 1000),
             ('m2', 'BPC-157', 250, 'mcg', 'sc', 'daily', 1, 2000, 2000);`);
    db.exec(`INSERT INTO injections (id, medication_id, dose, unit, route, taken_at, created_at)
      VALUES ('i1', 'm1', 0.25, 'mg', 'sc', 1500, 1500);`);

    await runMigrations(driverFor(db));

    const medications = db.prepare(`SELECT id, name, sort_order FROM medications ORDER BY sort_order`).all() as
      { id: string; name: string; sort_order: number }[];
    assert(medications.length === 2, `expected 2 medications, received ${medications.length}`);
    assert(medications[0].id === 'm1' && medications[0].sort_order === 0, 'the older medication backfills to sort_order 0');
    assert(medications[1].id === 'm2' && medications[1].sort_order === 1, 'the newer medication backfills to sort_order 1');
    const injections = db.prepare(`SELECT id FROM injections`).all();
    assert(injections.length === 1, 'the injection survived the upgrade');
  });

  await test('a migration the old runner half-applied is repaired on the next launch', async () => {
    // Builds 1.0.1 to 1.2.2 ran a migration as bare SQL and wrote the version
    // afterwards, so a kill between the two left the columns without the
    // version. Migration 4 adds four columns; this device died after the first.
    const db = await migrated(3);
    const statements = splitStatements(MIGRATIONS[3].up);
    assert(MIGRATIONS[3].version === 4 && statements.length === 4, 'migration 4 still adds four columns');
    db.exec(statements[0]);

    await runMigrations(driverFor(db));

    const columns = columnNames(db, 'preferences');
    assert(columns.includes('review_event_count'), 'the column that had landed is still there');
    assert(columns.includes('review_prompted_version'), 'the columns after it were applied on the replay');
    assert(readVersion(db) === SCHEMA_VERSION, `the launch finished the whole chain, received ${readVersion(db)}`);
    assert(schemaShape(db) === schemaShape(await migrated()), 'the repaired database matches a fresh install');
  });

  await test('the skip is per statement, so a replay adds the columns that are missing', async () => {
    const db = new DatabaseSync(':memory:');
    db.exec('CREATE TABLE t (id INTEGER);');
    db.exec('ALTER TABLE t ADD COLUMN a INTEGER;');
    await runMigrations(driverFor(db), [
      { version: LAST_UNTRANSACTED_VERSION, up: 'ALTER TABLE t ADD COLUMN a INTEGER; ALTER TABLE t ADD COLUMN b INTEGER;' },
    ]);
    assert(columnNames(db, 't').join(',') === 'id,a,b', `expected id,a,b, received ${columnNames(db, 't').join(',')}`);
    assert(readVersion(db) === LAST_UNTRANSACTED_VERSION, 'the repaired migration is recorded as done');
  });

  await test('a duplicate column above the untransacted range still throws', async () => {
    const db = new DatabaseSync(':memory:');
    db.exec('CREATE TABLE t (id INTEGER, a INTEGER);');
    await assertThrows(
      () => runMigrations(driverFor(db), [
        { version: LAST_UNTRANSACTED_VERSION + 1, up: 'ALTER TABLE t ADD COLUMN a INTEGER;' },
      ]),
      'duplicate column name',
    );
    assert(readVersion(db) === 0, 'a migration that threw is not recorded as done');
  });

  await test('a duplicate column inside a CREATE TABLE throws, even down in the range', async () => {
    const db = new DatabaseSync(':memory:');
    await assertThrows(
      () => runMigrations(driverFor(db), [{ version: 1, up: 'CREATE TABLE t (a INTEGER, a INTEGER);' }]),
      'duplicate column name',
    );
  });

  await test('any other failure throws and takes the whole migration back with it', async () => {
    const db = new DatabaseSync(':memory:');
    await assertThrows(
      () => runMigrations(driverFor(db), [{
        version: 1,
        up: 'CREATE TABLE landed (id INTEGER); ALTER TABLE absent ADD COLUMN a INTEGER;',
      }]),
      'no such table',
    );
    assert(columnNames(db, 'landed').length === 0, 'the statement that succeeded rolled back with the one that failed');
    assert(readVersion(db) === 0, 'a half-applied migration is not recorded as done');
  });

  await test('a semicolon inside a string literal does not end a statement', () => {
    const parts = splitStatements(`INSERT INTO t (note) VALUES ('a; b'); UPDATE t SET note = 'c';`);
    assert(parts.length === 2, `expected 2 statements, received ${parts.length}`);
    assert(parts[0].includes(`'a; b'`), 'the literal came through whole');
  });

  await test('comments never end a statement and never become one', () => {
    const parts = splitStatements(`-- a note\nALTER TABLE t ADD COLUMN a INTEGER; /* ; */\n-- trailing\n`);
    assert(parts.length === 1, `expected 1 statement, received ${parts.length}`);
    const tail = splitStatements('ALTER TABLE t ADD COLUMN a INTEGER');
    assert(tail.length === 1, 'a migration that does not end in a semicolon keeps its last statement');
  });

  await test('a CREATE TRIGGER is refused rather than cut in half', () => {
    assertThrowsSync(
      () => splitStatements('CREATE TRIGGER x AFTER INSERT ON t BEGIN UPDATE t SET a = 1; END;'),
      'CREATE TRIGGER',
    );
  });

  await test('the two predicates that narrow the skip are narrow', () => {
    assert(isDuplicateColumnError(new Error('duplicate column name: a')), 'SQLite\'s own wording');
    assert(!isDuplicateColumnError(new Error('no such table: t')), 'a missing table is not benign');
    assert(!isDuplicateColumnError(new Error('table t has no column named a')), 'a missing column is not benign');
    assert(!isDuplicateColumnError(new Error('database or disk is full')), 'a full disk is not benign');
    assert(isAddColumnStatement('  ALTER TABLE t ADD COLUMN a INTEGER'), 'the statement the skip is for');
    assert(isAddColumnStatement('-- note\nALTER TABLE t ADD a INTEGER'), 'the COLUMN keyword is optional in SQLite');
    assert(!isAddColumnStatement('CREATE TABLE t (a INTEGER, a INTEGER)'), 'a CREATE TABLE is not an ADD COLUMN');
    assert(!isAddColumnStatement('ALTER TABLE t RENAME TO u'), 'a rename is not an ADD COLUMN');
  });

  console.log('16 migration tests passed.');
}

/** A database taken through the chain, up to `stop` or all the way. */
async function migrated(stop = SCHEMA_VERSION): Promise<DatabaseSync> {
  const db = new DatabaseSync(':memory:');
  await runMigrations(driverFor(db), MIGRATIONS.filter((migration) => migration.version <= stop));
  return db;
}

/** The `node:sqlite` side of the runner. expo-sqlite has its own in `client.ts`. */
function driverFor(db: DatabaseSync): MigrationDriver {
  return {
    execute: async (sql: string) => {
      db.exec(sql);
    },
    run: async (sql: string, params: (string | number | null)[]) => {
      db.prepare(sql).run(...params);
    },
    first: async <T,>(sql: string) => (db.prepare(sql).get() ?? null) as T | null,
    transaction: async (body: () => Promise<void>) => {
      db.exec('BEGIN');
      try {
        await body();
        db.exec('COMMIT');
      } catch (error: unknown) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

function readVersion(db: DatabaseSync): number {
  const row = db.prepare(`SELECT value FROM _meta WHERE key = 'schema_version'`).get() as
    { value: string } | undefined;
  return row ? Number(row.value) : 0;
}

function columnNames(db: DatabaseSync, table: string): string[] {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return columns.map((column) => column.name);
}

/**
 * Everything about the schema that two databases have to agree on: each table
 * with its columns, their types, their NOT NULL and DEFAULT and primary key,
 * and the SQL of every index. Row data is not in it, so a staged database and a
 * fresh one can be compared directly.
 */
function schemaShape(db: DatabaseSync): string {
  const objects = db.prepare(
    `SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name`,
  ).all() as { type: string; name: string; sql: string | null }[];

  return objects.map((object) => {
    if (object.type !== 'table') return `${object.type} ${object.name} ${object.sql ?? ''}`;
    const columns = (db.prepare(`PRAGMA table_info(${object.name})`).all() as {
      name: string; type: string; notnull: number; dflt_value: string | null; pk: number;
    }[]).map((column) => [
      column.name, column.type, column.notnull, column.dflt_value ?? 'NULL', column.pk,
    ].join(':'));
    return `table ${object.name} ${columns.join(' | ')}`;
  }).join('\n');
}

function assert(value: boolean, label = 'assertion') {
  if (!value) throw new Error(`FAIL: ${label}`);
}

async function assertThrows(body: () => Promise<unknown>, needle: string) {
  let caught: unknown = null;
  try {
    await body();
  } catch (error: unknown) {
    caught = error;
  }
  assert(caught !== null, `expected a throw holding "${needle}", nothing threw`);
  const message = caught instanceof Error ? caught.message : String(caught);
  assert(message.toLowerCase().includes(needle.toLowerCase()), `expected "${needle}", received "${message}"`);
}

function assertThrowsSync(body: () => unknown, needle: string) {
  let caught: unknown = null;
  try {
    body();
  } catch (error: unknown) {
    caught = error;
  }
  assert(caught !== null, `expected a throw holding "${needle}", nothing threw`);
  const message = caught instanceof Error ? caught.message : String(caught);
  assert(message.includes(needle), `expected "${needle}", received "${message}"`);
}

async function test(name: string, body: () => void | Promise<void>) {
  await body();
  console.log(`PASS ${name}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
