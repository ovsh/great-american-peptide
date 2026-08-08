// SQLite schema. Add new migrations to MIGRATIONS array
// and bump SCHEMA_VERSION; older versions get applied in order on launch.

export const SCHEMA_VERSION = 5;

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
];
