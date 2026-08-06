import * as React from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import { Text } from './Text';
import { colors, radius, spacing } from '../theme';

type PillTone = 'success' | 'warning' | 'danger' | 'neutral' | 'brand';

interface PillProps {
  children: React.ReactNode;
  tone?: PillTone;
  style?: ViewStyle;
}

const TONE: Record<PillTone, { bg: string; fg: string }> = {
  success: { bg: colors.successSoft, fg: colors.successDeep },
  warning: { bg: colors.warningSoft, fg: '#7A5616' },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  neutral: { bg: colors.surfaceMuted, fg: colors.inkMuted },
  brand: { bg: colors.surfaceInverse, fg: colors.inkInverse },
};

export function Pill({ children, tone = 'neutral', style }: PillProps) {
  const t = TONE[tone];
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }, style]}>
      <Text variant="caption" color={t.fg}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingVertical: 4,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
});
