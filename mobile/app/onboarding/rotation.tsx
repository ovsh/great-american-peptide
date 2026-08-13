import { InterstitialScene } from '@/components/onboarding/interstitial-scene';
import { RotationScene, rotationLineBeat } from '@/components/onboarding/rotation-scene';

// Interstitial 3. Every claim on this screen is a claim about `domain/rotation.ts`,
// which picks the site that has gone longest without a shot.
//
// The title now names the help rather than the memory: remembering is the means,
// rotating is what the user gets. The scene shows the four abdomen sites taking
// their turns and the tag returning to the first, so the paragraph about picking
// a different site is gone: the drawing already reads as an offer, not an order,
// and `principles.md` §2 deletes a caption the visual carries.
export default function RotationScreen() {
  return (
    <InterstitialScene
      step="rotation"
      title="Poke helps you rotate injection sites"
      scene={<RotationScene />}
      line="Poke offers the site that has waited longest."
      lineDelay={rotationLineBeat}
    />
  );
}
