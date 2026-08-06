// Reconstitution calculator math.
//
// Standard inputs:
//  - peptideAmountMg: total peptide in vial (mg)
//  - waterMl:         bacteriostatic water added (mL)
//  - desiredDoseMcg:  per-shot dose (mcg)
//  - syringeUnits:    100 (U-100, standard insulin syringe) | 40 (U-40)
//
// Outputs:
//  - concentrationMgPerMl
//  - volumePerDoseMl
//  - syringeMarkUnits  (e.g. "draw to the 12.5 line")
//
// Best-practice notes encoded in `warnings`:
//  - Volume per dose > 1.0 mL → standard insulin syringe is 1mL; multi-shot needed
//  - Mark < 2 units → very small dose, accuracy concern
//  - Mark > 100 units → exceeds U-100 syringe capacity

export interface ReconstitutionInput {
  peptideAmountMg: number;
  waterMl: number;
  desiredDoseMcg: number;
  syringeUnits?: 100 | 40;
}

export interface ReconstitutionResult {
  concentrationMgPerMl: number;
  concentrationMcgPerMl: number;
  volumePerDoseMl: number;
  syringeMarkUnits: number;
  syringeUnits: 100 | 40;
  warnings: string[];
  valid: boolean;
}

export function reconstitution(input: ReconstitutionInput): ReconstitutionResult {
  const syringeUnits = input.syringeUnits ?? 100;
  const warnings: string[] = [];
  const valid =
    input.peptideAmountMg > 0 &&
    input.waterMl > 0 &&
    input.desiredDoseMcg > 0 &&
    Number.isFinite(input.peptideAmountMg) &&
    Number.isFinite(input.waterMl) &&
    Number.isFinite(input.desiredDoseMcg);

  if (!valid) {
    return {
      concentrationMgPerMl: 0,
      concentrationMcgPerMl: 0,
      volumePerDoseMl: 0,
      syringeMarkUnits: 0,
      syringeUnits,
      warnings,
      valid: false,
    };
  }

  const concentrationMgPerMl = input.peptideAmountMg / input.waterMl;
  const concentrationMcgPerMl = concentrationMgPerMl * 1000;
  const volumePerDoseMl = input.desiredDoseMcg / 1000 / concentrationMgPerMl;
  const syringeMarkUnits = volumePerDoseMl * syringeUnits;

  if (volumePerDoseMl > 1) {
    warnings.push('Dose volume exceeds 1 mL — won’t fit in a standard insulin syringe.');
  }
  if (syringeMarkUnits < 2 && syringeMarkUnits > 0) {
    warnings.push('Very small mark on the syringe — hard to measure accurately. Consider more BAC water.');
  }
  if (syringeMarkUnits > 100 && syringeUnits === 100) {
    warnings.push('Exceeds U-100 syringe capacity. Consider less BAC water.');
  }

  return {
    concentrationMgPerMl,
    concentrationMcgPerMl,
    volumePerDoseMl,
    syringeMarkUnits,
    syringeUnits,
    warnings,
    valid: true,
  };
}

export function formatUnits(units: number): string {
  if (!Number.isFinite(units)) return '—';
  if (units >= 10) return units.toFixed(1);
  return units.toFixed(2);
}
