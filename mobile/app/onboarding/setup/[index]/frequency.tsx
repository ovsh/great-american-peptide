import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { Input } from '@/components/Input';
import { ChoicePill } from '@/components/OnboardingScreen';
import { SetupMissing, SetupStep, useSetupMedication } from '@/components/SetupStep';
import { ShotDayStrip } from '@/components/ShotDayStrip';
import { Text } from '@/components/Text';
import { weekdayListLabel, type Weekday } from '@/domain/scheduling';
import {
  scheduleHasFrequency,
  useOnboardingStore,
  type OnboardingFrequency,
} from '@/stores/onboarding';
import { twiceWeeklyWeekdays } from '@/utils/schedule';
import { colors, spacing } from '@/theme';

// Five, in plain words. Three of them left a user on an every-three-days
// protocol, or on a fixed Monday, Wednesday and Friday, with nothing true to
// press. "Every few days" is the phrase people use for the first; the row under
// the chip asks for the number.
const FREQUENCIES: readonly { id: OnboardingFrequency; label: string }[] = [
  { id: 'weekly', label: 'Once a week' },
  { id: 'twice_weekly', label: 'Twice a week' },
  { id: 'daily', label: 'Every day' },
  { id: 'every_n_days', label: 'Every few days' },
  { id: 'weekdays', label: 'Same days each week' },
];

/**
 * The last question about one medication: how often the shot lands.
 *
 * A frequency is a schedule and not a dose, so chips are safe. The two kinds
 * that carry a number ask for it under the chip, and Continue waits for it,
 * because a schedule Poke filled in is a schedule that sends reminders nobody
 * asked for.
 */
export default function FrequencyScreen() {
  const params = useLocalSearchParams<{ index: string }>();
  const parsed = Number.parseInt(params.index ?? '0', 10);
  const index = Number.isFinite(parsed) ? parsed : 0;

  const setScheduleFrequency = useOnboardingStore((state) => state.setScheduleFrequency);
  const setShotDay = useOnboardingStore((state) => state.setShotDay);
  const setScheduleInterval = useOnboardingStore((state) => state.setScheduleInterval);
  const toggleScheduleWeekday = useOnboardingStore((state) => state.toggleScheduleWeekday);
  const deferFrequency = useOnboardingStore((state) => state.deferFrequency);

  const setup = useSetupMedication(index);
  if (!setup) return <SetupMissing index={index} question="frequency" />;

  const { medicationId, schedule, name, count } = setup;
  const kind = schedule.deferredFrequency ? null : schedule.frequencyKind;
  // Twice a week lands on a second day the user never picked, and the domain
  // owns which one. The strip asks for the whole week rather than restating the
  // rule, so a change to the rule reaches this screen without an edit.
  const shotDays = kind === 'twice_weekly' ? twiceWeeklyWeekdays(schedule.shotDay) : [schedule.shotDay];
  const isLast = index >= count - 1;

  return (
    <SetupStep
      index={index}
      count={count}
      question="frequency"
      name={name}
      title="How often do you take it?"
      canContinue={scheduleHasFrequency(schedule)}
      continueLabel={isLast ? 'Continue' : 'Next medication'}
      onDefer={() => deferFrequency(medicationId)}
    >
      <View style={styles.wrapRow}>
        {FREQUENCIES.map((frequency) => (
          <ChoicePill
            key={frequency.id}
            label={frequency.label}
            selected={kind === frequency.id}
            onPress={() => setScheduleFrequency(medicationId, frequency.id)}
          />
        ))}
      </View>

      {kind === 'weekly' || kind === 'twice_weekly' ? (
        <View style={styles.section}>
          <Text variant="smallStrong">{kind === 'twice_weekly' ? 'Shot days' : 'Next shot day'}</Text>
          <ShotDayStrip
            days={shotDays}
            onPick={(day) => setShotDay(medicationId, day)}
            accessibilityLabel={`Shot days for ${name}`}
          />
        </View>
      ) : null}

      {/* The number sits inside the sentence it belongs to, and the line under
          it reads the sentence back. An empty box says it is empty rather than
          showing an interval nobody chose. */}
      {kind === 'every_n_days' ? (
        <View style={styles.section}>
          <Text variant="smallStrong">How many days apart?</Text>
          <View style={styles.inlineRow}>
            <Text variant="small" color={colors.inkMuted}>Poke expects a shot every</Text>
            <View style={styles.inputBox}>
              <Input
                value={schedule.intervalText}
                onChangeText={(text) => setScheduleInterval(medicationId, text)}
                keyboardType="number-pad"
                style={styles.inputText}
                accessibilityLabel={`Days between shots for ${name}`}
              />
            </View>
            <Text variant="small" color={colors.inkMuted}>days</Text>
          </View>
          <Text variant="small" color={colors.inkMuted}>{intervalNote(schedule.intervalText)}</Text>
        </View>
      ) : null}

      {/* The same strip, pressed as many times as the week needs. Nothing opens
          filled, so the line below asks for a day until the user gives one. */}
      {kind === 'weekdays' ? (
        <View style={styles.section}>
          <Text variant="smallStrong">Shot days</Text>
          <ShotDayStrip
            days={schedule.weekdays}
            onPick={(day) => toggleScheduleWeekday(medicationId, day)}
            selection="many"
            accessibilityLabel={`Shot days for ${name}`}
          />
          <Text variant="small" color={colors.inkMuted}>{weekdayNote(schedule.weekdays)}</Text>
        </View>
      ) : null}
    </SetupStep>
  );
}

/**
 * The interval read back as a sentence, or the line that says the box is empty.
 * Never a number the user did not type.
 */
function intervalNote(text: string): string {
  const days = Number.parseInt(text, 10);
  if (!Number.isFinite(days) || days < 1) return 'Enter how many days pass between shots.';
  return days === 1 ? 'Shots land every day.' : `Shots land every ${days} days.`;
}

/** The picked days read back, or the line that says none is picked yet. */
function weekdayNote(weekdays: readonly Weekday[]): string {
  const named = weekdayListLabel(weekdays);
  return named === '' ? 'Pick the days you take your shot.' : `Poke schedules ${named}.`;
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  inputBox: {
    width: 72,
  },
  inputText: {
    textAlign: 'center',
  },
});
