import { chartHeightFor } from '@/components/chart-height';
import type { WeightUnit } from '@/domain/units';

/**
 * The journey axis, as numbers.
 *
 * Progress draws one x-axis for the whole run and hangs every layer off it: the
 * weight curve, one micro-lane per medication, and the side-effect marks above
 * them. The three metrics change only the band above the rail, so the rail, the
 * month labels and the log band under it sit at the same y in all three. That is
 * what makes it one screen rather than three, and it is why the layout is
 * computed once here rather than inside each band.
 */

export type ProgressMetric = 'weight' | 'shots' | 'effects';

export const PROGRESS_METRICS = [
  { id: 'weight', label: 'Weight' },
  { id: 'shots', label: 'Shots' },
  { id: 'effects', label: 'Effects' },
] as const satisfies readonly { id: ProgressMetric; label: string }[];

const DAY_MS = 24 * 60 * 60 * 1000;

export interface JourneyWeight {
  /** Days since day 0 of the journey. */
  day: number;
  value: number;
  takenAt: number;
}

export interface JourneyMedication {
  id: string;
  name: string;
  color: string;
  /** `Every Monday`, `Every 3 days`, or `No schedule`. */
  scheduleLabel: string;
  /** Day offsets of the shots the user logged. */
  shots: readonly number[];
  /** Day offsets of scheduled doses that closed with nothing logged against them. */
  missed: readonly number[];
  /** Day offsets of doses due today and not yet logged. */
  due: readonly number[];
}

export interface JourneyEffect {
  day: number;
  label: string;
  severity: number;
  takenAt: number;
}

export interface JourneyMonth {
  day: number;
  label: string;
}

/** Everything the Progress screen draws, in journey days rather than timestamps. */
export interface Journey {
  startMs: number;
  spanDays: number;
  /** `May 14` — the day the run began, for the header line. */
  sinceLabel: string;
  months: readonly JourneyMonth[];
  /** Used instead of month labels while the run is too short to name months. */
  edgeLabels: readonly [string, string] | null;
  weights: readonly JourneyWeight[];
  /** The weight the totals are measured from, in `unit`. */
  startWeight: number | null;
  goal: number | null;
  unit: WeightUnit;
  medications: readonly JourneyMedication[];
  effects: readonly JourneyEffect[];
  shotTotal: number;
  missedTotal: number;
  dueTotal: number;
  streakWeeks: number;
  weeksOnTime: number;
  /** When today's weight was logged, or null. Drives the log band's third face. */
  loggedWeightAt: number | null;
}

/**
 * The chart's fixed skeleton. Every metric draws inside it.
 *
 * `plotWithGoal` is the full plot: the goal line is its floor, so the curve and
 * the distance still to walk share one scale. With no goal there is no floor,
 * and the plot is only as tall as the run that exists — week one gets a short
 * card rather than a tall void.
 */
export const CHART = {
  padX: 20,
  plotT: 30,
  /** Side-effect marks, then the medication lanes, then the month labels. */
  effGap: 50,
  laneGap: 15,
  lanePitch: 6.5,
  tickH: 5,
  monthGap: 26,
  bottom: 6,
  plotWithGoal: 302,
  plotNoGoal: 200,
  plotFirstWeek: 122,
  /** Where the first medication row of the Shots band sits, and how tall a row is. */
  shotsTop: 46,
  shotsRow: 64,
  /** The single reading of week one, below the top of the plot. */
  firstReadingDrop: 26,
} as const;

export interface ChartLayout {
  width: number;
  height: number;
  plotL: number;
  plotR: number;
  plotT: number;
  plotH: number;
  /** The floor of the plot: the goal line, or the rule that waits for one. */
  goalY: number;
  effY: number;
  laneY: number;
  laneCount: number;
  monthY: number;
  /** The weight at `plotT` and the weight at `goalY`. */
  top: number;
  bottom: number;
  /** False when there is no range to draw in: one reading, or none. */
  hasScale: boolean;
}

