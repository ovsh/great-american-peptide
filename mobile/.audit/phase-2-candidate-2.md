# Candidate 2: Derived facts, thin screens

## Caller usage

Screens load authoritative rows, then derive immutable view models. Zustand only triggers reloads.

```ts
const [meds, injections, weights, effects, prefs] = await Promise.all([...]);
const today = buildTodayViewModel({ now: Date.now(), meds, injections, weights, effects, prefs });
return <TodayContent model={today} />;
```

```ts
const model = buildLogShotViewModel({ now: Date.now(), requestedMedicationId, meds, injections });
await createInjection(toNewInjection(model.draft));
bumpVersion();
```

```ts
const history = buildHistoryViewModel({ month, selectedDay, meds, injections });
if (today.kind !== 'ready') return <EmptyProgress />;
const progress = buildProgressViewModel({ now: Date.now(), range, heroId: today.hero.id, weights, effects, prefs, injections });
```

The tab layout uses Expo Router `Tabs` with a custom bar. The center button opens the existing `BottomSheet`; each row closes it and routes directly to one logger.

## Shape and signatures

```ts
type DayKey = string & { readonly __brand: 'DayKey' };
type ProgressRange = '7d' | '30d' | '90d';
interface TrackingRows { meds: readonly MedicationRow[]; injections: readonly InjectionRow[]; weights: readonly MeasurementRow[]; effects: readonly SideEffectLogRow[]; prefs: PreferencesRow }

type LevelValue = { kind: 'available'; value: number; unit: Unit } | { kind: 'unavailable' };
type ShotAction =
  | { kind: 'due'; scheduledAt: number }
  | { kind: 'logged'; takenAt: number; siteLabel: string | null }
  | { kind: 'upcoming' };

interface LevelBar { day: DayKey; label: string; level: number; ratio: number; isToday: boolean }
interface StreakSummary { current: number; best: number }
interface HeroMedicationViewModel {
  id: string; name: string; dose: number; unit: Unit; route: Route;
  color: string; level: LevelValue; bars: readonly LevelBar[];
  nextDoseAt: number; countdownDays: number; shotAction: ShotAction; streak: StreakSummary;
}
type WeightTile = { kind: 'empty'; unit: WeightUnit } | { kind: 'value'; value: number; unit: WeightUnit; series: readonly number[] };
type EffectTile = { kind: 'empty' } | { kind: 'value'; effect: SideEffectKind; severity: number; takenAt: number };
type TodayViewModel =
  | { kind: 'empty'; date: DayKey }
  | { kind: 'ready'; date: DayKey; hero: HeroMedicationViewModel; weight: WeightTile; effect: EffectTile };

interface HistoryRowViewModel { id: string; medicationName: string; color: string; dose: number; unit: Unit; takenAt: number; siteLabel: string | null }
interface HistoryDayViewModel { day: DayKey; label: string; rows: readonly HistoryRowViewModel[] }
interface CalendarDayViewModel { day: DayKey; dayNumber: number; inMonth: boolean; count: number; selected: boolean; today: boolean }
interface HistoryViewModel { groups: readonly HistoryDayViewModel[]; calendar: readonly CalendarDayViewModel[] }

type GoalProgress = { kind: 'empty' } | { kind: 'ready'; change: number; unit: WeightUnit; fraction: number };
interface ProgressViewModel { heroId: string; weights: WeightTile; goal: GoalProgress; streak: StreakSummary; effectCounts: ReadonlyMap<SideEffectKind, number> | null }

type SiteChoice =
  | { kind: 'suggested'; site: BodySite }
  | { kind: 'overridden'; site: BodySite }
  | { kind: 'none' };
interface LogShotDraft { medicationId: string; dose: number; site: SiteChoice; takenAt: number; scheduledAt: number | null; notes: string }
interface LogShotViewModel { medications: readonly MedicationRow[]; draft: LogShotDraft; detailsOpen: boolean }
interface SideEffectDraft { effect: SideEffectKind | null; severity: number; takenAt: number; notes: string }

function buildTodayViewModel(input: TrackingRows & { now: number }): TodayViewModel;
function buildHistoryViewModel(input: Pick<TrackingRows, 'meds' | 'injections'> & { month: Date; selectedDay: DayKey | null }): HistoryViewModel;
function buildProgressViewModel(input: TrackingRows & { now: number; range: ProgressRange; heroId: string }): ProgressViewModel;
function buildLogShotViewModel(input: Pick<TrackingRows, 'meds' | 'injections'> & { now: number; requestedMedicationId?: string }): LogShotViewModel;
function deriveIntervalStreak(takenAt: readonly number[], intervalHours: number, now: number): StreakSummary;
function sampleSevenDayLevels(doses: readonly DoseEvent[], halfLifeHours: number, tmaxHours: number, now: number): readonly LevelBar[];
function toNewInjection(draft: LogShotDraft): NewInjection;
```

