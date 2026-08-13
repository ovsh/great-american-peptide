import { CircleCheck } from 'lucide-react-native';

import { Interstitial } from '@/components/OnboardingStep';
import { colors } from '@/theme';

// Recording step 23, the last screen before the compute beat. It is the one
// screen in the run that asks for nothing, and it is placed where it is on
// purpose: the progress bar reads 100 %, so the warmth lands on a finished job
// rather than on a promise. Poke keeps the position, the beat and the button.
//
// Two lines and a button. The screen holds no third line, because a beat that
// asks for nothing reads as a pause only while it stays short.
export default function ThanksScreen() {
  return (
    <Interstitial
      step="thanks"
      icon={<CircleCheck size={40} color={colors.accent} />}
      title="Thank you for trusting Poke"
      body="That is everything Poke needs."
      continueLabel="Create my plan"
    />
  );
}
