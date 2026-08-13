import { useMemo } from 'react';
import { ShieldCheck } from 'lucide-react-native';

import { Interstitial } from '@/components/OnboardingStep';
import { DateMathScene } from '@/components/onboarding/date-math-scene';
import { InterstitialScene } from '@/components/onboarding/interstitial-scene';
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
  // Fixed at mount, so the drawn date cannot shift while the screen is open.
  const now = useMemo(() => Date.now(), []);
  const projection = useMemo(() => planProjection(weight, pace, now), [weight, pace, now]);

  if (!projection) {
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

  // The line about the pace moving the date is gone. The scene is the sum with
  // the user's own three numbers in it, and the pace ticks in front of them, so
  // a sentence saying the sum is live repeats what the drawing shows.
  return (
    <InterstitialScene
      step="consistency"
      title="Where your date comes from"
      scene={(
        <DateMathScene
          distance={`${formatWeight(Math.abs(projection.current - projection.goal))} ${projection.unit}`}
          pace={`${projection.pace.toFixed(projection.unit === 'lb' ? 1 : 2)} ${projection.unit} a week`}
          date={longDate(projection.reachesAt)}
        />
      )}
      line="Poke divides your distance by your pace and prints the date that falls on. That is arithmetic and nothing more."
    />
  );
}

function formatWeight(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function longDate(at: number): string {
  return new Date(at).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