`deriveIntervalStreak` collapses shots less than half an interval apart, continues a chain when the next shot is no later than 1.25 intervals, and resets current after the same grace period. This rule needs no weekday anchor. Seven-day bars sample the six prior local days plus today at noon and normalize against the largest sample.

Hero selection is deterministic. Prefer a scheduled injection completed today, otherwise choose the active medication with the earliest next dose. Log shot stores `scheduled_at` when it confirms a due dose, so the completed Today state survives reload without another cache.

## Module map

- `src/domain/tracking.ts` owns the types and pure builders above. It derives from database row types with `Pick` and has no React imports.
- `src/components/MonthGrid.tsx` owns the reusable calendar grid. `HistoryScreen` owns selected month, selected day, and List or Calendar mode.
- `app/(tabs)/_layout.tsx` becomes real `Tabs` plus a local log sheet. Delete `calendar.tsx` and `seal.tsx`.
- Today, Progress, History, and Log shot load repositories directly, build a model, render it, and call `bumpVersion()` after writes.
- `app/log-side-effect.tsx` uses `SideEffectDraft`, the existing `Stepper` for integer severity 0 to 10, and `createSideEffect`.
- `BodyDiagram` gains `suggestedId`, themed fills, named site buttons, and a positioned Suggested pill. The selected suggested site is saved unless the user overrides it.
- Phase 1 fixes stay at their existing owners. `Button` supplies its string label to accessibility. Onboarding screens change only local layout, placeholders, time input, weight echo, animation, and day-grid styles.
- Migrate report and remaining screen labels to `Text variant="caption"`, then delete `BrandSeal.tsx`, `MastHead.tsx`, `Eyebrow.tsx`, and their barrel exports.

## Rationale

One pure derivation module gives Today and Progress the same hero and streak facts without a second state cache, per boundary discipline. Discriminated unions encode empty, due, logged, and unavailable states, per type-system discipline. Real router tabs remove manual scene mounting and web history code, per laziness protocol. Durable `scheduled_at` preserves the completed state across reloads, per make-operations-idempotent.

## Synthesis decision

Placeholder for the arena synthesizer.

## Tradeoffs

- We accept one broad pure module in exchange for one source of truth and a two-file trace from repository rows to a screen.
- We accept a 25 percent streak grace window in exchange for an anchor-free rule that handles every frequency shape.
- We accept current-schedule streak recomputation in exchange for no schedule-history migration.

## Alternative considered

Keep the custom tab scene switcher and add Progress to its array. It loses because it keeps manual browser history, mounts hidden screens, and makes sheet ownership depend on non-router navigation.

## Risks

- A medication frequency change recalculates historical best streak under the new interval because the schema has no schedule history.
- `scheduled_at` is currently optional. All confirm-first due-dose submissions must populate it or Today cannot reconstruct the completed row.
- Local-day grouping and noon samples need DST-focused tests because timestamps remain absolute milliseconds.

## First implementation step

Fix the six Phase 1 findings, run `npx tsc --noEmit`, then replace the tab layout and add the four routed log-sheet rows.
