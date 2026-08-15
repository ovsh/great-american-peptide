import { useEffect } from 'react';
import { useSegments } from 'expo-router';
import { Stack } from 'expo-router/stack';

import { track } from '@/services/analytics';
import { colors } from '@/theme';

export default function OnboardingLayout() {
  // One place for all 25 steps. Segments are route patterns, so a dynamic step
  // reads as `schedule/[index]` and no answer a person typed can reach the
  // event.
  const segments = useSegments() as readonly string[];
  const step = segments.slice(segments.indexOf('onboarding') + 1).join('/') || 'index';

  useEffect(() => {
    track('onboarding_step_viewed', { step });
  }, [step]);

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
