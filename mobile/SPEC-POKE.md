# Poke — rebuild spec

Rebuild of "The Great Peptide Tracker" (Expo 54, expo-router, SQLite) into **Poke:
Peptide & GLP-1 Tracker**. MeAgain-style product structure, our own branding. The user
verdict on the old app: "convoluted, clunky, ugly, over the top." The new app is the
opposite: few decisions per screen, big obvious buttons, calm surfaces, generous space.

## What stays

- Domain layer verbatim: `src/domain/*` (pk, reconstitution, rotation, scheduling, units).
- DB layer: `src/db/*`, `src/repositories/*` (plus one migration, below).
- Services: notifications, review. Store: `src/stores/app.ts`.
- Expo config identity: bundle id `industries.peptide.tracker`. Display name changes.

## What dies

- The Americana theme: cream `#F2E9D8`, crimson, gold, navy, Fraunces serif, BrandSeal,
  MastHead, Eyebrow. All of it.
- The center-seal tab button.
- Dead-end mini-cards on empty home.

## Data shapes (name the shape first)

Migration v5:

```sql
CREATE TABLE IF NOT EXISTS side_effect_logs (
  id          TEXT PRIMARY KEY,
  effect      TEXT NOT NULL,          -- 'nausea' | 'fatigue' | 'constipation' | 'headache' | 'injection_site' | 'appetite_loss' | 'other'
  severity    INTEGER NOT NULL,       -- 1 mild | 2 moderate | 3 severe
  taken_at    INTEGER NOT NULL,
  notes       TEXT,
  deleted_at  INTEGER,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_side_effects_taken ON side_effect_logs(taken_at);
```

Preferences additions (same migration):

```sql
ALTER TABLE preferences ADD COLUMN goal_kind TEXT;         -- 'weight_loss' | 'recovery' | 'longevity' | 'performance' | 'other'
ALTER TABLE preferences ADD COLUMN display_name TEXT;      -- optional first name from onboarding
```

Streaks: derived from injections vs medication schedule (`src/domain/scheduling.ts`),
never stored. Water/protein (stretch): `measurements.kind` extension ('water_ml',
'protein_g'), no migration needed.

## Design tokens (replaces src/theme)

- Surfaces: background `#FAFAF8`, card `#FFFFFF`, ink `#111418`, muted `#6B7280`,
  subtle `#9AA1AA`. Hairline borders `rgba(17,20,24,0.08)`.
- Accent: **one** hue. Poke green `#2FB47C` (calm, health, distinct from MeAgain's warm
  peach/coral and Shotsy's blue). Soft tint `#E7F6EF`. Danger `#E5484D` reserved for
  destructive only.
- Type: Inter only. Display 28/600, title 20/600, body 16/400, label 13/500. No serif,
  no uppercase tracking anywhere.
- Shape: radius 20 cards, 16 buttons. Primary button height 56, full-width, green fill,
  white 17/600 label. Secondary: white fill, hairline border.
- Space: screen padding 20, card padding 20, 12 between cards, 32 between sections.
- Motion: default spring on sheet/nav, no decorative animation.

## IA

Tabs: **Today** · **Progress** · (center +) · **History** · **Profile**.
Center + opens the log sheet (shot / weight / side effect / water).

Routes:
- `/onboarding/*` — gated: if `preferences.onboarding_completed_at` is null, root
  redirects here. Skippable never; finishable in <60s.
- `/(tabs)/index` Today, `/(tabs)/progress`, `/(tabs)/history`, `/(tabs)/profile`.
- Modals: `/log-shot`, `/log-weight`, `/log-side-effect`, `/calculator` (kept),
  `/medications/*` (kept, restyled).

## Onboarding flow (informed by MeAgain teardown)

MeAgain's school: one question per screen → "plan ready" payoff screen echoing the
user's own answers. We copy the structure, not the hard paywall (their #1 complaint:
"no free trial", "can't track ANYTHING without membership"). Poke ships no paywall.

