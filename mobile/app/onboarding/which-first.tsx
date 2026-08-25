import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { OnboardingScreen, SelectionCard } from '@/components/OnboardingScreen';
import { useOnboardingTransition } from '@/components/onboardingTransition';
import {
  medicationDisplayName,
  onboardingTotalSteps,
  setupHref,
  whichFirstStepIndex,
  useOnboardingStore,
} from '@/stores/onboarding';
import { spacing } from '@/theme';

/**
 * The order question, and the first screen of the setup run.
 *
 * It only runs when the user picked two or more medications, because one
 * medication has one order. One tap answers it: the tapped medication moves to
 * the front of `medicationIds` and the run starts on it. That array is also the
 * order of the plan screen and of `sort_order` in the database, so the answer
 * carries all the way through without a second field to keep in step.
 *
 * The screen sits at the front of the setup run's single counted step, so it
 * adds no step to the bar however many medications follow it.
 */
export default function WhichFirstScreen() {
  const medicationIds = useOnboardingStore((state) => state.medicationIds);
  const customNames = useOnboardingStore((state) => state.customNames);
  const stage = useOnboardingStore((state) => state.journeyStage);
  const experience = useOnboardingStore((state) => state.experienceLevel);
  const setFirstMedication = useOnboardingStore((state) => state.setFirstMedication);
  const prepareSchedules = useOnboardingStore((state) => state.prepareSchedules);
  const transition = useOnboardingTransition();

  const pick = (id: string) => {
    setFirstMedication(id);
    prepareSchedules();
    transition.go(setupHref(0, 'vial'));
  };

  return (
    <OnboardingScreen
      step={whichFirstStepIndex()}
      totalSteps={onboardingTotalSteps(stage, experience)}
      backHref="/onboarding/taking"
      transition={transition}
      title="Which one do you want to set up first?"
      subtitle="Poke asks about the rest straight after."
      // One tap is the whole answer, so a Continue button under it would ask
      // the user to confirm a choice they already made. The footer holds the
      // way back to the picker instead.
      footer={(
        <Button variant="ghost" onPress={() => transition.go('/onboarding/taking')}>
          Change my medications
        </Button>
      )}
    >
      <View style={styles.list}>
        {medicationIds.map((id) => (
          <SelectionCard
            key={id}
            role="radio"
            compact
            title={medicationDisplayName(id, customNames)}
            selected={false}
            onPress={() => pick(id)}
          />
        ))}
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
});
