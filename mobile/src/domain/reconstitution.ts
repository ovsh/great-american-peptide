// Reconstitution ratio math for research-use calculations.
//
// Standard inputs:
//  - materialMassMg:   total research material in vial (mg)
//  - diluentMl:        diluent volume added (mL)
//  - aliquotAmountMcg: optional target sample amount (mcg)
//
// Outputs:
//  - concentrationMgPerMl
//  - concentrationMcgPerMl
//  - aliquotVolumeMl
//
// Notes encoded in `warnings` stay limited to measurement quality.

export interface ReconstitutionInput {
  materialMassMg: number;
  diluentMl: number;
  aliquotAmountMcg?: number;
}

export interface ReconstitutionResult {
  concentrationMgPerMl: number;
  concentrationMcgPerMl: number;
  totalMaterialMcg: number;
  aliquotVolumeMl: number | null;
  warnings: string[];
  valid: boolean;
}

export function reconstitution(input: ReconstitutionInput): ReconstitutionResult {
  const warnings: string[] = [];
  const valid =
    input.materialMassMg > 0 &&
    input.diluentMl > 0 &&
    Number.isFinite(input.materialMassMg) &&
    Number.isFinite(input.diluentMl);

  if (!valid) {
    return {
      concentrationMgPerMl: 0,
      concentrationMcgPerMl: 0,
      totalMaterialMcg: 0,
      aliquotVolumeMl: null,
      warnings,
      valid: false,
    };
  }

  const concentrationMgPerMl = input.materialMassMg / input.diluentMl;
  const concentrationMcgPerMl = concentrationMgPerMl * 1000;
  const totalMaterialMcg = input.materialMassMg * 1000;
  const aliquotAmountMcg = input.aliquotAmountMcg ?? 0;
  const hasAliquot = aliquotAmountMcg > 0 && Number.isFinite(aliquotAmountMcg);
  const aliquotVolumeMl = hasAliquot ? aliquotAmountMcg / concentrationMcgPerMl : null;

  if (aliquotVolumeMl !== null && aliquotVolumeMl > input.diluentMl) {
    warnings.push('The aliquot volume is more than the prepared solution volume.');
  }
  if (aliquotVolumeMl !== null && aliquotVolumeMl > 0 && aliquotVolumeMl < 0.01) {
    warnings.push('The aliquot volume is very small. Check it with calibrated lab equipment.');
  }

  return {
    concentrationMgPerMl,
    concentrationMcgPerMl,
    totalMaterialMcg,
    aliquotVolumeMl,
    warnings,
    valid: true,
  };
}

export function formatMl(value: number): string {
  if (!Number.isFinite(value)) return '-';
  if (value < 0.01) return value.toFixed(4);
  if (value < 1) return value.toFixed(3);
  return value.toFixed(2);
}

export function formatMcg(value: number): string {
  if (!Number.isFinite(value)) return '-';
  return value.toFixed(0);
}
