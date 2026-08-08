import { RotateCw } from 'lucide-react-native';

import { Interstitial } from '@/components/OnboardingStep';
import { colors } from '@/theme';

// Interstitial 3. Every claim on this screen is a claim about `domain/rotation.ts`,
// which picks the site that has gone longest without a shot.
export default function RotationScreen() {
  return (
    <Interstitial
      step="rotation"
      icon={<RotateCw size={34} color={colors.accent} />}
      title="Poke remembers where the last one went"
      body="When you log a shot, Poke offers the site that has waited longest. The same spot does not come round twice in a row."
      note="You can always pick a different site. Poke records the one you used."
    />
  );
}
