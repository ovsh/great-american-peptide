import { TextStyle } from 'react-native';

export const fonts = {
  serif: 'Fraunces_600SemiBold',
  serifRegular: 'Fraunces_400Regular',
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansBold: 'Inter_700Bold',
} as const;

export const text = {
  display: {
    fontFamily: fonts.serif,
    fontSize: 40,
    lineHeight: 44,
  },
  h1: {
    fontFamily: fonts.serif,
    fontSize: 32,
    lineHeight: 38,
  },
  h2: {
    fontFamily: fonts.serif,
    fontSize: 24,
    lineHeight: 30,
  },
  h3: {
    fontFamily: fonts.serif,
    fontSize: 20,
    lineHeight: 26,
  },
  hero: {
    fontFamily: fonts.serif,
    fontSize: 36,
    lineHeight: 40,
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: 16,
    lineHeight: 22,
  },
  bodyStrong: {
    fontFamily: fonts.sansMedium,
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
    fontSize: 12,
    lineHeight: 16,
  },
  eyebrow: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
} satisfies Record<string, TextStyle>;

export type TextVariant = keyof typeof text;
