import { StyleSheet, View } from 'react-native';

import { SelectionCard } from '@/components/OnboardingScreen';
import { OnboardingStep } from '@/components/OnboardingStep';
import { SEX_OPTIONS, useOnboardingStore } from '@/stores/onboarding';
import { spacing } from '@/theme';

export default function SexScreen() {
  const sex = useOnboardingStore((state) => state.sex);
  const setSex = useOnboardingStore((state) => state.setSex);

  return (
    <OnboardingStep
      step="sex"
      title="Which of these fits you?"
      canContinue={sex !== null}
    >
      <View style={styles.list}>
        {SEX_OPTIONS.map((option) => (
          <SelectionCard
            key={option.id}
            role="radio"
            compact
            title={option.label}
            selected={sex === option.id}
            onPress={() => setSex(option.id)}
          />
        ))}
      </View>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
});
