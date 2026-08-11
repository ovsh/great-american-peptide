// Sampled from reference/1.jpg and 2.jpg.
// Cream background, deep navy ink, crimson CTAs, muted olive-green status.

export const colors = {
  background: '#F2E9D8',
  surface: '#FFFFFF',
  surfaceMuted: '#FAF3E0',
  surfaceInverse: '#0F1B2D',

  ink: '#0F1B2D',
  inkMuted: '#6B7280',
  inkSubtle: '#9CA3AF',
  inkInverse: '#FFF8E7',

  navy: '#0F1B2D',
  navyDeep: '#080F1B',

  red: '#B0202E',
  redDeep: '#8B1623',
  redSoft: '#F2DDDF',

  gold: '#C9A961',
  goldDeep: '#9C7B33',

  success: '#5C8264',
  successDeep: '#3F6147',
  successSoft: '#DCE6D9',

  warning: '#C58A2E',
  warningSoft: '#F4E6CC',

  danger: '#B0202E',
  dangerSoft: '#F2DDDF',

  border: '#E5DDC8',
  borderStrong: '#C9BFA5',
  divider: 'rgba(15, 27, 45, 0.06)',
  dividerStrong: 'rgba(15, 27, 45, 0.12)',

  chartLine: '#0F1B2D',
  chartFill: 'rgba(15, 27, 45, 0.08)',
  chartProjection: 'rgba(15, 27, 45, 0.35)',
  chartGrid: 'rgba(15, 27, 45, 0.06)',

  med: ['#B0202E', '#0F1B2D', '#5C8264', '#C9A961', '#7B5EA7', '#2E7D8A'] as const,
} as const;

export type Color = keyof typeof colors;
