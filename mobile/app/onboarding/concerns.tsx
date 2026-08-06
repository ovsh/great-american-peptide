import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { Button } from '@/components/Button';
import { OnboardingScreen, SelectionCard } from '@/components/OnboardingScreen';
import { CONCERN_OPTIONS, useOnboardingStore } from '@/stores/onboarding';
import { spacing } from '@/theme';

export default function ConcernsScreen() {
  const concerns = useOnboardingStore((state) => state.concerns);
  const toggleConcern = useOnboardingStore((state) => state.toggleConcern);
  return (
    <OnboardingScreen
      step={5}
      backHref="./weight"
      title="Anything you're watching for?"
      subtitle="Pick any changes you want to keep an eye on."
      footer={(
        <Button disabled={concerns.length === 0} onPress={() => router.push('/onboarding/reminders')}>
          Continue
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
