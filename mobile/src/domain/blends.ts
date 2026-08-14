// The curve for a vial that holds more than one molecule.
//
// A blend preset carries no half-life, because its parts clear at different
// rates and no single number describes the vial. What Poke can draw honestly
// is the sum of the parts: the level model in `pk.ts` is linear in dose, so a
// 10 mg shot of a vial that is 30% BPC-157 lands 3 mg on the BPC-157 curve,
// and the blend's level at any moment is the sum of every part's level.
//
// Every number in that sum has an owner. The per-part half-lives come from the
// catalog, each with its stated basis, and the split between the parts comes
// from the composition the user copies off their own vial label. Poke proposes
// no composition and no ratio, so a blend with no composition entered draws no
// curve, exactly as any unsourced preset does.
//
// Pure, and tested with `npx tsx src/domain/blends.test.ts`.

import {
  getPreset,
  isBlend,
  type BlendPeptidePreset,
  type SourcedPeptidePreset,
} from './peptides';
import {
  estimatedLevelAt,
  suggestedLevelWindowHours,
  tmaxOrDefault,
  type DoseEvent,
} from './pk';

/**
 * One line of the vial label: a part of the blend and how many milligrams of
 * it the vial holds. The unit is always mg, because that is how blend labels
 * are written.
 */
export interface BlendComponent {
  presetId: string;
  mg: number;
}

/**
 * A part the curve can draw: the resolved preset with its sourced rate, and
 * the share of every logged dose that belongs to it.
 *
 * The fractions can sum to less than 1. A component whose preset carries no
 * half-life, or whose id is not a part of this blend, keeps its milligrams in
 * the denominator and draws nothing, so the curve under-draws the vial rather
 * than handing one part's mass to another.
 */
export interface BlendCurvePart {
  preset: SourcedPeptidePreset;
  fraction: number;
}

/**
 * Reads a composition off the `medications.composition` column. Null for
 * anything that is not a non-empty array of `{presetId, mg}` lines with
 * positive finite milligrams, so a hand-edited or half-written row reads as
 * "no composition entered" instead of throwing inside a chart.
 */
export function parseComposition(text: string | null | undefined): BlendComponent[] | null {
  if (!text) return null;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (!Array.isArray(value) || value.length === 0) return null;
  const components: BlendComponent[] = [];
  for (const line of value) {
    if (typeof line !== 'object' || line === null) return null;
    const { presetId, mg } = line as { presetId?: unknown; mg?: unknown };
    if (typeof presetId !== 'string' || presetId.length === 0) return null;
    if (typeof mg !== 'number' || !Number.isFinite(mg) || mg <= 0) return null;
    components.push({ presetId, mg });
  }
  return components;
}

/** The inverse of `parseComposition`, for the write side. */
export function serializeComposition(components: readonly BlendComponent[]): string {
  return JSON.stringify(components.map(({ presetId, mg }) => ({ presetId, mg })));
}

/**
 * The parts the curve draws, with the dose fraction each one owns.
 *
 * One rule decides what draws: a component draws only when its id is a part of
 * this blend and its preset carries a sourced half-life. Every entered
 * milligram counts toward the total either way, so a part the curve cannot
 * draw lowers the whole curve instead of silently inflating the parts it can.
 */
export function blendCurveParts(
  blend: BlendPeptidePreset,
  components: readonly BlendComponent[],
): BlendCurvePart[] {
  const totalMg = components.reduce(
    (sum, component) => sum + (Number.isFinite(component.mg) && component.mg > 0 ? component.mg : 0),
    0,
  );
  if (totalMg <= 0) return [];

  const parts: BlendCurvePart[] = [];
  for (const component of components) {
    if (!Number.isFinite(component.mg) || component.mg <= 0) continue;
    if (!blend.parts.includes(component.presetId)) continue;
    const preset = getPreset(component.presetId);
    if (!preset || isBlend(preset) || preset.evidence === 'unsourced') continue;
    parts.push({ preset, fraction: component.mg / totalMg });
  }
  return parts;
}

/**
 * The dose events one part sees: every logged shot of the blend, scaled to the
 * milligrams of this part inside it. Feed the result to any function in
 * `pk.ts` together with the part's own half-life and Tmax.
 */
export function partDoses(doses: readonly DoseEvent[], part: BlendCurvePart): DoseEvent[] {
  return doses.map((dose) => ({ takenAt: dose.takenAt, dose: dose.dose * part.fraction }));
}

/**
 * The blend's own level at one moment: the sum of every drawable part, each
 * falling at its own rate. Linearity in `pk.ts` is what makes the sum equal
 * the whole, so this is the one place the parts are added back together.
 */
export function blendLevelAt(
  parts: readonly BlendCurvePart[],
  doses: readonly DoseEvent[],
  atMs: number,
): number {
  let total = 0;
  for (const part of parts) {
    const halfLife = part.preset.halfLifeHours;
    total += estimatedLevelAt(
      partDoses(doses, part),
      halfLife,
      tmaxOrDefault(halfLife, part.preset.tmaxHours),
      atMs,
    );
  }
  return total;
}

/**
 * The half-life the chart window should be sized by: the slowest part, because
 * the chart has to hold the whole of the longest tail. Null when nothing
 * draws, which every window caller already treats as "use the default".
 */
export function slowestBlendHalfLifeHours(parts: readonly BlendCurvePart[]): number | null {
  if (parts.length === 0) return null;
  return Math.max(...parts.map((part) => part.preset.halfLifeHours));
}

/**
 * How wide the blend's chart should be: sized by the slowest part. No drawable
 * parts falls back to the same default window an unsourced preset gets.
 */
export function blendLevelWindowHours(parts: readonly BlendCurvePart[]): number {
  return suggestedLevelWindowHours(slowestBlendHalfLifeHours(parts));
}

/**
 * What the typed composition boxes hold, read as one fact.
 *
 * The vial section is skippable as a whole and only as a whole: a label copied
 * halfway is not a smaller label, it is a different vial, because every missing
 * part hands its milligrams to the parts that were typed. So `empty` saves
 * nothing, `complete` saves every line, and `partial` is the state both entry
 * screens refuse to save.
 */
export type CompositionDraft =
  | { kind: 'empty' }
  | { kind: 'partial' }
  | { kind: 'complete'; components: BlendComponent[] };

export function compositionDraft(
  partIds: readonly string[],
  texts: Readonly<Record<string, string>>,
): CompositionDraft {
  const components: BlendComponent[] = [];
  let blank = 0;
  for (const presetId of partIds) {
    const text = (texts[presetId] ?? '').trim();
    if (text === '') {
      blank += 1;
      continue;
    }
    const mg = Number.parseFloat(text);
    if (!Number.isFinite(mg) || mg <= 0) return { kind: 'partial' };
    components.push({ presetId, mg });
  }
  if (blank === partIds.length) return { kind: 'empty' };
  if (blank > 0) return { kind: 'partial' };
  return { kind: 'complete', components };
}
