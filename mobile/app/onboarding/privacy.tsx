import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { OnboardingScreen } from '@/components/OnboardingScreen';
import { useOnboardingTransition } from '@/components/onboardingTransition';
import { PrivacyScene, privacyRowsBeat } from '@/components/onboarding/privacy-scene';
import { PromiseRow } from '@/components/onboarding/interstitial-scene';
import { TodayRise } from '@/components/today-motion';
import { onboardingTotalSteps, useOnboardingStore } from '@/stores/onboarding';
import { rise, spacing } from '@/theme';

const PROMISES = [
  'No account. No sign-in.',
  'Your log lives on this phone.',
  'Poke sends it nowhere.',
];

// Step 0. The recording opens its counted run on a promise about the answers,
// before it asks for a single one, and the order is the point: you are told what
// happens to the answers first, and then you are asked.
//
// The two sentences that used to frame the promise are gone. A phone that draws
// itself, takes three kinds of entry and then locks says both of them in one
// look, and `principles.md` §2 deletes any caption the visual already carries.
export default function PrivacyScreen() {
  // Null on a first run, and set again on a run that came back here through the
  // back chevron, so the bar keeps whatever length the answer already gave it.
  const journeyStage = useOnboardingStore((state) => state.journeyStage);
  const transition = useOnboardingTransition();

  return (
    <OnboardingScreen
      step={0}
      totalSteps={onboardingTotalSteps(journeyStage)}
      backHref="/onboarding"
      transition={transition}
      title="Before Poke asks you anything"
      footer={<Button onPress={() => transition.go('/onboarding/journey')}>Continue</Button>}
    >
      <PrivacyScene />

      <TodayRise show delay={privacyRowsBeat} distance={rise.line} style={styles.list}>
        <View style={styles.rows}>
          {PROMISES.map((promise) => (
            <PromiseRow key={promise}>{promise}</PromiseRow>
          ))}
        </View>
      </TodayRise>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  list: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 320,
  },
  rows: {
    gap: spacing.md,
  },
});
