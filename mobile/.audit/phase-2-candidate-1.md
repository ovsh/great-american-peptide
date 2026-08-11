# Phase 2 candidate 1: thin screens, pure routines

## Problem

Phase 2 replaces the main navigation and screens without changing SQLite ownership. The hard part is keeping Today and Progress consistent while schedules have incomplete weekday anchors. This design keeps repository reads in screens, adds one pure routine projection to `src/domain/scheduling.ts`, and does not add a second cache.

## Caller usage

Today loads one snapshot and derives the complete screen model:

```ts
const [medications, injections, weights, effects, preferences] = await Promise.all([
  listMedications(), listInjections(), listMeasurements('weight'), listSideEffects(), getPreferences(),
]);
const model = buildTodayViewModel({ nowMs: Date.now(), medications, injections, weights, effects, preferences });
```

Progress uses the same hero routine and streak rule:

```ts
const routines = activeMeds.map((med) => deriveMedicationRoutine(toRoutineInput(med, injections), clock, nowMs));
const hero = selectHeroRoutine(routines);
const model = buildProgressViewModel({ hero, weights, effects, preferences, rangeDays });
```

Log shot accepts the suggested site by default; changing the medication recomputes the draft:

```ts
const draft = createShotDraft({ medications: activeMeds, injections, requestedMedicationId, nowMs });
await createInjection(toNewInjection(draft));
bumpVersion();
```

The tab layout uses Expo Router `Tabs` with a custom bar. Its center button owns one `BottomSheet`; each row closes the sheet and routes to `/log-shot`, `/log-weight`, `/log-side-effect`, or `/calculator`.

## Shape

```ts
// src/domain/scheduling.ts
export interface RoutineInput {
  medicationId: string; frequencyKind: FrequencyKind; frequencyValue: number | null; createdAt: number; takenAts: number[];
}
export type DoseState = 'overdue' | 'dueToday' | 'completedToday' | 'upcoming';
export interface IntervalStreak { current: number; best: number }
export interface MedicationRoutine {
  medicationId: string; intervalHours: number; lastTakenAt: number | null;
  nextDueAt: number; state: DoseState; streak: IntervalStreak;
}
export function parseReminderClock(value: string): { hour: number; minute: number } | null;
export function deriveMedicationRoutine(input: RoutineInput, clock: { hour: number; minute: number }, nowMs: number): MedicationRoutine;
export function deriveIntervalStreak(takenAts: number[], intervalHours: number, nowMs: number): IntervalStreak;
export function selectHeroRoutine(routines: MedicationRoutine[]): MedicationRoutine | null;
// app/(tabs)/index.tsx
export interface LevelBar { sampleAt: number; level: number; ratio: number; isToday: boolean }
export type TodayShotAction = { kind: 'log'; medicationId: string } | { kind: 'completed'; takenAt: number; siteLabel: string | null } | { kind: 'none' };
export interface TodayMedicationCard {
  medicationId: string; name: string; doseLabel: string; currentLevel: string | null;
  bars: LevelBar[]; countdown: string; action: TodayShotAction; streak: IntervalStreak;
}
export interface TodayViewModel { dateLabel: string; medication: TodayMedicationCard | null; weight: WeightTile; sideEffect: SideEffectTile }
export function buildTodayViewModel(input: TodaySource): TodayViewModel;

// app/log-shot/index.tsx
export type SiteChoice = { kind: 'suggested' | 'override'; siteId: string };
export interface ConfirmShotDraft {
  medicationId: string; dose: number; unit: Unit; route: Route; site: SiteChoice; takenAt: number; notes: string; detailsOpen: boolean;
}
export function createShotDraft(input: ShotDraftSource): ConfirmShotDraft;
export function toNewInjection(draft: ConfirmShotDraft): NewInjection;

// app/(tabs)/history.tsx and src/components/MonthGrid.tsx
export interface HistoryShotRow { id: string; dayKey: string; medicationName: string; color: string; doseLabel: string; timeLabel: string; siteLabel: string | null }
export interface HistoryDayGroup { dayKey: string; label: string; rows: HistoryShotRow[] }
export interface MonthGridDay { dayKey: string; dayNumber: number; isToday: boolean; colors: string[] }
export interface HistoryViewModel { groups: HistoryDayGroup[]; monthDays: MonthGridDay[]; selectedDayKey: string | null }

// app/(tabs)/progress.tsx
export type ProgressRangeDays = 7 | 30 | 90;
export interface GoalProgress { changeLabel: string; percent: number; current: number; goal: number }
export interface SideEffectSummary { total: number; topEffect: SideEffectKind }
export interface ProgressViewModel { points: { t: number; v: number }[]; goal: GoalProgress | null; streak: IntervalStreak | null; sideEffects: SideEffectSummary | null }
export function buildProgressViewModel(input: ProgressSource): ProgressViewModel;
```

The streak rule is fixed and anchor-free: sort shots, collapse shots less than half an interval apart, continue a run when the next gap is at most 1.5 intervals, and set current to zero when the latest shot is older than 1.5 intervals. Hero selection ranks due/overdue first, completed today second, then earliest upcoming. Seven level bars sample `estimatedLevelAt()` at the same local clock time for the prior six days and now.

## Module map

- Extend `src/domain/scheduling.ts` with routine, hero, and streak derivation.
- Keep PK sampling in `app/(tabs)/index.tsx`; it has one caller and uses `src/domain/pk.ts` unchanged.
- Keep Today, History, Progress, and shot draft view models beside their screens.
- Extract only the data-free month grid to `src/components/MonthGrid.tsx`.
- Add `app/log-side-effect.tsx`; validate an integer severity from 0 through 10 before `createSideEffect()`.
- Replace manual tab history with Expo Router `Tabs`; delete calendar and seal routes after migration.

## Synthesis decision

Candidate for synthesis. No other candidate has been evaluated in this file.

## Tradeoffs accepted

- We accept screen-local repository orchestration in exchange for no service layer and no duplicate cache.
- We accept one tolerant interval rule in exchange for consistent streaks when weekday anchors are absent or ambiguous.
- We accept loading all non-deleted injections for core projections in exchange for correct best streak and long-half-life level totals.

## Alternative considered

A shared `coreScreens` service that loads and caches all view models lost because it duplicates Zustand/SQLite state and makes invalidation harder to trace.

## Open questions and risks

- Can an unbounded injection read remain fast for the expected local data volume, or should repositories add a projection query later?
- Should an overdue medication outrank a different medication logged today? This design says yes.
- Will the 0-to-10 severity rule replace the migration comment that says 1-to-3?
- Profile unit changes must convert `start_weight` and `goal_weight` in the same `updatePreferences()` call.
- Reminder changes and shot logs must call `refreshScheduledReminders()`; web remains a documented no-op.

## First implementation step

Fix the six Phase 1 findings, run strict TypeScript, then replace the tab layout with the four routed tabs and shared log sheet.
