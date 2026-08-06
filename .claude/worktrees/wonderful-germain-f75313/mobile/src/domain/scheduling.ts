import type { FrequencyKind } from './peptides';

export function frequencyHours(kind: FrequencyKind | string, value: number | null): number {
  switch (kind) {
    case 'daily': return 24;
    case 'weekly': return 24 * 7;
    case 'twice_weekly': return 24 * 3.5;
    case 'every_n_days': return 24 * (value ?? 1);
    default: return 24;
  }
}
