export const SIDE_EFFECT_PRESETS = [
  { id: 'nausea', label: 'Nausea' },
  { id: 'fatigue', label: 'Fatigue' },
  { id: 'constipation', label: 'Constipation' },
  { id: 'headache', label: 'Headache' },
  { id: 'reflux', label: 'Reflux' },
  { id: 'injection_site', label: 'Injection-site reaction' },
  { id: 'appetite_loss', label: 'Appetite loss' },
  { id: 'dizziness', label: 'Dizziness' },
] as const;

export type SideEffectPresetId = (typeof SIDE_EFFECT_PRESETS)[number]['id'];

export type SideEffect =
  | { kind: 'preset'; id: SideEffectPresetId }
  | { kind: 'custom'; label: string };

const CUSTOM_PREFIX = 'custom:';
const MAX_CUSTOM_LENGTH = 60;

export function makeCustomSideEffect(value: string): SideEffect | null {
  const label = normalizeCustomLabel(value);
  return label ? { kind: 'custom', label } : null;
}

export function sideEffectStorageKey(effect: SideEffect): string {
  return effect.kind === 'preset'
    ? effect.id
    : `${CUSTOM_PREFIX}${encodeURIComponent(effect.label)}`;
}

export function parseStoredSideEffect(value: string): SideEffect {
  const preset = SIDE_EFFECT_PRESETS.find((option) => option.id === value);
  if (preset) return { kind: 'preset', id: preset.id };

  if (value.startsWith(CUSTOM_PREFIX)) {
    const encoded = value.slice(CUSTOM_PREFIX.length);
    try {
      const custom = makeCustomSideEffect(decodeURIComponent(encoded));
      if (custom) return custom;
    } catch {
      return { kind: 'custom', label: 'Other' };
    }
  }

  if (value === 'other') return { kind: 'custom', label: 'Other' };
  return makeCustomSideEffect(humanizeStoredValue(value)) ?? { kind: 'custom', label: 'Other' };
}

export function sideEffectLabel(effect: SideEffect): string {
  if (effect.kind === 'custom') return effect.label;
  return SIDE_EFFECT_PRESETS.find((option) => option.id === effect.id)?.label ?? 'Side effect';
}

export function sameSideEffect(left: SideEffect, right: SideEffect): boolean {
  return sideEffectStorageKey(left) === sideEffectStorageKey(right);
}

function normalizeCustomLabel(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, MAX_CUSTOM_LENGTH).trim();
}

function humanizeStoredValue(value: string): string {
  const words = value.trim().replace(/[_-]+/g, ' ');
  return words ? `${words.charAt(0).toLocaleUpperCase()}${words.slice(1)}` : '';
}