Screens (one question each, progress dots on top, Back always works, <60s total):
1. **Welcome** — wordmark, tagline "Your shots, sorted.", one button "Get started".
2. **What are you taking?** — preset grid, multi-select (semaglutide, tirzepatide,
   retatrutide, BPC-157, TB-500, CJC-1295/Ipamorelin, GHK-Cu, custom). Prefills from
   `src/domain/peptides` presets.
3. **Dose & schedule** — for the primary med: dose prefilled from preset, frequency
   (weekly default), next dose day picker. Copy names the real thing: "When's shot day?"
4. **What's the goal?** — single-select: weight loss / recovery / longevity /
   performance → `preferences.goal_kind`; tailors Today copy.
5. **Weight** — current + goal weight, lb/kg toggle, skippable ("I'll add this later").
6. **Anything you're watching for?** — side-effect concern multi-select (nausea,
   fatigue, constipation, injection-site reactions, none) → echoed on plan screen,
   stored `preferences.side_effect_concerns` (JSON).
7. **Reminders** — default 9:00, day derived from shot day. Accept = request notification
   permission. Skippable.
8. **Plan ready** — the payoff: "Your plan is ready." Card echoes their answers:
   med + dose + shot day + goal + "we'll watch for nausea" line. NO fabricated
   date-of-goal projection (that's a medical-ish claim we won't fake). Button
   "Start tracking" → seeds medications, sets `onboarding_completed_at`, lands Today.

Gate: root layout redirects to /onboarding when `onboarding_completed_at` is null.

## Design refinements from teardown (applied to tokens above)

- Cards: white, radius 20–24, soft diffuse shadow, NO borders (MeAgain pattern; our
  hairline-border draft is dropped for cards, kept for list separators).
- The value is the biggest thing on every card; unit/target small and grey beside it.
- Per-metric accent identity, from our palette: medication/level = Poke green,
  weight/goal = warm amber `#E8A13C`, side effects = soft violet `#8B7BD8`,
  water = blue `#4A9FE8` (stretch). One identity color per metric, used consistently.
- Inline ± steppers on quick-log tiles — logging never navigates away.
- "Log shot" rendered oversized relative to siblings — the one action that matters.
- Shot countdown lives ON the Today dashboard, never widget-only.
- Copy: second person, short, non-clinical, names the lived routine ("shot day").
  Disclaimer discipline on every info surface.
- Severity for side effects: 0–10 slider (MeAgain convention), presets + custom.

## Screens

**Today**: greeting + date. Hero card: next dose ("Semaglutide · 0.5 mg · due today"),
big **Log shot** button. If logged: checkmark state + streak. Week dot-strip. Quick
tiles: weight, side effect. Est. level sparkline if med has half-life. Empty states
always have one obvious action.

**Log shot**: preselected med + dose + auto-suggested next site (rotation domain logic).
One confirm tap for the default path. Adjust = optional expanders.

**Progress**: weight chart (existing LineChart restyled), goal progress, streak stats,
side-effect frequency.

**History**: reverse-chron list grouped by day, colored med dots, calendar collapses
into this tab (segmented control), not a separate tab.

**Profile**: meds management, reminders, units, goal, data export, disclaimer.

## Phases (each ends verifiable)

1. **Theme + primitives + onboarding.** New tokens, Button/Card/Text/Input/Sheet
   restyle, onboarding flow with gate. Verify: typecheck; web walkthrough of all steps;
   fresh-install lands in onboarding, completing it lands on Today, relaunch skips it.
2. **Core screens.** Today, log-shot, history+calendar merge, profile, tab bar.
   Verify: typecheck; web walkthrough: onboard → log shot → see it on Today/History.
3. **Extras.** Side effects, streaks, progress tab, reminders polish, app.json rename,
   icon/splash. Verify: full loop in iOS simulator.

Each phase: codex implements (gpt-5.6-sol, xhigh, workspace-write), Claude reviews the
diff, runs typecheck outside the sandbox, drives the UI, screenshots, critiques; codex
iterates until the phase predicate passes. Codex never commits; Claude commits per phase.
