import { View, StyleSheet } from 'react-native';
import { Text } from './Text';
import { colors, spacing } from '../theme';

interface TitleBlockProps {
  title: string;
  rightLabel?: string;
  variant?: 'editorial' | 'page';
}

export function TitleBlock({ title, rightLabel, variant = 'page' }: TitleBlockProps) {
  if (variant === 'editorial') {
    return (
      <View style={styles.wrap}>
        <View style={styles.row}>
          <Text variant="display">{title}</Text>
          {rightLabel ? (
            <Text variant="caption" color={colors.inkMuted}>{rightLabel}</Text>
          ) : null}
        </View>
        <View style={styles.underlines}>
          <View style={[styles.bar, { backgroundColor: colors.accent, width: 24 }]} />
          <View style={[styles.bar, { backgroundColor: colors.ink, width: 64 }]} />
        </View>
      </View>
    );
  }
  return (
    <View style={styles.wrap}>
      <View style={styles.pageRow}>
        <Text variant="hero">{title}</Text>
        {rightLabel ? (
          <Text variant="caption" color={colors.inkMuted}>{rightLabel}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.xs,
    paddingBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  pageRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  underlines: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    gap: 4,
  },
  bar: {
    height: 2,
    borderRadius: 1,
  },
});
