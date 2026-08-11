#!/usr/bin/env python3
"""Seed the App Store demo dataset into a simulator's Poke database.

    python3 scripts/seed-store-demo.py "$(xcrun simctl get_app_container \
        <udid> industries.peptide.tracker data)/Documents/SQLite/peptide_tracker.db"

Every store slide is captured against this one dataset, so the medication, the
dose and the weight on any two slides agree. Launch the app once first: the
database and its migrations are made on first run, and this script only fills
the tables in.

The half-life and tmax on each medication must stay equal to the preset it was
created from in src/domain/peptides.ts. The level report names an overridden
half-life as the user's own ("Half-life entered by you."), which is true of a
real override and false of a demo row that drifted from its preset.

See docs/store-setup.md for the capture and render steps around this.
"""
import sqlite3
import sys
from datetime import datetime, timedelta

DB = sys.argv[1]

TODAY = datetime(2026, 8, 11)          # Tuesday
SHOT_HOUR, SHOT_MIN = 18, 0            # reminder_time 18:00


def ms(dt: datetime) -> int:
    return int(dt.timestamp() * 1000)


def at(y, m, d, hh=0, mm=0):
    return ms(datetime(y, m, d, hh, mm))


CJC = 'med_store_cjc1295'
TIRZ = 'med_store_tirzepatide'

# Both were added the same evening. CJC goes in first, so the palette hands it
# index 0 and Tirzepatide index 1, exactly as nextColorIndex() would.
CJC_CREATED = at(2026, 5, 19, 11, 0)
TIRZ_CREATED = at(2026, 5, 19, 12, 0)

SC_SITES = [
    'belly_upper_left', 'belly_mid_right', 'thigh_left_front', 'belly_lower_right',
    'shoulder_left_front', 'belly_upper_right', 'thigh_right_front', 'belly_mid_left',
    'shoulder_right_front', 'belly_lower_left',
]


def weekly(start: datetime, last: datetime):
    out = []
    cur = start
    while cur <= last:
        out.append(cur)
        cur += timedelta(days=7)
    return out


# ── shots ────────────────────────────────────────────────────────────────
# Tirzepatide is the focused medication, so it holds the Tuesday slot: today's
# dose is deliberately not logged, which is what makes Today show it as due.
tirz_days = weekly(datetime(2026, 5, 19), datetime(2026, 8, 4))
# CJC every Friday from 22 May through last Friday, with one week missed.
cjc_days = weekly(datetime(2026, 5, 22), datetime(2026, 8, 7))
cjc_days = [d for d in cjc_days if d != datetime(2026, 6, 19)]

MINUTES = [4, 11, 22, 6, 37, 14, 2, 26, 9, 41, 18, 33]

injections = []
for i, day in enumerate(cjc_days):
    taken = day.replace(hour=SHOT_HOUR, minute=SHOT_MIN) + timedelta(minutes=MINUTES[i % len(MINUTES)])
    injections.append((
        f'inj_cjc_{i:02d}', CJC, 100.0, 'mcg', 'sc', SC_SITES[i % len(SC_SITES)],
        ms(taken), at(day.year, day.month, day.day, SHOT_HOUR, SHOT_MIN),
    ))
for i, day in enumerate(tirz_days):
    taken = day.replace(hour=SHOT_HOUR, minute=SHOT_MIN) + timedelta(minutes=MINUTES[(i + 5) % len(MINUTES)])
    injections.append((
        f'inj_tirz_{i:02d}', TIRZ, 7.5, 'mg', 'sc', SC_SITES[(i + 3) % len(SC_SITES)],
        ms(taken), at(day.year, day.month, day.day, SHOT_HOUR, SHOT_MIN),
    ))

# ── weights ──────────────────────────────────────────────────────────────
WEIGHTS = [
    ((2026, 5, 19), 214.2), ((2026, 5, 26), 212.8), ((2026, 6, 2), 210.9),
    ((2026, 6, 9), 209.1), ((2026, 6, 16), 207.4), ((2026, 6, 23), 205.2),
    ((2026, 6, 30), 203.6), ((2026, 7, 7), 201.4), ((2026, 7, 14), 199.8),
    ((2026, 7, 21), 197.5), ((2026, 7, 28), 195.2), ((2026, 8, 3), 193.1),
    ((2026, 8, 7), 191.4),
]

