import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { ChoicePill } from '@/components/OnboardingScreen';
import { OnboardingStep } from '@/components/OnboardingStep';
import { Text } from '@/components/Text';
import { WeightPicker } from '@/components/WeightPicker';
import { formatWeight, kgToLb } from '@/domain/units';
import type { WeightUnit } from '@/domain/units';
import { importHealthWeights, isHealthSupported } from '@/services/health';
import type { HealthImport } from '@/services/health';
import { WEIGHT_BOUNDS, WEIGHT_REST, useOnboardingStore } from '@/stores/onboarding';
import { colors, spacing } from '@/theme';

const UNITS: readonly WeightUnit[] = ['lb', 'kg'];

/** What the last read of Apple Health did. Idle draws no message. */
type HealthAttempt = { kind: 'idle' } | { kind: 'reading' } | { kind: 'done'; message: string };

export default function WeightScreen() {
  const weight = useOnboardingStore((state) => state.weight);
  const setWeightUnit = useOnboardingStore((state) => state.setWeightUnit);
  const setWeightValue = useOnboardingStore((state) => state.setWeightValue);
  const [health, setHealth] = useState<HealthAttempt>({ kind: 'idle' });
  const [healthOpen, setHealthOpen] = useState(false);

  // The row under the band is the answer, so the store agrees with the wheel
  // from the first frame and Continue is live on arrival. Mount only: the skip
  // below clears the answer, and an effect that watched the value would write
  // the resting row straight back over the skip. `birthday` does the same.
  useEffect(() => {
    if (weight.current === null) setWeightValue('current', WEIGHT_REST[weight.unit]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const readHealth = async () => {
    setHealth({ kind: 'reading' });
    const result = await importHealthWeights();
    if (result.kind === 'imported') setWeightValue('current', wheelValue(result.latestKg, weight.unit));
    setHealth({ kind: 'done', message: healthMessage(result, weight.unit) });
  };

  return (
    <OnboardingStep
      step="weight"
      title="What do you weigh right now?"
      canContinue={weight.current !== null}
      secondary={{
        label: 'Skip this',
        onPress: (advance) => {
          setWeightValue('current', null);
          advance();
        },
      }}
    >
      <View style={styles.field}>
        <WeightPicker
          unit={weight.unit}
          value={weight.current}
          rest={WEIGHT_REST[weight.unit]}
          onChange={(value) => setWeightValue('current', value)}
          accessibilityLabel="Current weight"
        />
        <View style={styles.units}>
          {UNITS.map((unit) => (
            <ChoicePill
              key={unit}
              label={unit}
              selected={weight.unit === unit}
              onPress={() => setWeightUnit(unit)}
            />
          ))}
        </View>
        {/* A scale that writes to Apple Health already knows this number, so the
            wheel is the fallback and not the only way in. The offer sits under
            the wheel rather than on a screen of its own, because a permission
            reads as reasonable next to the work it saves.

            The offer is two presses and not one. Guideline 5.1.1(iv) says the
            button that raises the HealthKit prompt has to say "Continue", and
            the step already has a Continue of its own under the wheel, so the
            explanation and that word live in a sheet. The button here opens the
            sheet and reads nothing, which is what its label names. */}
        {isHealthSupported() ? (
          <View style={styles.health}>
            <Button
              variant="outline"
              size="sm"
              fullWidth={false}
              disabled={health.kind === 'reading'}
              onPress={() => setHealthOpen(true)}
            >
              {health.kind === 'reading' ? 'Reading Apple Health' : 'Use Apple Health'}
            </Button>
            {health.kind === 'done' ? (
              <Text variant="small" color={colors.inkMuted}>{health.message}</Text>
            ) : null}
            <BottomSheet
              visible={healthOpen}
              title="Apple Health"
              onClose={() => setHealthOpen(false)}
            >
              <View style={styles.sheet}>
                {/* The same three sentences Profile shows, and each one is
                    checkable in `services/health.ts`: the query names one type,
                    the permission asks to read and never to write, and nothing
                    on this path reaches the network. */}
                <Text color={colors.inkMuted}>
                  Poke reads your weight from Apple Health and adds it to your log. Poke reads nothing else. Poke writes nothing back and sends nothing anywhere.
                </Text>
                <Button
                  onPress={() => {
                    setHealthOpen(false);
                    void readHealth();
                  }}
                >
                  Continue
                </Button>
              </View>
            </BottomSheet>
          </View>
        ) : null}
      </View>
    </OnboardingStep>
  );
}

/**
 * A weight from Health as the wheel can hold it.
 *
 * The wheel holds one decimal place in the unit on screen, and Health always
 * hands over kilograms, so the value is converted and rounded the way the wheel
 * rounds. It is then held inside the wheel's own range: 273 kg is the top of the
 * kilogram wheel and converts to more pounds than the pound wheel offers.
 */
function wheelValue(kg: number, unit: WeightUnit): number {
  const bounds = WEIGHT_BOUNDS[unit];
  const converted = unit === 'kg' ? kg : kgToLb(kg);
  return Math.min(Math.max(Math.round(converted * 10) / 10, bounds.min), bounds.max);
}

/** The line under the button. Every outcome says what Poke did or did not get. */
function healthMessage(result: HealthImport, unit: WeightUnit): string {
  if (result.kind === 'unsupported') return 'Apple Health is not available on this device.';
  if (result.kind === 'failed') return 'Apple Health did not answer. Set the wheel by hand.';
  if (result.kind === 'empty') {
    return 'Poke found no weight in Apple Health. Check that Poke has access to weight in the Health app.';
  }

  const read = `Poke read ${formatWeight(wheelValue(result.latestKg, unit), unit)} from Apple Health.`;
  const earlier = result.added - 1;
  if (earlier < 1) return read;
  if (earlier === 1) return `${read} Poke also kept 1 earlier weigh-in.`;
  return `${read} Poke also kept ${earlier} earlier weigh-ins.`;
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.md,
  },
  units: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  health: {
    gap: spacing.sm,
  },
  sheet: {
    gap: spacing.md,
  },
});
