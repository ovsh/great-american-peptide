import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';

import { Button } from '@/components/Button';
import { OnboardingScreen } from '@/components/OnboardingScreen';
import { Text } from '@/components/Text';
import { onboardingTotalSteps, useOnboardingStore } from '@/stores/onboarding';
import { colors, spacing } from '@/theme';

export default function WelcomeScreen() {
  const medicationIds = useOnboardingStore((state) => state.medicationIds);
  return (
    <OnboardingScreen
      step={0}
      totalSteps={onboardingTotalSteps(medicationIds.length)}
      bodyStyle={styles.hero}
      footer={<Button onPress={() => router.push('/onboarding/taking')}>Get started</Button>}
    >
      <View style={styles.wordmarkRow}>
        <Text variant="display" style={styles.wordmark}>Poke</Text>
        <View style={styles.wordmarkDot} />
      </View>
      <Text variant="h1" align="center">Your shots, sorted.</Text>
      <Text color={colors.inkMuted} align="center" style={styles.copy}>
        Poke keeps your doses, your shot days and your weight on this phone.
      </Text>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  hero: {
    flex: 1,
    justifyContent: 'center',
  },
  wordmarkRow: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingBottom: spacing.md,
  },
  wordmark: {
    fontSize: 40,
    lineHeight: 46,
  },
  wordmarkDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    marginTop: 4,
    marginLeft: 2,
  },
  copy: {
    maxWidth: 340,
    alignSelf: 'center',
    paddingTop: spacing.sm,
  },
});