# ── side effects ─────────────────────────────────────────────────────────
EFFECTS = [
    ((2026, 5, 20), 'nausea', 4),
    ((2026, 6, 3), 'fatigue', 3),
    ((2026, 6, 24), 'nausea', 3),
    ((2026, 7, 15), 'fatigue', 2),
    ((2026, 8, 2), 'nausea', 2),
]

NOW = ms(datetime.now())

db = sqlite3.connect(DB)
db.execute('PRAGMA journal_mode = WAL;')
cur = db.cursor()
for table in ('injections', 'medications', 'measurements', 'side_effect_logs'):
    cur.execute(f'DELETE FROM {table}')

cur.executemany(
    """INSERT INTO medications
       (id, name, preset_id, default_dose, default_unit, default_route,
        frequency_kind, frequency_value, half_life_hours, tmax_hours,
        color_index, status, sort_order, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,'active',?,?,?)""",
    [
        # half_life_hours and tmax_hours are the preset's own numbers.
        (CJC, 'CJC-1295 (DAC)', 'cjc-1295', 100.0, 'mcg', 'sc',
         'weekly', 5, 168.0, None, 0, 0, CJC_CREATED, CJC_CREATED),
        (TIRZ, 'Tirzepatide', 'tirzepatide', 7.5, 'mg', 'sc',
         'weekly', 2, 120.0, 24.0, 1, 1, TIRZ_CREATED, TIRZ_CREATED),
    ],
)

cur.executemany(
    """INSERT INTO injections
       (id, medication_id, dose, unit, route, site_id, taken_at, scheduled_at,
        notes, deleted_at, created_at)
       VALUES (?,?,?,?,?,?,?,?,NULL,NULL,?)""",
    [(*row, row[6]) for row in injections],
)

cur.executemany(
    """INSERT INTO measurements
       (id, kind, value, unit, taken_at, source, source_id, notes, deleted_at, created_at)
       VALUES (?, 'weight', ?, 'lb', ?, 'manual', NULL, NULL, NULL, ?)""",
    [
        (f'msr_w_{i:02d}', value, at(*day, 7, 20), at(*day, 7, 20))
        for i, (day, value) in enumerate(WEIGHTS)
    ],
)

cur.executemany(
    """INSERT INTO side_effect_logs
       (id, effect, severity, taken_at, notes, deleted_at, created_at)
       VALUES (?,?,?,?,NULL,NULL,?)""",
    [
        (f'sfx_{i:02d}', effect, severity, at(*day, 20, 10), at(*day, 20, 10))
        for i, (day, effect, severity) in enumerate(EFFECTS)
    ],
)

cur.execute(
    """INSERT INTO preferences
       (id, weight_unit, height_unit, reminder_time, notifications_enabled,
        disclaimer_accepted_at, onboarding_completed_at, start_weight,
        start_weight_at, height, goal_weight, updated_at, tester_pro_at,
        focused_medication_id)
       VALUES (1, 'lb', 'in', '18:00', 1, ?, ?, 214.2, ?, 70.0, 175.0, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
        weight_unit='lb', height_unit='in', reminder_time='18:00',
        notifications_enabled=1, disclaimer_accepted_at=excluded.disclaimer_accepted_at,
        onboarding_completed_at=excluded.onboarding_completed_at,
        start_weight=214.2, start_weight_at=excluded.start_weight_at, height=70.0,
        goal_weight=175.0, updated_at=excluded.updated_at,
        tester_pro_at=excluded.tester_pro_at,
        focused_medication_id=excluded.focused_medication_id""",
    (CJC_CREATED, CJC_CREATED, at(2026, 5, 19, 7, 20), NOW, CJC_CREATED, TIRZ),
)

db.commit()
print('medications', cur.execute('select count(*) from medications').fetchone()[0])
print('injections', cur.execute('select count(*) from injections').fetchone()[0])
print('weights', cur.execute('select count(*) from measurements').fetchone()[0])
print('effects', cur.execute('select count(*) from side_effect_logs').fetchone()[0])
db.close()
