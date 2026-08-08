// The rating-prompt policy, with no React Native or Expo imports, so it can be tested
// directly with `npx tsx`. `review.ts` owns the StoreKit call and the database; this
// file owns the decision.

/** Short, and inside Apple's "at least a week or two" band. Poke has no ratings, so
 *  the three asks StoreKit allows are worth most in the first month. */
export const MIN_DAYS_BETWEEN_PROMPTS = 10;
/** Mirrors StoreKit's own limit, so a bug can never out-ask the system. */
export const MAX_PROMPTS_PER_YEAR = 3;

const DAY_MS = 24 * 60 * 60 * 1000;
export const YEAR_MS = 365 * DAY_MS;

/**
 * A moment where Poke has just given the user something. Each trigger fires once,
 * ever. Three asks from three different wins read as occasional. Three from one
 * trigger read as nagging, which is what the low-rated apps in this category do.
 */
export type ReviewTrigger =
  | 'calculation' // a reconstitution answer — the reason grey-market users come
  | 'shot-logged' // two shots is a routine, not a one-off
  | 'level-curve' // the paid hook, once it holds enough doses to be a curve
  | 'export' // their history, out, usually for a clinician
  | 'streak'; // four complete weeks on schedule

/** Shots that must already exist before the trigger may fire. */
export const MIN_SHOTS: Record<ReviewTrigger, number> = {
  calculation: 1,
  'shot-logged': 2,
  'level-curve': 3,
  export: 1,
  streak: 1,
};

export interface ReviewGateState {
  onboardingCompletedAt: number | null;
  shotCount: number;
  /** Comma-separated ms timestamps of past attempts. */
  promptLog: string | null;
  /** Comma-separated trigger names already used. */
  triggersUsed: string | null;
}

export function parseList(value: string | null): string[] {
  return (value ?? '').split(',').filter(Boolean);
}

export function recentStamps(promptLog: string | null, now: number): number[] {
  return parseList(promptLog)
    .map(Number)
    .filter((stamp) => Number.isFinite(stamp) && now - stamp < YEAR_MS);
}

/**
 * Whether we may ask now. Deliberately has no calendar floor: a gate on days since
 * install pushes the first ask past the moment it was earned. Value delivered is the
 * floor instead, which is also what the Human Interface Guidelines describe.
 */
export function canPrompt(state: ReviewGateState, trigger: ReviewTrigger, now: number): boolean {
  if (!state.onboardingCompletedAt) return false;
  if (state.shotCount < MIN_SHOTS[trigger]) return false;
  if (parseList(state.triggersUsed).includes(trigger)) return false;

  const recent = recentStamps(state.promptLog, now);
  if (recent.length >= MAX_PROMPTS_PER_YEAR) return false;
  if (recent.some((stamp) => now - stamp < MIN_DAYS_BETWEEN_PROMPTS * DAY_MS)) return false;

  return true;
}

/** Adds an attempt, dropping anything that has aged out of the rolling year. */
export function appendStamp(promptLog: string | null, now: number): string {
  const kept = parseList(promptLog).filter((s) => now - Number(s) < YEAR_MS);
  return [...kept, String(now)].join(',');
}

export function appendTrigger(triggersUsed: string | null, trigger: ReviewTrigger): string {
  return [...new Set([...parseList(triggersUsed), trigger])].join(',');
}
