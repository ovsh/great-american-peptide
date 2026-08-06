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

  med: ['#2FB47C', '#2FB47C', '#2FB47C', '#2FB47C', '#2FB47C', '#2FB47C'] as const,
} as const;

export type Color = keyof typeof colors;