export function buildLayout(journey: Journey, width: number): ChartLayout {
  const plotL = CHART.padX;
  const plotR = Math.max(plotL + 1, width - CHART.padX);
  const laneCount = journey.medications.length;
  const rows = Math.max(1, laneCount);

  const base = journey.goal !== null
    ? CHART.plotWithGoal
    : journey.weights.length >= 2 ? CHART.plotNoGoal : CHART.plotFirstWeek;
  // The Shots band is a list, and a list of six medications is taller than the
  // curve needs. The plot takes the height of the most demanding metric so the
  // rail below it never moves when the metric changes.
  const basePlot = Math.max(base, CHART.shotsTop + rows * CHART.shotsRow);

  // The rail under the plot is a fixed stack, so the chart's own height is the
  // one number a wide screen may move, and the plot takes whatever it gains.
  // The rail keeps its proportions and the log band under the card keeps its
  // place. On every phone width the clamp returns the natural height unchanged.
  const railH = CHART.effGap + CHART.laneGap + rows * CHART.lanePitch + CHART.monthGap + CHART.bottom;
  const naturalH = CHART.plotT + basePlot + railH;
  const height = chartHeightFor(width, naturalH);
  const plotH = basePlot + (height - naturalH);

  const goalY = CHART.plotT + plotH;
  const effY = goalY + CHART.effGap;
  const laneY = effY + CHART.laneGap;
  const monthY = laneY + rows * CHART.lanePitch + CHART.monthGap;

  const scale = weightScale(journey);

  return {
    width,
    height,
    plotL,
    plotR,
    plotT: CHART.plotT,
    plotH,
    goalY,
    effY,
    laneY,
    laneCount,
    monthY,
    top: scale.top,
    bottom: scale.bottom,
    hasScale: scale.hasScale,
  };
}

/**
 * The ends of the weight axis.
 *
 * With a goal on file the goal is one end of it, so the bracket between the last
 * reading and the goal is drawn to the same scale as the curve. Without one the
 * axis keeps a quarter of the range clear under the lowest reading, so the rule
 * that waits for a goal never sits on the line.
 */
function weightScale(journey: Journey): { top: number; bottom: number; hasScale: boolean } {
  const values = journey.weights.map((weight) => weight.value);
  if (values.length === 0) return { top: 1, bottom: 0, hasScale: false };

  const lowest = Math.min(...values);
  const highest = Math.max(...values);
  const top = journey.goal !== null ? Math.max(highest, journey.goal) : highest;
  const bottom = journey.goal !== null
    ? Math.min(lowest, journey.goal)
    : lowest - (highest - lowest) * 0.3;
  return { top, bottom, hasScale: top - bottom > 0 };
}

export function xFor(layout: ChartLayout, day: number, spanDays: number): number {
  const span = Math.max(1, spanDays);
  const clamped = Math.min(Math.max(day, 0), span);
  return layout.plotL + (clamped / span) * (layout.plotR - layout.plotL);
}

export function yFor(layout: ChartLayout, value: number): number {
  if (!layout.hasScale) return layout.plotT + CHART.firstReadingDrop;
  const ratio = (layout.top - value) / (layout.top - layout.bottom);
  return layout.plotT + Math.min(Math.max(ratio, 0), 1) * layout.plotH;
}

/** The top of one medication's lane, by its place in the user's own order. */
export function laneTop(layout: ChartLayout, index: number): number {
  return layout.laneY + index * CHART.lanePitch;
}

/** Whole days between two instants, counted on the calendar rather than in ms. */
export function dayDistance(from: number, to: number): number {
  const start = new Date(from);
  const end = new Date(to);
  return Math.round(
    (Date.UTC(end.getFullYear(), end.getMonth(), end.getDate())
      - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()))
    / DAY_MS,
  );
}

/**
 * An Inter string's width, near enough to place a label by.
 *
 * Only the Effects band needs it: its labels name themselves over their own dot
 * and step out of each other's way, and a measure pass would cost a frame with
 * every label stacked in the wrong place.
 */
export function textWidth(value: string, fontSize: number): number {
  return value.length * fontSize * 0.555;
}
