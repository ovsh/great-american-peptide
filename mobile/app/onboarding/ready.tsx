import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { OnboardingScreen } from '@/components/OnboardingScreen';
import { Text } from '@/components/Text';
import { getPreset } from '@/domain/peptides';
import { completeOnboarding } from '@/services/onboarding';
import { useAppStore } from '@/stores/app';
import {
  CONCERN_OPTIONS,
  GOAL_OPTIONS,
  SHOT_DAY_OPTIONS,
  getOnboardingDraft,
  useOnboardingStore,
} from '@/stores/onboarding';
import { colors, spacing } from '@/theme';

export default function ReadyScreen() {
  const medicationIds = useOnboardingStore((state) => state.medicationIds);
  const customMedicationName = useOnboardingStore((state) => state.customMedicationName);
  const schedule = useOnboardingStore((state) => state.schedule);
  const goalKind = useOnboardingStore((state) => state.goalKind);
  const concerns = useOnboardingStore((state) => state.concerns);
  const reminder = useOnboardingStore((state) => state.reminder);
  const setGate = useOnboardingStore((state) => state.setGate);
  const resetDraft = useOnboardingStore((state) => state.resetDraft);
  const bumpVersion = useAppStore((state) => state.bumpVersion);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    let active = true;
    let animation: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reducedMotion) => {
        if (!active) return;
        if (reducedMotion) {
          opacity.setValue(1);
          translateY.setValue(0);
          return;
        }
        animation = Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: 320, useNativeDriver: false }),
          Animated.timing(translateY, { toValue: 0, duration: 320, useNativeDriver: false }),
        ]);
        animation.start();
      })
      .catch(() => {
        opacity.setValue(1);
        translateY.setValue(0);
      });
    return () => {
      active = false;
      animation?.stop();
    };
  }, [opacity, translateY]);

  const primaryId = medicationIds[0];
  const primaryName = primaryId === 'custom'
    ? customMedicationName.trim()
    : primaryId
      ? getPreset(primaryId)?.name ?? ''
      : '';
  const goalLabel = GOAL_OPTIONS.find((goal) => goal.id === goalKind)?.label;
  const concernLabels = CONCERN_OPTIONS
    .filter((option) => option.id !== 'none' && concerns.includes(option.id))
    .map((option) => option.label.toLocaleLowerCase());
  const shotDay = schedule.kind === 'ready'
    ? SHOT_DAY_OPTIONS.find((day) => day.value === schedule.shotDay)?.label
    : undefined;
  const validPlan = schedule.kind === 'ready' && primaryName && goalLabel && concerns.length > 0;

  const finish = async () => {
    if (!validPlan || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const draft = getOnboardingDraft(useOnboardingStore.getState());
      await completeOnboarding(draft);
      setGate({ kind: 'complete' });
      bumpVersion();
      resetDraft();
      router.replace('/');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Poke could not save your plan. Try again.');
      setSubmitting(false);
    }
  };

  if (!validPlan || schedule.kind !== 'ready') {
    return (
      <OnboardingScreen
        step={7}
        backHref="./reminders"
        title="Let's finish your setup"
        footer={<Button onPress={() => router.replace('/onboarding/taking')}>Review your answers</Button>}
      >
        <Text color={colors.inkMuted}>A few answers are missing from your plan.</Text>
      </OnboardingScreen>
    );
  }

  const scheduleLabel = schedule.frequencyKind === 'daily'
    ? 'Daily'
    : `${schedule.frequencyKind === 'twice_weekly' ? 'Twice weekly' : 'Weekly'} from ${shotDay}`;

  return (
    <OnboardingScreen
      step={7}
      backHref="./reminders"
      title="Your plan is ready."
      subtitle="Here is the routine you set up."
      footer={(
        <View style={styles.actions}>
          {error ? <Text selectable color={colors.danger} align="center">{error}</Text> : null}
          <Button disabled={submitting} onPress={finish}>
            {submitting ? 'Saving your plan' : 'Start tracking'}
          </Button>
        </View>
      )}
    >
      <Animated.View style={{ opacity, transform: [{ translateY }] }}>
        <Card padding="xl" style={styles.planCard}>
          <PlanRow label="Medication" value={medicationIds.length > 1 ? `${primaryName} + ${medicationIds.length - 1} more` : primaryName} />
          <PlanRow label="Dose" value={`${schedule.doseText} ${schedule.unit}`} />
          <PlanRow label="Shot day" value={scheduleLabel} />
          <PlanRow label="Goal" value={goalLabel} />
          {concernLabels.length > 0 ? (
            <Text color={colors.inkMuted} style={styles.concernLine}>
              {"We'll keep "}{concernLabels.join(', ')} on your watch list.
            </Text>
          ) : (
            <Text color={colors.inkMuted} style={styles.concernLine}>Nothing is on your watch list right now.</Text>
          )}
          {reminder.kind === 'enabled' ? (
            <Text variant="smallStrong" color={colors.accent}>Reminder set for {reminder.time}</Text>
          ) : null}
        </Card>
      </Animated.View>
    </OnboardingScreen>
  );
}

function PlanRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.planRow}>
      <Text variant="small" color={colors.inkMuted}>{label}</Text>
      <Text variant="bodyStrong" align="right" style={styles.planValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  planCard: {
    gap: spacing.lg,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  planValue: {
    flex: 1,
  },
  concernLine: {
    paddingTop: spacing.sm,
  },
  actions: {
    gap: spacing.md,
  },
});
