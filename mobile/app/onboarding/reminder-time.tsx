import { StyleSheet, View } from 'react-native';

import { InlineTimePicker } from '@/components/InlineTimePicker';
import { OnboardingStep } from '@/components/OnboardingStep';
import { Text } from '@/components/Text';
import {
  SHOT_DAY_OPTIONS,
  useOnboardingStore,
  type MedicationScheduleDraft,
} from '@/stores/onboarding';
import { spacing } from '@/theme';

// The time comes before the permission ask, so the permission sheet arrives with
// something already agreed behind it. This is the slot the recording spends on
// its rating prompt, which `services/reviewGate.ts` will not let Poke copy.
export default function ReminderTimeScreen() {
  const medicationIds = useOnboardingStore((state) => state.medicationIds);
  const schedules = useOnboardingStore((state) => state.schedules);
  const reminder = useOnboardingStore((state) => state.reminder);
  const setReminderTime = useOnboardingStore((state) => state.setReminderTime);
  const dayLabel = shotDayLabel(medicationIds.map((id) => schedules[id]));

  return (
    <OnboardingStep
      step="reminder-time"
      title="What time suits you?"
      subtitle={`Poke can put a reminder ${dayLabel}, at the hour you choose.`}
    >
      <View style={styles.picker}>
        <Text variant="smallStrong">Reminder time</Text>
        <InlineTimePicker value={reminder.time} onChange={setReminderTime} />
      </View>
    </OnboardingStep>
  );
}

// One reminder time covers every medication, so the subtitle must hold more
// than one shot day. Two or more different days get a general phrase.
//
// The preposition belongs in the label, not in the subtitle. A twice-weekly
// schedule stores one weekday and fires on two, so "on Tuesday" would be false
// for half the users. "from Tuesday" is true for both.
function shotDayLabel(schedules: (MedicationScheduleDraft | undefined)[]): string {
  const days = new Set<number>();
  let hasDaily = false;
  let hasTwiceWeekly = false;
  for (const schedule of schedules) {
    if (!schedule) continue;
    if (schedule.frequencyKind === 'daily') hasDaily = true;
    else days.add(schedule.shotDay);
    if (schedule.frequencyKind === 'twice_weekly') hasTwiceWeekly = true;
  }
  if (days.size === 0) return 'each day';
  if (days.size === 1 && !hasDaily) {
    const [day] = [...days];
    const weekday = SHOT_DAY_OPTIONS.find((option) => option.value === day)?.label;
    if (!weekday) return 'on shot day';
    return hasTwiceWeekly ? `from ${weekday}` : `on ${weekday}`;
  }
  return 'on your shot days';
}

const styles = StyleSheet.create({
  picker: {
    gap: spacing.sm,
  },
});
