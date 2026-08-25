import type { GoalKind } from '../db/types';

/**
 * The words a screen uses to say a user's goal back to them.
 *
 * Two slots, because the two shapes a headline needs are not the same word.
 * `plan` is a noun that sits inside "your ___ plan". `pursuit` is the user's own
 * action and sits after "start". Nothing here is a claim: Poke tracks a plan and
 * sends a reminder, so a phrase may name what the user wants and may never say
 * Poke delivers it. "Your weight loss plan" is the user's plan for their goal.
 * "Poke helps you lose weight" would be a claim, and no phrase here builds one.
 */
export interface GoalFraming {
  /**
   * Reads inside "your ___ plan" and "your ___ goal". Short, and never an
   * adjective: "better sleep plan" reads as a promise, "sleep plan" does not.
   */
  plan: string;
  /** Reads after "start": "start losing weight", "start sleeping better". */
  pursuit: string;
}

/**
 * A phrase pair per goal, or null where Poke has nothing better than the
 * generic line.
 *
 * Keyed on the whole of `GoalKind` rather than on the six the goal screen
 * offers, because `performance` and `other` still arrive from rows an older
 * build wrote. `other` is null on purpose: it is the answer that says the goal
 * is none of the above, so there is no phrase to put in a headline, and the
 * caller falls back to the copy every user saw before.
 */
const GOAL_FRAMING: Record<GoalKind, GoalFraming | null> = {
  weight_loss: { plan: 'weight loss', pursuit: 'losing weight' },
  recovery: { plan: 'recovery', pursuit: 'working on recovery' },
  sleep: { plan: 'sleep', pursuit: 'sleeping better' },
  focus: { plan: 'focus', pursuit: 'working on focus' },
  healing: { plan: 'healing', pursuit: 'working on healing' },
  longevity: { plan: 'health', pursuit: 'working on your health' },
  performance: { plan: 'performance', pursuit: 'working on performance' },
  other: null,
};

/**
 * The goal a run of copy speaks in, out of every goal the user picked.
 *
 * The goal screen is a multi-select and it already tells the user that Poke
 * puts the first pick on the plan, so the first pick leads the copy too. A lead
 * that is `other`, or a tag no build knows, falls through to the next pick
 * rather than muting the whole run: somebody who picked "Other" and then
 * "Better sleep" still hears about sleep.
 */
export function leadGoal(tags: readonly GoalKind[] | null | undefined): GoalKind | null {
  if (!tags) return null;
  for (const tag of tags) {
    if (GOAL_FRAMING[tag]) return tag;
  }
  return null;
}

/**
 * The phrases for a run of copy, or null when there is nothing to say.
 *
 * Null is the whole contract for a caller: every string that reads a field of
 * the result has to hold the exact generic sentence for the null case, so a
 * user who skipped the goal question or who carries an unknown tag sees the
 * screen exactly as it read before.
 */
export function goalFraming(tags: readonly GoalKind[] | null | undefined): GoalFraming | null {
  const lead = leadGoal(tags);
  return lead ? GOAL_FRAMING[lead] : null;
}
