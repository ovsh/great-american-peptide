export type WeightUnit = 'lb' | 'kg';
export type HeightUnit = 'in' | 'cm';

const LB_PER_KG = 2.20462;

export function lbToKg(lb: number): number { return lb / LB_PER_KG; }
export function kgToLb(kg: number): number { return kg * LB_PER_KG; }
export function inToCm(inches: number): number { return inches * 2.54; }
export function cmToIn(cm: number): number { return cm / 2.54; }

export function bmi(weight: number, weightUnit: WeightUnit, height: number, heightUnit: HeightUnit): number {
  const kg = weightUnit === 'kg' ? weight : lbToKg(weight);
  const m = heightUnit === 'cm' ? height / 100 : (height * 2.54) / 100;
  if (m <= 0) return 0;
  return kg / (m * m);
}

export function bmiCategory(value: number): 'Underweight' | 'Healthy' | 'Overweight' | 'Obese' {
  if (value < 18.5) return 'Underweight';
  if (value < 25) return 'Healthy';
  if (value < 30) return 'Overweight';
  return 'Obese';
}

export function formatWeight(value: number, unit: WeightUnit): string {
  return `${value.toFixed(1)} ${unit === 'lb' ? 'lbs' : 'kg'}`;
}

export function formatDose(value: number, unit: 'mg' | 'mcg' | 'iu'): string {
  if (unit === 'mg') return `${value.toFixed(value < 1 ? 2 : 1)} mg`;
  if (unit === 'mcg') return `${Math.round(value)} mcg`;
  return `${value} IU`;
}
