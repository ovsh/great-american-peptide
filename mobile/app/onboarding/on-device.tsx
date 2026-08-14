import { StyleSheet, View } from 'react-native';

import { OnboardingStep } from '@/components/OnboardingStep';
import { PromiseRow } from '@/components/onboarding/interstitial-scene';
import { OnDeviceScene, onDeviceRowsBeat } from '@/components/onboarding/on-device-scene';
import { TodayRise } from '@/components/today-motion';
import { rise, spacing } from '@/theme';

const PROMISES = [
  'Poke sends your health data nowhere.',
  'Poke works with the network off.',
];

// This is the slot where the recording asks to connect Apple Health. Poke asks
// on the weight screen instead, ten steps earlier, where the permission saves
// the work the user is looking at. So this screen makes the promise the Health
// read leaves standing: the weight can come in, and nothing goes out.
//
// The first row used to read "Poke asks for no health data from another app and
// sends none to one". The first half stopped being true the day Poke read Apple
// Health, and it named Apple on a screen that also ships to Android.
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
