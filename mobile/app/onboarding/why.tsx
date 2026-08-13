import { InterstitialScene } from '@/components/onboarding/interstitial-scene';
import { LogMomentScene } from '@/components/onboarding/log-moment-scene';

// Interstitial 1, in the recording's position. MeAgain uses this slot to make a
// claim about results. Poke uses it to make a claim about the app, because that
// is the only kind of claim Poke can stand behind.
//
// The line about a late log is gone. It is true, and it belongs where a user is
// actually logging late rather than in a claim screen before the first shot.
export default function WhyScreen() {
  return (
    <InterstitialScene
      step="why"
      title="Poke stays out of your day"
      scene={<LogMomentScene />}
      line="Poke already knows your dose and your site. Logging a shot takes two taps."
    />
  );
}
