import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { Input } from '@/components/Input';
import { ChoicePill } from '@/components/OnboardingScreen';
import { RouteChoice } from '@/components/RouteChoice';
import { SetupMissing, SetupStep, useSetupMedication } from '@/components/SetupStep';
import { Text } from '@/components/Text';
import type { Unit } from '@/domain/peptides';
import { scheduleHasDose, useOnboardingStore } from '@/stores/onboarding';
import { colors, spacing } from '@/theme';

const UNITS: readonly Unit[] = ['mg', 'mcg', 'iu'];

/**
 * The line Poke owes App Review, on the screen it is about.
 *
 * `store.config.json` `review.notes` says Poke records the dose the user enters
 * and never recommends, calculates or suggests one. This screen is where that
 * promise is kept, so it is also where the promise is printed.
 */
const NO_SUGGESTION = 'Poke never suggests a dose. Type the one you were given.';

/**
 * The dose, typed.
 *
 * The box opens empty and it stays empty. There is no placeholder number, no
 * chip carrying a dose and no preset value read in behind the user, because any
 * of the three would be Poke proposing a dose. The unit toggle and the route
 * are not doses, so they keep their defaults.
 */
export default function DoseScreen() {
  const params = useLocalSearchParams<{ index: string }>();
  const parsed = Number.parseInt(params.index ?? '0', 10);
  const index = Number.isFinite(parsed) ? parsed : 0;

  const setScheduleDose = useOnboardingStore((state) => state.setScheduleDose);
  const setScheduleUnit = useOnboardingStore((state) => state.setScheduleUnit);
  const setScheduleRoute = useOnboardingStore((state) => state.setScheduleRoute);
  const deferDose = useOnboardingStore((state) => state.deferDose);

  const setup = useSetupMedication(index);
  if (!setup) return <SetupMissing index={index} question="dose" />;

  const { medicationId, schedule, name, count, isCustom } = setup;

  return (
    <SetupStep
      index={index}
      count={count}
      question="dose"
      name={name}
      title="What dose did your clinician set?"
      canContinue={scheduleHasDose(schedule)}
      onDefer={() => deferDose(medicationId)}
    >
      <View style={styles.section}>
        <View style={styles.inlineRow}>
          <View style={styles.inputBox}>
            <Input
              size="lg"
              value={schedule.doseText}
              onChangeText={(text) => setScheduleDose(medicationId, text)}
              keyboardType="decimal-pad"
              style={styles.inputText}
              accessibilityLabel={`Dose for ${name}`}
            />
          </View>
          <View style={styles.units}>
            {UNITS.map((unit) => (
              <ChoicePill
                key={unit}
                label={unit}
                selected={schedule.unit === unit}
                onPress={() => setScheduleUnit(medicationId, unit)}
              />
            ))}
          </View>
        </View>
        <Text variant="small" color={colors.inkMuted}>
          {doseNote(schedule.doseText, schedule.unit)}
        </Text>
      </View>

      <Text variant="small" color={colors.inkMuted}>{NO_SUGGESTION}</Text>

      {/* The route sits with the dose because Poke writes the two together on
          the first shot it records. A preset already names its own route. */}
      {isCustom ? (
        <View style={styles.section}>
          <Text variant="smallStrong">Injection route</Text>
          <RouteChoice
            value={schedule.route}
            onChange={(route) => setScheduleRoute(medicationId, route)}
          />
        </View>
      ) : null}
    </SetupStep>
  );
}

/**
 * The typed dose read back, or the line that says the box is empty. It repeats
 * the number the user typed and never offers one.
 */
function doseNote(text: string, unit: Unit): string {
  const dose = Number.parseFloat(text);
  if (!Number.isFinite(dose) || dose <= 0) return 'Type the dose from your prescription.';
  return `Poke records ${dose} ${unit} a shot.`;
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  inputBox: {
    width: 128,
  },
  inputText: {
    textAlign: 'center',
  },
  units: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
