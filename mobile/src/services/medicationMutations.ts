import type { MedicationRow } from '../db/types';
import {
  createMedication,
  resumeMedication,
  setMedicationStatus,
  updateMedicationDefaults,
  type MedicationDefaults,
  type NewMedication,
} from '../repositories/medications';
import { refreshScheduledReminders } from './notifications';

export async function createMedicationAndRefresh(input: NewMedication): Promise<MedicationRow> {
  const medication = await createMedication(input);
  await refreshScheduledReminders().catch(() => {});
  return medication;
}

export async function updateMedicationAndRefresh(
  id: string,
  input: MedicationDefaults,
): Promise<void> {
  await updateMedicationDefaults(id, input);
  await refreshScheduledReminders().catch(() => {});
}

export async function setMedicationStatusAndRefresh(
  id: string,
  status: MedicationRow['status'],
): Promise<void> {
  await setMedicationStatus(id, status);
  await refreshScheduledReminders().catch(() => {});
}

/**
 * The way back on, and the only one that restarts the cycle.
 *
 * Separate from `setMedicationStatusAndRefresh` because it moves the schedule
 * anchor as well as the status, and the queue has to be rebuilt around the new
 * anchor rather than around the one the pause left behind.
 */
export async function resumeMedicationAndRefresh(id: string): Promise<void> {
  await resumeMedication(id);
  await refreshScheduledReminders().catch(() => {});
}
