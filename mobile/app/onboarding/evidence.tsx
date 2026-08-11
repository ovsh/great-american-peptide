import { FlaskConical } from 'lucide-react-native';

import { Interstitial } from '@/components/OnboardingStep';
import { colors } from '@/theme';

// Interstitial 4, the last one before the flow turns to setup. This is the slot
// where MeAgain shows a review card. Poke has the one claim its competitors
// cannot make, so Poke makes that instead.
export default function EvidenceScreen() {
  return (
    <Interstitial
      step="evidence"
      icon={<FlaskConical size={34} color={colors.accent} />}
      title="Every half-life here names its source"
      body="Poke prints the source next to the medication. Where the half-life is only an estimate, Poke says so."
      note="The level chart is an estimate. No estimate is a reason to change a dose."
    />
  );
}
