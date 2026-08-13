import { StyleSheet, View } from 'react-native';

import { OnboardingStep } from '@/components/OnboardingStep';
import { PromiseRow } from '@/components/onboarding/interstitial-scene';
import { OnDeviceScene, onDeviceRowsBeat } from '@/components/onboarding/on-device-scene';
import { TodayRise } from '@/components/today-motion';
import { rise, spacing } from '@/theme';

const PROMISES = [
  'Poke asks for no health data from another app and sends none to one.',
  'Poke works with the network off.',
];

// This is the slot where the recording asks to connect Apple Health. Poke reads
// no health store and writes to none, so the honest screen in this position says
// what Poke does instead of asking for a permission it does not use.
//
// Two rows, not four. The database line described the storage rather than the
// promise, and the CSV line sold Pro on a screen about privacy; the scene now
// carries the picture both of them were standing in for.
export default function OnDeviceScreen() {
  return (
    <OnboardingStep step="on-device" title="Everything stays on this phone" bodyStyle={styles.body}>
      <OnDeviceScene />

      <TodayRise show delay={onDeviceRowsBeat} distance={rise.line} style={styles.list}>
        <View style={styles.rows}>
          {PROMISES.map((promise) => (
            <PromiseRow key={promise}>{promise}</PromiseRow>
          ))}
        </View>
      </TodayRise>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: spacing.xl,
    alignItems: 'center',
  },
  list: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 320,
  },
  rows: {
    gap: spacing.md,
  },
});
