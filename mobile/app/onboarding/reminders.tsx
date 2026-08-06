import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { Button } from '@/components/Button';
import { InlineTimePicker } from '@/components/InlineTimePicker';
import { OnboardingScreen } from '@/components/OnboardingScreen';
import { Text } from '@/components/Text';
import { ensureNotificationPermission } from '@/services/notifications';
import { SHOT_DAY_OPTIONS, useOnboardingStore } from '@/stores/onboarding';
import { colors, spacing } from '@/theme';

export default function RemindersScreen() {
  const schedule = useOnboardingStore((state) => state.schedule);
  const reminder = useOnboardingStore((state) => state.reminder);
  const setReminderTime = useOnboardingStore((state) => state.setReminderTime);
  const setReminderEnabled = useOnboardingStore((state) => state.setReminderEnabled);
  const [requesting, setRequesting] = useState(false);
  const [permissionMessage, setPermissionMessage] = useState<string | null>(null);
  const dayLabel = schedule.kind === 'ready' && schedule.frequencyKind !== 'daily'
    ? SHOT_DAY_OPTIONS.find((day) => day.value === schedule.shotDay)?.label ?? 'shot day'
    : 'each day';

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
      step={6}
      backHref="./concerns"
      title="Want a shot-day reminder?"
      subtitle={`Poke can remind you at your usual time on ${dayLabel}.`}
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
            Not now
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

const styles = StyleSheet.create({
  timeCard: {
    gap: spacing.sm,
  },
  actions: {
    gap: spacing.md,
  },
});
