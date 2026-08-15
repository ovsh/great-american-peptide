// SQLite schema. Append a migration to MIGRATIONS with the next version number
// and nothing else: `SCHEMA_VERSION` reads itself off the end of the array now,
// and the runner in `migrate.ts` applies every version above the one the device
// holds, in order, each inside its own transaction.
//
// Migrations are append-only. Never edit a migration that has shipped, because
// a device that already ran it never sees the edit.

export interface Migration {
  version: number;
  up: string;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    up: `
      CREATE TABLE IF NOT EXISTS medications (
        id              TEXT PRIMARY KEY,
        name            TEXT NOT NULL,
        preset_id       TEXT,
        default_dose    REAL NOT NULL,
        default_unit    TEXT NOT NULL,
        default_route   TEXT NOT NULL,
        frequency_kind  TEXT NOT NULL,
        frequency_value INTEGER,
        half_life_hours REAL,
        color_index     INTEGER NOT NULL,
        status          TEXT NOT NULL DEFAULT 'active',
        created_at      INTEGER NOT NULL,
        updated_at      INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS injections (
        id              TEXT PRIMARY KEY,
        medication_id   TEXT NOT NULL,
        dose            REAL NOT NULL,
        unit            TEXT NOT NULL,
        route           TEXT NOT NULL,
        site_id         TEXT,
        taken_at        INTEGER NOT NULL,
        scheduled_at    INTEGER,
        notes           TEXT,
        deleted_at      INTEGER,
        created_at      INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_injections_taken_at ON injections(taken_at);
      CREATE INDEX IF NOT EXISTS idx_injections_med ON injections(medication_id, taken_at);

      CREATE TABLE IF NOT EXISTS measurements (
        id          TEXT PRIMARY KEY,
        kind        TEXT NOT NULL,
        value       REAL NOT NULL,
        unit        TEXT,
        taken_at    INTEGER NOT NULL,
        source      TEXT NOT NULL DEFAULT 'manual',
        source_id   TEXT,
        notes       TEXT,
        deleted_at  INTEGER,
        created_at  INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_measurements_kind_taken ON measurements(kind, taken_at);

      CREATE TABLE IF NOT EXISTS preferences (
        id                       INTEGER PRIMARY KEY CHECK (id = 1),
        weight_unit              TEXT NOT NULL DEFAULT 'lb',
        height_unit              TEXT NOT NULL DEFAULT 'in',
        reminder_time            TEXT NOT NULL DEFAULT '09:00',
        notifications_enabled    INTEGER NOT NULL DEFAULT 1,
        disclaimer_accepted_at   INTEGER,
        onboarding_completed_at  INTEGER,
        start_weight             REAL,
        start_weight_at          INTEGER,
        height                   REAL,
        updated_at               INTEGER NOT NULL
      );

      INSERT OR IGNORE INTO preferences (id, updated_at) VALUES (1, strftime('%s','now') * 1000);
    `,
  },
  {
    version: 2,
    up: `ALTER TABLE medications ADD COLUMN tmax_hours REAL;`,
  },
  {
    version: 3,
    up: `ALTER TABLE preferences ADD COLUMN goal_weight REAL;`,
  },
  {
    version: 4,
    up: `
      ALTER TABLE preferences ADD COLUMN review_event_count INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE preferences ADD COLUMN review_first_event_at INTEGER;
      ALTER TABLE preferences ADD COLUMN review_last_prompted_at INTEGER;
      ALTER TABLE preferences ADD COLUMN review_prompted_version TEXT;
    `,
  },
  {
    version: 5,
    up: `
      CREATE TABLE IF NOT EXISTS side_effect_logs (
        id          TEXT PRIMARY KEY,
        effect      TEXT NOT NULL,
        severity    INTEGER NOT NULL,
        taken_at    INTEGER NOT NULL,
        notes       TEXT,
        deleted_at  INTEGER,
        created_at  INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_side_effects_taken ON side_effect_logs(taken_at);

      ALTER TABLE preferences ADD COLUMN goal_kind TEXT;
      ALTER TABLE preferences ADD COLUMN display_name TEXT;
      ALTER TABLE preferences ADD COLUMN side_effect_concerns TEXT;
    `,
  },
  {
    version: 6,
    up: `
      ALTER TABLE preferences ADD COLUMN review_prompt_log TEXT;
      ALTER TABLE preferences ADD COLUMN review_triggers_used TEXT;
    `,
  },
  {
    // The onboarding rebuild asks fourteen questions. These are the answers that
    // had nowhere to live. A question whose answer is thrown away is a question
    // Poke should not be asking, so every one of them lands in a column.
    version: 7,
    up: `
      ALTER TABLE preferences ADD COLUMN journey_stage TEXT;
      ALTER TABLE preferences ADD COLUMN sex TEXT;
      ALTER TABLE preferences ADD COLUMN birth_year INTEGER;
      ALTER TABLE preferences ADD COLUMN activity_level TEXT;
      ALTER TABLE preferences ADD COLUMN motivation TEXT;
      ALTER TABLE preferences ADD COLUMN weekly_pace REAL;
      ALTER TABLE preferences ADD COLUMN last_shot_at INTEGER;
    `,
  },
  {
    // Poke Pro for an early tester, granted by a code instead of a payment. A
    // timestamp rather than a flag, so the row also says when the grant started.
    // Null means no code is active, which is the only state a paying user is in.
    version: 8,
    up: `ALTER TABLE preferences ADD COLUMN tester_pro_at INTEGER;`,
  },
  {
    // A medication copies the half-life and the Tmax of its preset at the
    // moment the user adds it. The copy does not follow the preset, so the
    // 2026 review of the preset library left older rows drawing curves from
    // numbers the library no longer holds — a dulaglutide row at 113 hours
    // where the FDA label says 5 days, and five recovery peptides with no
    // curve at all.
    //
    // Each statement below moves one preset forward, and only for a row that
    // still holds the value the preset used to give it, or holds nothing. A
    // row with any other number is one the user typed, so it stays. Tmax is
    // written only where the row has none, for the same reason.
    //
    // The tolerance on the comparison is there because these are REAL columns
    // written from JavaScript doubles.
    version: 9,
    up: `
      UPDATE medications SET half_life_hours = 168, updated_at = strftime('%s','now') * 1000
       WHERE preset_id = 'semaglutide'
         AND (half_life_hours IS NULL OR ABS(half_life_hours - 165) < 0.0005);

      UPDATE medications SET half_life_hours = 120, updated_at = strftime('%s','now') * 1000
       WHERE preset_id = 'tirzepatide'
         AND (half_life_hours IS NULL OR ABS(half_life_hours - 117) < 0.0005);

      UPDATE medications SET half_life_hours = 120, updated_at = strftime('%s','now') * 1000
       WHERE preset_id = 'dulaglutide'
         AND (half_life_hours IS NULL OR ABS(half_life_hours - 113) < 0.0005);

      UPDATE medications
         SET half_life_hours = 0.18,
             tmax_hours = COALESCE(tmax_hours, 0.15),
             updated_at = strftime('%s','now') * 1000
       WHERE preset_id = 'tesamorelin'
         AND (half_life_hours IS NULL OR ABS(half_life_hours - 0.63) < 0.0005);

      UPDATE medications
         SET tmax_hours = COALESCE(tmax_hours, 18),
             updated_at = strftime('%s','now') * 1000
       WHERE preset_id = 'survodutide'
         AND tmax_hours IS NULL
         AND (half_life_hours IS NULL OR ABS(half_life_hours - 144) < 0.0005);

      UPDATE medications
         SET tmax_hours = COALESCE(tmax_hours, 2),
             updated_at = strftime('%s','now') * 1000
       WHERE preset_id = 'thymosin-alpha-1'
         AND tmax_hours IS NULL
         AND (half_life_hours IS NULL OR ABS(half_life_hours - 2) < 0.0005);

      UPDATE medications
         SET half_life_hours = 0.75,
             tmax_hours = COALESCE(tmax_hours, 0.25),
             updated_at = strftime('%s','now') * 1000
       WHERE preset_id = 'bpc-157' AND half_life_hours IS NULL;

      UPDATE medications
         SET half_life_hours = 2,
             tmax_hours = COALESCE(tmax_hours, 1),
             updated_at = strftime('%s','now') * 1000
       WHERE preset_id = 'tb-500' AND half_life_hours IS NULL;

      UPDATE medications
         SET half_life_hours = 0.5,
             tmax_hours = COALESCE(tmax_hours, 0.25),
             updated_at = strftime('%s','now') * 1000
       WHERE preset_id = 'ghk-cu' AND half_life_hours IS NULL;

      UPDATE medications
         SET half_life_hours = 1.5,
             tmax_hours = COALESCE(tmax_hours, 1),
             updated_at = strftime('%s','now') * 1000
       WHERE preset_id = 'nad-plus' AND half_life_hours IS NULL;

      UPDATE medications
         SET half_life_hours = 0.5,
             tmax_hours = COALESCE(tmax_hours, 0.25),
             updated_at = strftime('%s','now') * 1000
       WHERE preset_id = 'epitalon' AND half_life_hours IS NULL;
    `,
  },
  {
    // Today now opens on one medication and holds a hand-made order, so both
    // have to survive a relaunch.
    //
    // `sort_order` is the order the user dragged the rows into. The backfill
    // counts the rows added before each one, so the first order the app shows
    // is the order the medications were added in — which is what the screen
    // showed before anyone could drag anything. `id` breaks a tie between two
    // rows written in the same millisecond, so every row gets its own number.
    //
    // `focused_medication_id` is the card Today opens on. It is a preference
    // and not a column on `medications`, because it names one row out of the
    // table rather than describing any of them. A stale id is harmless: Today
    // falls back to the first medication by `sort_order` when the saved one is
    // gone or archived.
    version: 10,
    up: `
      ALTER TABLE medications ADD COLUMN sort_order INTEGER;

      UPDATE medications SET sort_order = (
        SELECT COUNT(*) FROM medications AS earlier
         WHERE earlier.created_at < medications.created_at
            OR (earlier.created_at = medications.created_at AND earlier.id <= medications.id)
      ) - 1;

      ALTER TABLE preferences ADD COLUMN focused_medication_id TEXT;
    `,
  },
  {
    // One switch per notification loop. `notifications_enabled` stays the master
    // switch and the shot-day switch: with it off Poke schedules nothing at all.
    // The two new loops ship on, which is why the permission screen names all
    // three of them.
    //
    // `notif_checkin_delay_hours` holds 24, 36 or 48. The scheduler falls back
    // to 36 for any other number, so a row edited by hand cannot break it.
    version: 11,
    up: `
      ALTER TABLE preferences ADD COLUMN notif_checkin_enabled INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE preferences ADD COLUMN notif_checkin_delay_hours INTEGER NOT NULL DEFAULT 36;
      ALTER TABLE preferences ADD COLUMN notif_missed_enabled INTEGER NOT NULL DEFAULT 1;
    `,
  },
  {
    // Weight read from Apple Health. `measurements.source` was typed
    // 'manual' | 'healthkit' from the first schema, so the rows have always had
    // a place to land; this migration adds the two things that were missing.
    //
    // The index is what makes a sync idempotent. A HealthKit sample carries a
    // stable uuid, so a re-read of the same window offers rows Poke already
    // holds, and `INSERT OR IGNORE` against this index drops them instead of
    // drawing the same weigh-in twice. Without it the importer would need an
    // anchor it could lose, or a read-back per sample. It is partial because
    // every manual row holds a NULL `source_id` and must keep doing so.
    //
    // `health_sync_enabled` defaults to 0. A permission is the user's to give,
    // and an install that upgrades into this version must not start reading
    // Health because it updated.
    //
    // `health_synced_at` is the last read Poke completed, which Profile shows.
    // It is not an anchor: the importer re-reads a window that opens a month
    // before it and the index absorbs the overlap, so a lost timestamp costs one
    // slow read of the whole history and no wrong rows.
    version: 12,
    up: `
      CREATE UNIQUE INDEX IF NOT EXISTS idx_measurements_source_id
        ON measurements(source, source_id) WHERE source_id IS NOT NULL;

      ALTER TABLE preferences ADD COLUMN health_sync_enabled INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE preferences ADD COLUMN health_synced_at INTEGER;
    `,
  },
  {
    // A cycle is a plan the user wrote down, and these four columns hold all of
    // it. There is no cycles table, because pause was already the primitive: a
    // paused medication draws no reminder, holds no free slot and keeps its
    // history. What pause never had was a date. `paused_at` is that date, and
    // it is written on every pause, a cycle or not, so a plain pause finally
    // says when it started as well.
    //
    // The two nulls say different things and neither can be read off the other.
    // `cycle_days_on` NULL means this medication has no cycle, which is every
    // row on the disk the day this ships. `cycle_days_off` NULL means the user
    // chose no break reminder on a medication that does have a cycle.
    //
    // `cycle_started_at` is the anchor the week count reads. It is backdatable,
    // because the users who asked for this are already part way through a cycle
    // and a plan that can only start today would make the app wrong about them
    // on the first screen. `scheduling.ts` now starts a schedule at
    // `cycle_started_at ?? created_at`, so a resume re-anchors an every_n_days
    // medication rather than letting it drift by the length of the break.
    //
    // Days and not weeks, because a protocol counted in days exists and a column
    // that could not hold one would round the user's own plan. The screens show
    // weeks only when the number divides by seven, and days otherwise.
    //
    // `notif_cycle_enabled` ships on beside the other loops, and
    // `notifications_enabled` stays the master switch over it.
    version: 13,
    up: `
      ALTER TABLE medications ADD COLUMN cycle_days_on INTEGER;
      ALTER TABLE medications ADD COLUMN cycle_days_off INTEGER;
      ALTER TABLE medications ADD COLUMN cycle_started_at INTEGER;
      ALTER TABLE medications ADD COLUMN paused_at INTEGER;

      ALTER TABLE preferences ADD COLUMN notif_cycle_enabled INTEGER NOT NULL DEFAULT 1;
    `,
  },
  {
    // What the vial label says a blend holds, as a JSON array of
    // `{presetId, mg}` lines. The user types every number off their own label,
    // because Poke proposes no composition and no ratio. The level chart
    // splits each logged dose across the parts by these milligrams and draws
    // each part at its own sourced rate.
    //
    // Null means no composition entered, and the medication then behaves as
    // any unsourced preset does: shot marks and no curve. The column is
    // meaningful only on a medication whose preset is a blend; readers get to
    // the lines through `parseComposition` in `domain/blends.ts`, which reads
    // anything malformed as null instead of throwing.
    version: 14,
    up: `ALTER TABLE medications ADD COLUMN composition TEXT;`,
  },
  {
    // The dose each scheduled weekday carries, as a JSON map keyed by the
    // `Date.getDay()` weekday: `{"1":6,"4":2}` is 6 mg on Monday and 2 mg on
    // Thursday. The user types every number; `default_dose` stays and covers
    // any day the map skips. Null means one dose for every day, which is every
    // medication written before this column existed. Readers go through
    // `parseDoseByDay` in `domain/doseByDay.ts`, which reads anything
    // malformed as null instead of throwing.
    version: 15,
    up: `ALTER TABLE medications ADD COLUMN dose_by_day TEXT;`,
  },
  {
    // The tester id a redeemed code carried, so the owner can tell which invited
    // tester a device belongs to. `tester_pro_at` above stays the switch every
    // Pro gate reads; this column is the name on it. Null on a device that
    // redeemed no code, and null on one that redeemed a code before this column
    // existed, which is why nothing reads it as the grant.
    version: 16,
    up: `ALTER TABLE preferences ADD COLUMN tester_id INTEGER;`,
  },
];

/**
 * The version a finished upgrade lands on. Read off the array, never typed by
 * hand: it was a hand-bumped constant at the top of this file and it sat at 11
 * while the array held 12. `migrations.test.ts` holds it to the last migration,
 * and the same test holds the array to one strictly increasing run of versions,
 * so the last entry is always the highest one.
 */
export const SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;
