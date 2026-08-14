import { useEffect, useState } from 'react';
import { AppState, Linking, StyleSheet, View } from 'react-native';
import { Bell } from 'lucide-react-native';

import { OnboardingStep } from '@/components/OnboardingStep';
import { Text } from '@/components/Text';
import { ensureNotificationPermission } from '@/services/notifications';
import { medicationDisplayName, useOnboardingStore } from '@/stores/onboarding';
import { colors, radius, spacing } from '@/theme';

export default function NotificationsScreen() {
  const setReminderEnabled = useOnboardingStore((state) => state.setReminderEnabled);
  const preview = useNotificationPreview();
  const [requesting, setRequesting] = useState(false);
  const [denied, setDenied] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // The permission sheet has to open on a press, so the fade starts only after
  // the answer comes back. A denial is not an error: the flow carries on and the
  // screen says what the denial means.
  const ask = async (advance: () => void) => {
    if (requesting) return;
    setRequesting(true);
    setMessage(null);
    try {
      const granted = await ensureNotificationPermission();
      setReminderEnabled(granted);
      setDenied(!granted);
      if (granted) {
        advance();
        return;
      }
      setMessage('Poke has no permission to send notifications. You can open the Settings app to allow it, or continue without a reminder.');
    } catch {
      setReminderEnabled(false);
      setMessage('Poke could not turn on notifications here. You can continue without a reminder.');
    } finally {
      setRequesting(false);
    }
  };

  // iOS shows the permission sheet once and never again, so after a denial the
  // Settings app is the only place the answer can change. Ask again when the
  // user comes back, otherwise the screen would still be saying no to somebody
  // who has just said yes. A second request on a denied app opens nothing.
  useEffect(() => {
    if (!denied) return;
    const listener = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void ensureNotificationPermission().then((granted) => {
        if (!granted) return;
        setReminderEnabled(true);
        setDenied(false);
        setMessage(null);
      });
    });
    return () => listener.remove();
  }, [denied, setReminderEnabled]);

  return (
    <OnboardingStep
      step="notifications"
      title="Can Poke send that reminder?"
      // Four loops ship on: the shot-day reminder, the day-after check-in, the
      // missed-shot catch-up and the cycle. A line that promised one
      // notification was true of the old build and false of this one, so the
      // promise names all four and points at the switches that turn each of
      // them off. The cycle is worth exactly two banners, the last planned day
      // and the day the break ends, so the count is in the sentence.
      subtitle="A reminder on shot day, a check-in the day after, a catch-up if a day slips, and two notes on a cycle you set. Turn any of them off in Profile. Poke sends nothing else."
      // Once iOS has been told no, pressing "Turn on reminders" again opens
      // nothing and changes nothing. The button names the one thing left that
      // can change the answer, and the skip below it says the flow carries on.
      continueLabel={requesting
        ? 'Checking permission'
        : denied ? 'Open the Settings app' : 'Turn on reminders'}
      canContinue={!requesting}
      onContinue={(advance) => {
        if (denied) {
          void Linking.openSettings();
          return;
        }
        void ask(advance);
      }}
      secondary={{
        label: denied ? 'Continue without a reminder' : 'Not now',
        onPress: (advance) => {
          setReminderEnabled(false);
          advance();
        },
      }}
    >
      <View style={styles.preview}>
        <View style={styles.badge}>
          <Bell size={20} color={colors.accent} />
        </View>
        <View style={styles.previewCopy}>
          <Text variant="smallStrong">{preview.title}</Text>
          {preview.body ? (
            <Text variant="small" color={colors.inkMuted}>{preview.body}</Text>
          ) : null}
        </View>
      </View>

      {message ? (
        <Text selectable variant="small" color={colors.danger}>{message}</Text>
      ) : null}
    </OnboardingStep>
  );
}

// The preview is the notification, not an impression of one. Both strings are
// built the same way `services/notifications.ts` builds them, off the first
// medication in the draft, so what the screen shows is what the phone shows.
// A dose the user has not typed yet drops the body rather than inventing one.
function useNotificationPreview(): { title: string; body: string | null } {
  const medicationIds = useOnboardingStore((state) => state.medicationIds);
  const schedules = useOnboardingStore((state) => state.schedules);
  const customNames = useOnboardingStore((state) => state.customNames);

  const id = medicationIds[0];
  if (!id) return { title: 'Ready for your shot?', body: null };

  const name = medicationDisplayName(id, customNames);
  const title = `Ready for your ${name} shot?`;
  const schedule = schedules[id];
  const dose = schedule?.doseText.trim();
  if (!schedule || !dose) return { title, body: null };

  return {
    title,
    body: `You set ${dose} ${schedule.unit} for today. Log it to track your levels.`,
  };
}

const styles = StyleSheet.create({
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCopy: {
    flex: 1,
    gap: spacing.xs,
  },
});
