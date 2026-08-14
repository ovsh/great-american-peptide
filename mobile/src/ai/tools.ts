// The two tools the Ask Poke turn engine exposes, and their executors.
//
// The model parses language. It never does math: `reconstitution_calc` is a
// thin wrapper over `src/domain/reconstitution.ts`, the same function the
// calculator screen calls. Keep the wrapper thin. If a number looks wrong,
// the fix is here or in the caller, never in the domain module.

import { reconstitution, type ReconstitutionResult } from '../domain/reconstitution.ts';

export interface ToolDef {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    strict?: boolean;
  };
}

export type Disposition = 'answer' | 'clarify' | 'decline';

export const DISPOSITIONS: Disposition[] = ['answer', 'clarify', 'decline'];

/** The most text the model may put around the result card. */
export const FINAL_TEXT_MAX_LENGTH = 500;

export interface CalcArgs {
  materialMassMg: number;
  diluentMl: number;
  aliquotAmountMcg?: number;
}

export interface FinalAnswerArgs {
  disposition: Disposition;
  text: string;
  calcUsed: boolean;
}

// Strict schemas need every property listed in `required`, so the optional
// sample amount is expressed as a nullable number instead of an absent key.
export const RECONSTITUTION_CALC_TOOL: ToolDef = {
  type: 'function',
  function: {
    name: 'reconstitution_calc',
    description:
      'Compute the concentration of a reconstituted vial, and the volume of an optional sample amount. Call this once you have the material mass and the diluent volume. This is the only source of numbers.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        material_mass_mg: {
          type: 'number',
          description: 'Total research material in the vial, in mg, as the user stated it.',
        },
        diluent_ml: {
          type: 'number',
          description: 'Diluent volume added to the vial, in ml. 1 cc is 1 ml.',
        },
        aliquot_amount_mcg: {
          type: ['number', 'null'],
          description:
            'Optional sample amount, in mcg. Use null when the user named no sample amount. 1 mg is 1000 mcg.',
        },
      },
      required: ['material_mass_mg', 'diluent_ml', 'aliquot_amount_mcg'],
    },
  },
};

export const FINAL_ANSWER_TOOL: ToolDef = {
  type: 'function',
  function: {
    name: 'final_answer',
    description:
      'Deliver the turn. Call this exactly once. Use "answer" only when reconstitution_calc ran in this turn.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        disposition: {
          type: 'string',
          enum: DISPOSITIONS,
          description:
            '"answer" reports tool numbers, "clarify" asks exactly one question, "decline" refuses advice.',
        },
        text: {
          type: 'string',
          maxLength: FINAL_TEXT_MAX_LENGTH,
          description: 'The reply text. Every number in it must come from the tool result or the user.',
        },
        calc_used: {
          type: 'boolean',
          description: 'True when reconstitution_calc produced the numbers in this reply.',
        },
      },
      required: ['disposition', 'text', 'calc_used'],
    },
  },
};

export const ASK_POKE_TOOLS: ToolDef[] = [RECONSTITUTION_CALC_TOOL, FINAL_ANSWER_TOOL];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

/** Reads the tool arguments the model sent. Returns null when they are unusable. */
export function coerceCalcArgs(raw: unknown): CalcArgs | null {
  if (!isRecord(raw)) return null;
  const materialMassMg = finiteNumber(raw.material_mass_mg);
  const diluentMl = finiteNumber(raw.diluent_ml);
  if (materialMassMg === null || diluentMl === null) return null;
  const aliquotAmountMcg = finiteNumber(raw.aliquot_amount_mcg);
  return {
    materialMassMg,
    diluentMl,
    ...(aliquotAmountMcg === null ? {} : { aliquotAmountMcg }),
  };
}

export interface CalcRun {
  args: CalcArgs;
  result: ReconstitutionResult;
}

export type CalcOutcome =
  | { ok: true; run: CalcRun }
  | { ok: false; error: string };

/** Maps model arguments onto the domain function. The model never computes. */
export function runReconstitutionCalc(raw: unknown): CalcOutcome {
  const args = coerceCalcArgs(raw);
  if (!args) {
    return {
      ok: false,
      error: 'material_mass_mg and diluent_ml must both be numbers. Ask the user for the missing value.',
    };
  }
  const result = reconstitution(args);
  if (!result.valid) {
    return {
      ok: false,
      error: 'material_mass_mg and diluent_ml must both be more than zero. Ask the user for a usable value.',
    };
  }
  return { ok: true, run: { args, result } };
}

function coerceDisposition(value: unknown): Disposition | null {
  return value === 'answer' || value === 'clarify' || value === 'decline' ? value : null;
}

/** Reads the final_answer arguments. Returns null when they are unusable. */
export function coerceFinalAnswer(raw: unknown): FinalAnswerArgs | null {
  if (!isRecord(raw)) return null;
  const disposition = coerceDisposition(raw.disposition);
  if (disposition === null) return null;
  const text = typeof raw.text === 'string' ? raw.text.trim() : '';
  return {
    disposition,
    text: text.slice(0, FINAL_TEXT_MAX_LENGTH),
    calcUsed: raw.calc_used === true,
  };
}

/** The tool result the model reads back. Values only, no prose to copy. */
export function calcResultPayload(run: CalcRun): string {
  return JSON.stringify({
    concentration_mg_per_ml: run.result.concentrationMgPerMl,
    concentration_mcg_per_ml: run.result.concentrationMcgPerMl,
    total_material_mcg: run.result.totalMaterialMcg,
    aliquot_volume_ml: run.result.aliquotVolumeMl,
    warnings: run.result.warnings,
  });
}
