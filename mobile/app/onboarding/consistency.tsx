import { useMemo } from 'react';
import { ShieldCheck, Target } from 'lucide-react-native';

import { Interstitial } from '@/components/OnboardingStep';
import { planProjection } from '@/services/onboardingPlan';
import { useOnboardingStore } from '@/stores/onboarding';
import { colors } from '@/theme';

// Interstitial 2, straight after the pace slider, in the recording's position.
// MeAgain uses the slot to promise the goal. Poke uses it to say exactly what
// the date on the last screen is, before the user ever sees it.
//
// `POST_SCHEDULE_ORDER` is flat, so this screen runs even when the weight
// screens were skipped, and a skipped weight means the plan carries no date at
// all. Promising a date here and then showing none is the small lie that costs
// the whole flow its credit, so the screen asks the same function the plan asks
// and says something true either way. The step index does not change, because
// only the words change.
export default function ConsistencyScreen() {
  const weight = useOnboardingStore((state) => state.weight);
  const pace = useOnboardingStore((state) => state.pace);
  const hasDate = useMemo(
    () => planProjection(weight, pace, Date.now()) !== null,
    [weight, pace],
  );

  if (!hasDate) {
    return (
      <Interstitial
        step="consistency"
        icon={<ShieldCheck size={34} color={colors.accent} />}
        title="Poke makes no number up"
        body="Every figure on your plan comes from an answer you gave or from a published half-life. Poke fills no gap with an average."
        note="Skip a question and Poke leaves that part of the plan out."
      />
    );
  }

  return (
    <Interstitial
      step="consistency"
      icon={<Target size={34} color={colors.accent} />}
      title="Where your date comes from"
      body="Poke divides your distance by your pace and prints the date that falls on. That is arithmetic and nothing more."
      note="Change the pace and the date moves with it."
    />
  );
}
