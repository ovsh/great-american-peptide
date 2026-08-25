import { CircleCheck } from 'lucide-react-native';

import { Interstitial } from '@/components/OnboardingStep';
import { useOnboardingStore } from '@/stores/onboarding';
import { colors } from '@/theme';
import { goalFraming } from '@/utils/goalFraming';

// Recording step 23, the last screen before the compute beat. It is the one
// screen in the run that asks for nothing, and it is placed where it is on
// purpose: the progress bar reads 100 %, so the warmth lands on a finished job
// rather than on a promise. Poke keeps the position, the beat and the button.
//
// Two lines and a button. The screen holds no third line, because a beat that
// asks for nothing reads as a pause only while it stays short.
//
// The headline is the one place in the run that says the goal back. The user
// answered "What brings you to Poke?" twenty screens ago, and this is the beat
// where the run stops asking and turns towards the plan, so the goal is what it
// turns towards. A user who skipped the goal question reads the thank-you the
// screen has always carried, word for word.
export default function ThanksScreen() {
  const goalTags = useOnboardingStore((state) => state.goalTags);
  const framing = goalFraming(goalTags);

  return (
    <Interstitial
      step="thanks"
      icon={<CircleCheck size={40} color={colors.accent} />}
      title={framing ? `Time to start ${framing.pursuit}` : 'Thank you for trusting Poke'}
      body="That is everything Poke needs."
      continueLabel="Create my plan"
    />
  );
}
