import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { Button } from '@/components/Button';
import { OnboardingScreen, SelectionCard } from '@/components/OnboardingScreen';
import {
  CONCERN_OPTIONS,
  onboardingTotalSteps,
  postScheduleStepIndex,
  useOnboardingStore,
} from '@/stores/onboarding';
import { spacing } from '@/theme';

export default function ConcernsScreen() {
  const concerns = useOnboardingStore((state) => state.concerns);
  const toggleConcern = useOnboardingStore((state) => state.toggleConcern);
  const medicationIds = useOnboardingStore((state) => state.medicationIds);
  return (
    <OnboardingScreen
      step={postScheduleStepIndex(medicationIds.length, 'concerns')}
      totalSteps={onboardingTotalSteps(medicationIds.length)}
      backHref="/onboarding/weight"
      title="Anything you want to watch?"
      subtitle="Choose any effect you want on your watch list."
      footer={(
        <Button disabled={concerns.length === 0} onPress={() => router.push('/onboarding/reminders')}>
          Set a reminder
        </Button>
      )}
    >
      <View style={styles.list}>
        {CONCERN_OPTIONS.map((concern) => (
          <SelectionCard
            key={concern.id}
            title={concern.label}
            selected={concerns.includes(concern.id)}
            onPress={() => toggleConcern(concern.id)}
          />
        ))}
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
  },
});
