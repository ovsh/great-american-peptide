import { StyleSheet, View } from 'react-native';
import {
  Bandage,
  BicepsFlexed,
  Brain,
  HeartPulse,
  Moon,
  TrendingDown,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { IconChoiceCard } from '@/components/OnboardingScreen';
import { OnboardingStep } from '@/components/OnboardingStep';
import { GOAL_OPTIONS, useOnboardingStore, type GoalOptionId } from '@/stores/onboarding';
import { spacing } from '@/theme';

/**
 * A picture per goal. Keyed on `GoalOptionId`, so a goal added to the store
 * without an icon does not compile.
 */
const GOAL_ICONS: Record<GoalOptionId, LucideIcon> = {
  weight_loss: TrendingDown,
  recovery: BicepsFlexed,
  sleep: Moon,
  focus: Brain,
  healing: Bandage,
  longevity: HeartPulse,
};

/** Two to a row, in the order the store lists them. */
const ROWS = GOAL_OPTIONS.reduce<(typeof GOAL_OPTIONS)[number][][]>((rows, option, index) => {
  if (index % 2 === 0) rows.push([option]);
  else rows[rows.length - 1].push(option);
  return rows;
}, []);

// Six answers, and most people have more than one. The old screen took a single
// pick, so somebody here for sleep and for recovery had to drop one of them at
// the door. `toggleGoal` keeps every pick in `goalTags` and holds the first one
// in `goalKind`, so the plan card and the stored column read exactly what they
// read before.
export default function GoalScreen() {
  const goalTags = useOnboardingStore((state) => state.goalTags);
  const toggleGoal = useOnboardingStore((state) => state.toggleGoal);

  return (
    <OnboardingStep
      step="goal"
      title="What brings you to Poke?"
      subtitle="Choose as many as fit. Poke puts the first one on your plan."
      canContinue={goalTags.length > 0}
    >
      {ROWS.map((row) => (
        <View key={row[0].id} style={styles.row}>
          {row.map((option) => (
            <IconChoiceCard
              key={option.id}
              role="checkbox"
              icon={GOAL_ICONS[option.id]}
              label={option.label}
              selected={goalTags.includes(option.id)}
              onPress={() => toggleGoal(option.id)}
            />
          ))}
        </View>
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
