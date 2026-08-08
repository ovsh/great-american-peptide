import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { Button } from '@/components/Button';
import { InlineTimePicker } from '@/components/InlineTimePicker';
import { OnboardingScreen } from '@/components/OnboardingScreen';
import { Text } from '@/components/Text';
import { ensureNotificationPermission } from '@/services/notifications';
import {
  SHOT_DAY_OPTIONS,
  onboardingTotalSteps,
  postScheduleStepIndex,
  useOnboardingStore,
  type MedicationScheduleDraft,
} from '@/stores/onboarding';
import { colors, spacing } from '@/theme';

export default function RemindersScreen() {
  const medicationIds = useOnboardingStore((state) => state.medicationIds);
  const schedules = useOnboardingStore((state) => state.schedules);
  const reminder = useOnboardingStore((state) => state.reminder);
  const setReminderTime = useOnboardingStore((state) => state.setReminderTime);
  const setReminderEnabled = useOnboardingStore((state) => state.setReminderEnabled);
  const [requesting, setRequesting] = useState(false);
  const [permissionMessage, setPermissionMessage] = useState<string | null>(null);
  const dayLabel = shotDayLabel(medicationIds.map((id) => schedules[id]));

  const accept = async () => {
    if (requesting) return;
    setRequesting(true);
    setPermissionMessage(null);
    try {
      const granted = await ensureNotificationPermission();
      setReminderEnabled(granted);
      if (granted) router.push('/onboarding/ready');
      else setPermissionMessage('Notifications are not available here. You can continue without a reminder.');
    } catch {
      setReminderEnabled(false);
      setPermissionMessage('Poke could not turn on notifications. You can continue without a reminder.');
    } finally {
      setRequesting(false);
    }
  };

  return (
    <OnboardingScreen
      step={postScheduleStepIndex(medicationIds.length, 'reminders')}
      totalSteps={onboardingTotalSteps(medicationIds.length)}
      backHref="/onboarding/concerns"
      title="Want a shot-day reminder?"
      subtitle={`Poke can remind you at your usual time ${dayLabel}.`}
      footer={(
        <View style={styles.actions}>
          <Button disabled={requesting} onPress={accept}>
            {requesting ? 'Checking permission' : 'Turn on reminders'}
          </Button>
          <Button
            variant="secondary"
            disabled={requesting}
            onPress={() => {
              setReminderEnabled(false);
              router.push('/onboarding/ready');
            }}
          >
            Skip the reminder
          </Button>
        </View>
      )}
    >
      <View style={styles.timeCard}>
        <Text variant="smallStrong">Reminder time</Text>
        <InlineTimePicker
          value={reminder.time}
          onChange={setReminderTime}
        />
        {permissionMessage ? <Text selectable variant="small" color={colors.danger}>{permissionMessage}</Text> : null}
      </View>
    </OnboardingScreen>
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
  timeCard: {
    gap: spacing.sm,
  },
  actions: {
    gap: spacing.md,
  },
});
