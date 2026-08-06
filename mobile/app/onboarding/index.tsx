import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';

import { Button } from '@/components/Button';
import { OnboardingScreen } from '@/components/OnboardingScreen';
import { Text } from '@/components/Text';
import { colors, spacing } from '@/theme';

export default function WelcomeScreen() {
  return (
    <OnboardingScreen
      step={0}
      contentStyle={styles.content}
      footer={<Button onPress={() => router.push('/onboarding/taking')}>Get started</Button>}
    >
      <View style={styles.wordmarkRow}>
        <Text variant="display" style={styles.wordmark}>Poke</Text>
        <View style={styles.wordmarkDot} />
      </View>
      <Text variant="h1" align="center">Your shots, sorted.</Text>
      <Text color={colors.inkMuted} align="center" style={styles.copy}>
        Keep your doses, shot days, and progress in one calm place.
      </Text>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  content: {
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
