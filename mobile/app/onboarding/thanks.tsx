import { CircleCheck } from 'lucide-react-native';

import { Interstitial } from '@/components/OnboardingStep';
import { colors } from '@/theme';

// Recording step 23, the last screen before the compute beat. It is the one
// screen in the run that asks for nothing, and it is placed where it is on
// purpose: the progress bar reads 100 %, so the warmth lands on a finished job
// rather than on a promise. Poke keeps the position, the beat and the button.
//
// The note is the one thing Poke can say here that MeAgain cannot. Every answer
// behind this screen went into a SQLite file on the phone and nowhere else, so
// the closing line is a fact, not a reassurance.
export default function ThanksScreen() {
  return (
    <Interstitial
      step="thanks"
      icon={<CircleCheck size={40} color={colors.accent} />}
      title="Thank you for trusting Poke"
      body="That is everything Poke needs. Give Poke a moment and your plan will be ready."
      note="Every answer you gave stayed on this phone."
      continueLabel="Create my plan"
    />
  );
}
