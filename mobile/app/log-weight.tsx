import { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Check, X } from 'lucide-react-native';

import { Header } from '@/components/Header';
import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { Field } from '@/components/Field';
import { TimeRangeToggle } from '@/components/TimeRangeToggle';

import { createMeasurement, latestMeasurement } from '@/repositories/measurements';
import { getPreferences, updatePreferences } from '@/repositories/preferences';
import type { PreferencesRow } from '@/db/types';
import { useAppStore } from '@/stores/app';
import { colors, spacing } from '@/theme';
import { fmtDateTime } from '@/utils/date';
import { safeBack } from '@/utils/nav';
import { kgToLb, lbToKg, type WeightUnit } from '@/domain/units';

export default function LogWeightScreen() {
  const bumpVersion = useAppStore((s) => s.bumpVersion);
  const [value, setValue] = useState('');
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
      if (last) setValue(last.value.toFixed(1));
    })();
  }, []);

  const onSave = async () => {
    const v = parseFloat(value);
    if (!Number.isFinite(v) || v <= 0) {
      Alert.alert('Enter a weight above zero'); return;
    }
    setSubmitting(true);
    try {
      await createMeasurement({ kind: 'weight', value: v, unit, takenAt: Date.now() });
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
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Header
        title="Log weight"
        leading={
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => safeBack('/')} hitSlop={10} style={styles.iconBtn}>
            <X size={22} color={colors.ink} />
          </Pressable>
        }
        trailing={
          <Pressable accessibilityRole="button" accessibilityLabel="Save weight" onPress={onSave} hitSlop={10} disabled={submitting}>
            <Check size={22} color={colors.accent} />
          </Pressable>
        }
      />
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.hero, paddingHorizontal: spacing.screen }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <Card padding="lg">
          <Text variant="smallStrong" color={colors.inkMuted}>Now</Text>
          <Text variant="caption" color={colors.inkMuted} style={{ marginTop: 2 }}>{fmtDateTime(Date.now())}</Text>
        </Card>
        <View style={{ height: spacing.lg }} />

        <Field label="Weight">
          <View style={styles.row}>
            <TextInput
              value={value}
              onChangeText={setValue}
              keyboardType="decimal-pad"
              placeholder="0.0"
              placeholderTextColor={colors.inkSubtle}
              style={styles.numInput}
              autoFocus
            />
            <View style={{ width: spacing.md }} />
            <TimeRangeToggle
              options={['lb', 'kg'] as const}
              value={unit}
              onChange={setUnit}
            />
          </View>
        </Field>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  row: { flexDirection: 'row', alignItems: 'center' },
  numInput: {
    flex: 1,
    fontFamily: 'Inter_500Medium',
    fontSize: 32,
    color: colors.ink,
    paddingVertical: spacing.xs,
  },
});

function convertWeight(value: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return value;
  return from === 'kg' ? kgToLb(value) : lbToKg(value);
}
