import type { TextStyle } from 'react-native';

export const fonts = {
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemiBold: 'Inter_600SemiBold',
  sansBold: 'Inter_700Bold',
} as const;

export const text = {
  display: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 28,
    lineHeight: 34,
  },
  h1: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 28,
    lineHeight: 34,
  },
  h2: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 20,
    lineHeight: 26,
  },
  h3: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 20,
    lineHeight: 26,
  },
  hero: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 28,
    lineHeight: 34,
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: 16,
    lineHeight: 22,
  },
  bodyStrong: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    lineHeight: 22,
  },
  small: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 18,
  },
  smallStrong: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    lineHeight: 18,
  },
  caption: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    lineHeight: 18,
  },
} satisfies Record<string, TextStyle>;

export type TextVariant = keyof typeof text;
