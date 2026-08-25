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

MeAgain's school: one question per screen, then a compute beat, then a "plan ready"
payoff that reads the user's own answers back. Poke copies the structure and the
rhythm. Poke does not copy the wall in front of the app. MeAgain's top complaint is
"no free trial", "can't track ANYTHING without membership". Poke puts the offer last,
after the reveal: `plan.tsx` replaces itself with `/paywall?source=onboarding_plan`,
and every exit from that screen lands on Today. The `✕` is visible and it works, the
yearly plan carries a free trial, and a user who closes the offer keeps shot logging,
the next shot, the full history and two medications. So the offer ends setup and does
not gate the app. Poke does not copy the in-onboarding rating ask either.
`src/services/reviewGate.ts` asks for a rating only after real logged use.

**This section describes the flow as built.** The source of truth is the flow block
in `src/stores/onboarding.ts`: `PRE_SCHEDULE_ORDER`, the setup-run helpers around
`SCHEDULE_STEP_OFFSET`, and `postScheduleOrder`. Read it before you trust the list
below. `docs/meagain-onboarding-map.md` holds the frame-by-frame map against the
recording, and `docs/meagain-onboarding-adaptation.md` names the constraint behind
every place Poke departs from it.

Up to 23 counted steps, one question each, a progress bar on top, Back always works.
Two answers shorten the run: the knowledge answer drops teach beats and the journey
answer drops last-shot, so an experienced user about to start sees 17.

- **Welcome** (`index`) — three auto-advancing slides ("See your level between
  shots.", "Poke does the syringe math.", "A plan that reminds you."), dots, one
  button, "Start my shot log", and the trust line "No account. Nothing leaves this
  phone." where MeAgain puts Sign In. Uncounted.
- **1 to 8** — `PRE_SCHEDULE_ORDER`: sex, birthday, goal (six goals, multi-select),
  knowledge, found, creator, journey, taking. Sex and birthday are skippable, and an
  untouched birthday wheel records nothing. A valid creator code grants Pro through
  the tester-code system. Taking is the multi-select picker over `src/domain/peptides`
  presets plus any number of custom names.
- **9 The setup run** (`setup/[index]/{vial,dose,frequency}`) — three questions per
  medication, all sharing one counted step, with a which-first ordering screen when
  the user picked more than one. Every question offers "Not sure yet. Set it up
  later.", and a deferred answer saves honestly and never blocks the finish. The run
  divides the step between its screens (`setupStepIndex`), so the bar never runs
  backwards at any medication count.
- **Mix beat** (`mix`) — uncounted, at most once, for the first medication whose vial
  size and mass dose allow the reconstitution sum. Water chips, the live U-100 draw,
  Save writes `medications.diluent_ml`, Skip writes nothing.
- **10 to 23** — `postScheduleOrder`: how-a-shot-works*, last-shot, why*, height,
  weight, goal-weight, pace, consistency*, rotation*, concerns, evidence*,
  reminder-time, notifications, thanks. The five marked \* are teach beats, not
  questions: `TEACH_BEATS` keeps all five for `new`, two for `basics`, none for
  `experienced`, and a skipped knowledge answer routes as `basics`. Last-shot drops
  when the journey answer is `starting`.
- **Compute** (`compute`) — a 13.8s beat over the answers already in the store. It
  claims no analysis it does not do. Uncounted.
- **Plan** (`plan`) — the payoff. Cards read back the schedule, the goal, the concerns,
  and the half-life with its citation. The projection card appears only when
  `planProjection` has a current weight, a goal weight and a pace, and it moves live
  with the pace slider. The disclaimer sits on this screen because the final button is
  the acceptance: `completeOnboarding` writes `disclaimer_accepted_at` alongside
  `onboarding_completed_at`. Then the button replaces the screen with the paywall
  (see above), and every exit from the paywall lands on Today.

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
