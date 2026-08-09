export const colors = {
  background: '#FAFAF8',
  surface: '#FFFFFF',
  surfaceMuted: '#FAFAF8',
  surfaceInverse: '#111418',

  ink: '#111418',
  inkMuted: '#6B7280',
  inkSubtle: '#9AA1AA',
  inkInverse: '#FFFFFF',

  success: '#2FB47C',
  successDeep: '#2FB47C',
  successSoft: '#E7F6EF',

  warning: '#E8A13C',
  warningSoft: 'rgba(232,161,60,0.14)',

  danger: '#E5484D',
  dangerSoft: 'rgba(229,72,77,0.12)',

  border: 'rgba(17,20,24,0.08)',
  borderStrong: 'rgba(17,20,24,0.12)',
  divider: 'rgba(17,20,24,0.08)',
  dividerStrong: 'rgba(17,20,24,0.12)',

  chartLine: '#2FB47C',
  chartFill: 'rgba(47,180,124,0.10)',
  chartProjection: 'rgba(17,20,24,0.35)',
  chartGrid: 'rgba(17,20,24,0.08)',

  accent: '#2FB47C',
  accentSoft: '#E7F6EF',
  amber: '#E8A13C',
  violet: '#8B7BD8',
  blue: '#4A9FE8',
  cardShadow: '#111418',

  /**
   * One colour per medication, picked by `color_index`.
   *
   * The Americana purge replaced all six hues with the accent green, so every
   * medication drew the same dot and the calendar showed two shots on a day
   * without saying which two. A dot on a day cell carries no name, so this ramp
   * is the only thing that separates them.
   *
   * `amber` is weight and `violet` is a side effect everywhere else in the app,
   * so neither belongs here. A medication is an identity, not a kind of entry,
   * and one hue cannot mean both. Index 0 stays the accent, because one
   * medication is the common case and a shot is green.
   *
   * The order is the order `nextColorIndex` hands out. The closest pair sits
   * furthest apart in that order, so the sixth medication is the first one that
   * has to lean on lightness rather than hue.
   */
  med: ['#2FB47C', '#4A9FE8', '#D9639B', '#7A9E2E', '#5457C4', '#2A8F9E'] as const,
} as const;

export type Color = keyof typeof colors;
