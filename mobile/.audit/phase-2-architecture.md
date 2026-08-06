# Phase 2 architecture

## Caller view

The tab layout declares four real routes and renders one shared `LogActionSheet` from its center button. Today, History, Progress, Profile, and each modal read repositories directly when `dataVersion` changes. A successful write calls `bumpVersion()` and closes the modal.

Today calls pure schedule functions with the hero medication and its injections. Log shot calls the rotation function with route-compatible history. History passes its month data into `MonthGrid`. No screen stores database rows in a new global cache.

## Core shapes

```ts
interface ScheduleStreak {
  current: number;
  best: number;
}

interface NextDoseInput {
  frequencyKind: FrequencyKind;
  frequencyValue: number | null;
  lastTakenAt: number | null;
  createdAt: number;
  reminderTime: string;
  now: number;
}

function nextDoseAt(input: NextDoseInput): number;
function deriveScheduleStreak(takenAt: readonly number[], intervalHours: number, now: number): ScheduleStreak;

type TodayDoseAction =
  | { kind: 'none' }
  | { kind: 'due'; medicationId: string }
  | { kind: 'logged'; injection: InjectionRow };

interface TodayDashboard {
  medication: MedicationRow | null;
  injections: InjectionRow[];
  estimatedLevel: number | null;
  sevenDayLevels: readonly number[];
  nextDoseAt: number | null;
  doseAction: TodayDoseAction;
  streak: ScheduleStreak;
  weight: MeasurementRow | null;
  weightSeries: readonly number[];
  sideEffect: SideEffectLogRow | null;
}

type HistoryMode = 'list' | 'calendar';

interface HistoryDay {
  key: string;
  label: string;
  injections: readonly InjectionRow[];
}

interface LogShotDraft {
  medicationId: string | null;
  dose: number;
  suggestedSiteId: string | null;
  selectedSiteId: string | null;
  takenAt: number;
  notes: string;
  detailsOpen: boolean;
}
```

The streak rule sorts shots from oldest to newest. A gap up to 1.5 times the configured interval continues a streak. A larger gap starts a new streak. The current streak becomes zero when the latest shot is more than 1.5 intervals old. This interval rule works for medication rows that do not have a complete weekday schedule.

## Module map

- `src/domain/scheduling.ts` owns due-time and streak derivation.
- `src/components/LogActionSheet.tsx` owns the four center-sheet actions.
- `src/components/MonthGrid.tsx` owns month navigation, day selection, and visible medication dots.
- `src/components/InlineTimePicker.tsx` owns the dependency-free reminder control.
- `src/components/BodyDiagram.tsx` accepts route and suggested-site props and keeps diagram geometry private.
- `app/(tabs)/*` owns route-local loading and display view models.
- `app/log-side-effect.tsx` owns the minimal 0 to 10 side-effect writer required by both entry points.

## Compared shapes

Candidate A kept loaders and view models in each route, sharing only pure domain logic and reusable controls. Candidate B added a `src/view-models` layer with async loaders for each route. Candidate C added a tab-level data context that cached medications, shots, measurements, preferences, and side effects.

## Synthesis decision

Candidate A is the base. It has the fewest ownership layers and matches the existing repository plus `dataVersion` pattern. It takes Candidate B's explicit view-model names and pure schedule signatures. It rejects Candidate B's async loader layer because each loader had one caller. It rejects Candidate C because a context cache would duplicate SQLite state and create invalidation rules that do not exist today.

## Tradeoffs accepted

- We accept a small amount of repeated repository loading in exchange for independent routes and no second cache.
- We accept an interval-based streak instead of weekday-perfect scoring because twice-weekly rows cannot store both weekdays.
- We accept a small Phase 2 side-effect screen in exchange for making both required entry points work.

## Risks

- The custom tab layout should move to Expo Router `Tabs` so browser history remains under the router.
- Weight chart scaling must stop using zero as its fixed lower bound or normal changes remain visually flat.
- Body diagram sites must filter by route before the suggested site becomes the default saved site.

## First implementation step

Fix the six Phase 1 review findings, then replace the tab shell so every following screen is reachable through the final route structure.
