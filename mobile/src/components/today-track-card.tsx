import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { ChevronRight, Scale, Smile } from 'lucide-react-native';

import { Text } from '@/components/Text';
import { PressScale } from '@/components/today-motion';
import type { MeasurementRow } from '@/db/types';
import { sideEffectLabel } from '@/domain/sideEffects';
import { kgToLb, lbToKg, type WeightUnit } from '@/domain/units';
import type { SideEffectLog } from '@/repositories/sideEffects';
import { colors, elevation, fonts, radius, spacing } from '@/theme';

/**
 * The two things Today tracks that are not a shot. Flat rows: the value sits on
 * the same line as the label, because a two-line row for one number reads as
 * more than it is.
 */
export function TodayTrackCard({
  weight,
  weightUnit,
  sideEffect,
}: {
  weight: MeasurementRow | null;
  weightUnit: WeightUnit;
  sideEffect: SideEffectLog | null;
}) {
  const weightValue = weight
    ? `${convertWeight(weight.value, weight.unit, weightUnit).toFixed(1)} ${weightUnit}`
    : 'Not logged';
  const sideEffectValue = sideEffect
    ? `${sideEffectLabel(sideEffect.effect)}, ${sideEffect.severity} of 10`
    : 'None logged';

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Track today</Text>

      <PressScale>
        {(handlers) => (
          <Pressable
            testID="today-weight-row"
            accessibilityRole="button"
            accessibilityLabel={`Log weight. ${weightValue}`}
            onPress={() => router.push('/log-weight')}
            style={styles.row}
            {...handlers}
          >
            <View style={[styles.icon, styles.weightIcon]}>
              <Scale size={18} color={colors.amber} />
            </View>
            <View style={styles.copy}>
              <Text style={styles.label}>Weight</Text>
              <Text style={styles.value} color={colors.inkMuted} numberOfLines={1}>
                {weightValue}
              </Text>
            </View>
            <ChevronRight size={17} color={colors.inkSubtle} />
          </Pressable>
        )}
      </PressScale>

      <View style={styles.divider} />

      <PressScale>
        {(handlers) => (
          <Pressable
            testID="today-side-effect-row"
            accessibilityRole="button"
            accessibilityLabel={`Log side effect. ${sideEffectValue}`}
            onPress={() => router.push('/log-side-effect')}
            style={styles.row}
            {...handlers}
          >
            <View style={[styles.icon, styles.sideEffectIcon]}>
              <Smile size={18} color={colors.violet} />
            </View>
            <View style={styles.copy}>
              <Text style={styles.label}>Side effects</Text>
              <Text style={styles.value} color={colors.inkMuted} numberOfLines={1}>
                {sideEffectValue}
              </Text>
            </View>
            <ChevronRight size={17} color={colors.inkSubtle} />
          </Pressable>
        )}
      </PressScale>
    </View>
  );
}

function convertWeight(value: number, fromUnit: string | null, toUnit: WeightUnit): number {
  if (fromUnit === 'kg' && toUnit === 'lb') return kgToLb(value);
  if (fromUnit === 'lb' && toUnit === 'kg') return lbToKg(value);
  return value;
}

const ICON_SIZE = 36;

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    ...elevation.card,
  },
  title: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.17,
    color: colors.ink,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  row: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xs,
  },
  icon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  weightIcon: {
    backgroundColor: colors.warningSoft,
  },
  sideEffectIcon: {
    backgroundColor: 'rgba(139,123,216,0.12)',
  },
  copy: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
  },
  value: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing.xl + ICON_SIZE + spacing.md,
    backgroundColor: colors.divider,
  },
});
