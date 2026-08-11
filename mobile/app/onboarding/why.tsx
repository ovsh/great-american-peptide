import { CalendarCheck } from 'lucide-react-native';

import { Interstitial } from '@/components/OnboardingStep';
import { colors } from '@/theme';

// Interstitial 1, in the recording's position. MeAgain uses this slot to make a
// claim about results. Poke uses it to make a claim about the app, because that
// is the only kind of claim Poke can stand behind.
export default function WhyScreen() {
  return (
    <Interstitial
      step="why"
      icon={<CalendarCheck size={34} color={colors.accent} />}
      title="Poke stays out of your day"
      body="Poke already knows your dose and your site. Logging a shot takes two taps."
      note="Log it late and Poke keeps the date you enter."
    />
  );
}
