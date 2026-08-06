import type { MedicationRow } from '../db/types';
import {
  createMedication,
  setMedicationStatus,
  updateMedicationDefaults,
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
  input: Omit<NewMedication, 'colorIndex'>,
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
