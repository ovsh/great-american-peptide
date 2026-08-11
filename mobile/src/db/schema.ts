// SQLite schema. Add new migrations to MIGRATIONS array
// and bump SCHEMA_VERSION; older versions get applied in order on launch.

export const SCHEMA_VERSION = 9;

export const MIGRATIONS: { version: number; up: string }[] = [
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
];
