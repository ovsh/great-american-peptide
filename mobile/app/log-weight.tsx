import { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import { Check, X } from 'lucide-react-native';

import { Header } from '@/components/Header';
import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { Field } from '@/components/Field';
import { TimeRangeToggle } from '@/components/TimeRangeToggle';
import { WeightPicker } from '@/components/WeightPicker';

import { createMeasurement, latestMeasurement } from '@/repositories/measurements';
import { getPreferences, updatePreferences } from '@/repositories/preferences';
import type { PreferencesRow } from '@/db/types';
import { track } from '@/services/analytics';
import { useAppStore } from '@/stores/app';
import { WEIGHT_BOUNDS, WEIGHT_REST } from '@/stores/onboarding';
import { colors, spacing } from '@/theme';
import { fmtDateTime } from '@/utils/date';
import { safeBack } from '@/utils/nav';
import { kgToLb, lbToKg, type WeightUnit } from '@/domain/units';

export default function LogWeightScreen() {
  const bumpVersion = useAppStore((s) => s.bumpVersion);
  // The weight in `unit`, or null before anything answers. A wheel always shows
  // a row, so the value and the row under the band are two different things.
  const [value, setValue] = useState<number | null>(null);
  const [unit, setUnit] = useState<WeightUnit>('lb');
  const [preferences, setPreferences] = useState<PreferencesRow | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const [prefs, last] = await Promise.all([
        getPreferences(),
        latestMeasurement('weight'),
      ]);
      setUnit(prefs.weight_unit);
      setPreferences(prefs);
      // Each measurement row carries the unit it was written in. The preference can
      // differ from it, so convert before the number reaches the wheel.
      if (last) {
        const shown = convertWeight(last.value, rowWeightUnit(last.unit, prefs.weight_unit), prefs.weight_unit);
        setValue(onWheel(shown, prefs.weight_unit));
      }
    })();
  }, []);

  // The toggle changes the unit of the number on screen, so the number changes with it.
  const changeUnit = (next: WeightUnit) => {
    if (next === unit) return;
    if (value !== null) setValue(onWheel(convertWeight(value, unit, next), next));
    setUnit(next);
  };

  const onSave = async () => {
    // The wheel cannot make a number outside its ends, so the only thing to
    // catch is a first weight nobody has set yet.
    if (value === null) {
      Alert.alert('Set the wheel to your weight'); return;
    }
    setSubmitting(true);
    try {
      await createMeasurement({ kind: 'weight', value, unit, takenAt: Date.now() });
      // The number itself never travels.
      track('weight_logged', { source: 'manual' });
      // remember unit preference
      await updatePreferences({
        weight_unit: unit,
        start_weight: preferences?.start_weight === null || preferences?.start_weight === undefined
          ? null
          : convertWeight(preferences.start_weight, preferences.weight_unit, unit),
        goal_weight: preferences?.goal_weight === null || preferences?.goal_weight === undefined
          ? null
          : convertWeight(preferences.goal_weight, preferences.weight_unit, unit),
      });
      bumpVersion();
      safeBack('/');
    } catch (error: unknown) {
      Alert.alert('Poke could not save your weight', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header
        title="Log weight"
        leading={
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => safeBack('/')} hitSlop={10} style={styles.iconBtn}>
            <X size={22} color={colors.ink} />
          </Pressable>
        }
        trailing={
          <Pressable accessibilityRole="button" accessibilityLabel="Save weight" onPress={onSave} hitSlop={10} disabled={submitting}>
            <Check size={22} color={value === null ? colors.inkSubtle : colors.accent} />
          </Pressable>
        }
      />
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.hero, paddingHorizontal: spacing.screen }}
      >
        <Card padding="lg">
          <Text variant="smallStrong" color={colors.inkMuted}>Now</Text>
          <Text variant="caption" color={colors.inkMuted} style={{ marginTop: 2 }}>{fmtDateTime(Date.now())}</Text>
        </Card>
        <View style={{ height: spacing.lg }} />

        <Field label="Weight">
          {/* The same wheel setup uses, so a weight lands on a row the wheel can
              show and the number needs no keyboard to correct. */}
          <WeightPicker
            unit={unit}
            value={value}
            rest={WEIGHT_REST[unit]}
            onChange={setValue}
            accessibilityLabel="Weight"
          />
          <View style={{ height: spacing.md }} />
          <TimeRangeToggle
            options={['lb', 'kg'] as const}
            value={unit}
            onChange={changeUnit}
          />
        </Field>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
});

function convertWeight(value: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return value;
  return from === 'kg' ? kgToLb(value) : lbToKg(value);
}

/**
 * The nearest weight the wheel can show: one decimal place, inside the wheel's
 * ends. A stored row comes from a scale rather than from this wheel, so it can
 * hold a number with no row under it, and a number with no row is a number the
 * user cannot correct.
 */
function onWheel(value: number, unit: WeightUnit): number {
  const bounds = WEIGHT_BOUNDS[unit];
  return Math.min(bounds.max, Math.max(bounds.min, Math.round(value * 10) / 10));
}

// A measurement row stores its own unit as free text. A row written before the
// column existed holds null, so read it as the unit the user reads today.
function rowWeightUnit(stored: string | null, fallback: WeightUnit): WeightUnit {
  return stored === 'kg' || stored === 'lb' ? stored : fallback;
}
