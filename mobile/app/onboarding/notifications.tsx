import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { format } from 'date-fns';
import { Syringe } from 'lucide-react-native';

import { OnboardingStep } from '@/components/OnboardingStep';
import { Text } from '@/components/Text';
import {
  ensureNotificationPermission,
  SHOT_REMINDER_BODY,
  SHOT_REMINDER_TITLE,
} from '@/services/notifications';
import { useOnboardingStore } from '@/stores/onboarding';
import { colors, radius, spacing } from '@/theme';
import { fmtTime } from '@/utils/date';

/**
 * The permission ask, primed by the banner it asks for.
 *
 * The old screen argued for the permission in a subtitle and then made the user
 * press twice on a denial: the second press only opened the Settings app, and a
 * user who meant no had to answer the same question again. This one shows the
 * banner on a lock screen, asks once, and leaves on the answer, whichever way it
 * goes. A denial costs the reminder, not the run.
 */
export default function NotificationsScreen() {
  const setReminderEnabled = useOnboardingStore((state) => state.setReminderEnabled);
  const [requesting, setRequesting] = useState(false);

  // The permission sheet has to open on a press, so the step waits for the
  // answer and then leaves on it. A denial is not an error and it is not a
  // second question: iOS shows that sheet once, so there is nothing left for
  // this screen to ask. Profile turns the reminders on later.
  const ask = async (advance: () => void) => {
    if (requesting) return;
    setRequesting(true);
    try {
      const granted = await ensureNotificationPermission();
      setReminderEnabled(granted);
    } catch {
      setReminderEnabled(false);
    } finally {
      setRequesting(false);
      advance();
    }
  };

  return (
    <OnboardingStep
      step="notifications"
      // The headline sits under the lock screen rather than above it, so the
      // picture makes the case before the sentence does.
      title=""
      continueLabel="Turn on reminders"
      canContinue={!requesting}
      onContinue={(advance) => {
        void ask(advance);
      }}
      secondary={{
        label: 'Not now',
        onPress: (advance) => {
          setReminderEnabled(false);
          advance();
        },
      }}
      contentStyle={styles.content}
      bodyStyle={styles.body}
    >
      <LockScreenPreview />

      <View style={styles.copy}>
        <Text variant="display" align="center">Never miss a shot day.</Text>
        <Text color={colors.inkMuted} align="center">
          The banner never names your medication. Anyone who sees your lock screen learns nothing.
        </Text>
      </View>
    </OnboardingStep>
  );
}

/**
 * The banner Poke really sends, on a drawn lock screen.
 *
 * Both strings arrive from `services/notifications.ts`, so the preview cannot
 * promise a sentence the phone does not send. The clock and the date are this
 * phone's own, read once on mount: a drawn 9:41 would be the placeholder data a
 * shipping screen may not carry.
 */
function LockScreenPreview() {
  const [now] = useState(() => Date.now());

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`A lock screen carrying one Poke banner. ${SHOT_REMINDER_TITLE}. ${SHOT_REMINDER_BODY}`}
      style={styles.lockScreen}
    >
      <View style={styles.clock}>
        <Text variant="small" color={colors.inkSubtle}>{format(now, 'EEEE, MMMM d')}</Text>
        <Text variant="display" color={colors.inkInverse}>{fmtTime(now)}</Text>
      </View>

      <View style={styles.banner}>
        <View style={styles.appIcon}>
          <Syringe size={18} color={colors.inkInverse} />
        </View>
        <View style={styles.bannerCopy}>
          <View style={styles.bannerHead}>
            <Text variant="smallStrong" style={styles.bannerTitle}>{SHOT_REMINDER_TITLE}</Text>
            <Text variant="small" color={colors.inkSubtle}>now</Text>
          </View>
          <Text variant="small" color={colors.inkMuted}>{SHOT_REMINDER_BODY}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  body: {
    gap: spacing.xxl,
    alignItems: 'center',
  },
  copy: {
    width: '100%',
    maxWidth: 320,
    gap: spacing.sm,
  },
  lockScreen: {
    width: '100%',
    maxWidth: 320,
    padding: spacing.lg,
    gap: spacing.xl,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceInverse,
  },
  clock: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  appIcon: {
    width: spacing.xxxl,
    height: spacing.xxxl,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  bannerHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  bannerTitle: {
    flexShrink: 1,
  },
});
