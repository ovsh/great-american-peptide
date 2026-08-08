import { Target } from 'lucide-react-native';

import { Interstitial } from '@/components/OnboardingStep';
import { colors } from '@/theme';

// Interstitial 2, straight after the pace slider, in the recording's position.
// MeAgain uses the slot to promise the goal. Poke uses it to say exactly what
// the date on the last screen is, before the user ever sees it.
export default function ConsistencyScreen() {
  return (
    <Interstitial
      step="consistency"
      icon={<Target size={34} color={colors.accent} />}
      title="Where your date comes from"
      body="Poke divides the distance by the pace you picked and shows the date that falls on. A body is not arithmetic, and Poke will not pretend that it is."
      note="Change the pace whenever you like. The date moves with it."
    />
  );
}
