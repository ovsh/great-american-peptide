import { StyleSheet, View } from 'react-native';
import { Mars, UserRound, Venus } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { IconChoiceCard } from '@/components/OnboardingScreen';
import { OnboardingStep } from '@/components/OnboardingStep';
import type { Sex } from '@/db/types';
import { SEX_OPTIONS, useOnboardingStore } from '@/stores/onboarding';
import { spacing } from '@/theme';

/** A picture per answer. The store owns the ids and the words. */
const SEX_ICONS: Record<Sex, LucideIcon> = {
  female: Venus,
  male: Mars,
  other: UserRound,
};

/**
 * The two short answers share a row and the opt-out runs the full width under
 * them. Putting all three in the row would say they are the same kind of thing,
 * and the third is a decision not to answer.
 */
const PAIR = SEX_OPTIONS.slice(0, 2);
const REST = SEX_OPTIONS.slice(2);

// The first question of the run, and the shortest one to answer. Three stacked
// rows with a check on each read as a form; two cards side by side read as a
// choice, and the whole answer is one word long.
//
// The ids and the words are the ones the flow has always written, so a `sex`
// column written by an older build still means what it meant. Only the shape
// changed, and the screen stays as skippable as it was: it has no Skip, and
// "Prefer not to say" is the way past it.
export default function SexScreen() {
  const sex = useOnboardingStore((state) => state.sex);
  const setSex = useOnboardingStore((state) => state.setSex);

  return (
    <OnboardingStep
      step="sex"
      title="Which of these fits you?"
      canContinue={sex !== null}
    >
      <View style={styles.row}>
        {PAIR.map((option) => (
          <IconChoiceCard
            key={option.id}
            icon={SEX_ICONS[option.id]}
            label={option.label}
            selected={sex === option.id}
            onPress={() => setSex(option.id)}
          />
        ))}
      </View>
      {REST.map((option) => (
        <IconChoiceCard
          key={option.id}
          icon={SEX_ICONS[option.id]}
          label={option.label}
          selected={sex === option.id}
          onPress={() => setSex(option.id)}
        />
      ))}
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
});
