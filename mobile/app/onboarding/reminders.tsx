import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
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
  const timeIsValid = /^([01]\d|2[0-3]):[0-5]\d$/.test(reminder.time);
  const dayLabel = schedule.kind === 'ready' && schedule.frequencyKind !== 'daily'
    ? SHOT_DAY_OPTIONS.find((day) => day.value === schedule.shotDay)?.label ?? 'shot day'
    : 'each day';

  const accept = async () => {
    if (!timeIsValid || requesting) return;
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
          <Button disabled={!timeIsValid || requesting} onPress={accept}>
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
        <Input
          value={reminder.time}
          onChangeText={setReminderTime}
          placeholder="09:00"
          inputMode="text"
          maxLength={5}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text variant="small" color={timeIsValid ? colors.inkMuted : colors.danger}>
          {timeIsValid ? 'Use 24-hour time.' : 'Enter a time like 09:00.'}
        </Text>
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
