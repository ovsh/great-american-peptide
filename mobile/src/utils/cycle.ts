import type { MedicationRow } from '../db/types';
import { cycleState, type CycleState } from '../domain/cycle';

/**
 * The one place a medication row becomes a cycle state.
 *
 * `src/domain/cycle.ts` takes plain numbers and knows nothing about SQLite, so
 * this adapter carries the column names. Every screen that draws a cycle reads
 * it through here, because five screens each mapping four columns by hand is
 * five chances to pass `created_at` where the anchor belongs.
 */
export function cycleStateOf(medication: MedicationRow, now: number = Date.now()): CycleState {
  return cycleState(
    {
      status: medication.status,
      cycleDaysOn: medication.cycle_days_on,
      cycleDaysOff: medication.cycle_days_off,
      cycleStartedAt: medication.cycle_started_at,
      pausedAt: medication.paused_at,
      createdAt: medication.created_at,
    },
    now,
  );
}
