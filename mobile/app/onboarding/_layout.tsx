import { Stack } from 'expo-router/stack';

import { colors } from '@/theme';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // The step transition is the body fade in `onboardingTransition.ts`,
        // measured off the recording. A stack slide underneath it would move the
        // chrome as well, and in the recording the chrome does not move.
        animation: 'none',
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
