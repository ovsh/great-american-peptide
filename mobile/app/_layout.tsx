import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import 'react-native-reanimated';

import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import { initDb } from '@/db/client';
import { getPreferences } from '@/repositories/preferences';
import { refreshScheduledReminders } from '@/services/notifications';
import { useAppStore } from '@/stores/app';
import { useEntitlementStore } from '@/stores/entitlement';
import { useOnboardingStore } from '@/stores/onboarding';
import { colors, spacing } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export const unstable_settings = {
  anchor: '(tabs)',
};

let bootstrapPromise: Promise<boolean> | null = null;
let remindersInitialized = false;
let fontsInitialized = false;

function bootstrapApp(): Promise<boolean> {
  if (!bootstrapPromise) {
    bootstrapPromise = initDb()
      .then(getPreferences)
      .then((preferences) => preferences.onboarding_completed_at !== null)
      .catch((error: unknown) => {
        bootstrapPromise = null;
        throw error;
      });
  }
  return bootstrapPromise;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  if (fontsLoaded) fontsInitialized = true;
  const fontsReady = fontsLoaded || fontsInitialized;
  const gate = useOnboardingStore((state) => state.gate);
  const setGate = useOnboardingStore((state) => state.setGate);
  const setReady = useAppStore((state) => state.setReady);

  useEffect(() => {
    if (gate.kind !== 'checking') return;
    bootstrapApp()
      .then((completed) => {
        setGate({ kind: completed ? 'complete' : 'required' });
        setReady(true);
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'The database could not open.';
        setGate({ kind: 'error', message });
      });
  }, [gate.kind, setGate, setReady]);

  useEffect(() => {
    if (gate.kind !== 'complete' || remindersInitialized) return;
    remindersInitialized = true;
    refreshScheduledReminders().catch(() => {});
  }, [gate.kind]);

  // Independent of the database gate: the store must know whether we can sell
  // before any screen asks whether a feature is locked.
  useEffect(() => {
    useEntitlementStore.getState().bootstrap().catch(() => {});
  }, []);

  useEffect(() => {
    if (fontsReady && gate.kind !== 'checking') {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsReady, gate.kind]);

  if (!fontsReady || gate.kind === 'checking') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (gate.kind === 'error') {
    return (
      <SafeAreaProvider>
        <View style={styles.error}>
          <Text variant="h2" align="center">Poke could not open your data.</Text>
          <Text selectable color={colors.inkMuted} align="center">{gate.message}</Text>
          <Button
            onPress={() => {
              setReady(false);
              setGate({ kind: 'checking' });
            }}
          >
            Try again
          </Button>
        </View>
      </SafeAreaProvider>
    );
  }

  const onboardingRequired = gate.kind === 'required';
  const onboardingComplete = gate.kind === 'complete';

  return (
    <SafeAreaProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Protected guard={onboardingRequired}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={onboardingComplete}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="log-shot" options={{ presentation: 'modal' }} />
          <Stack.Screen name="log-weight" options={{ presentation: 'modal' }} />
          <Stack.Screen name="log-side-effect" options={{ presentation: 'modal' }} />
          <Stack.Screen name="medications" options={{ presentation: 'card' }} />
          <Stack.Screen name="reports" options={{ presentation: 'card' }} />
          <Stack.Screen name="calculator" options={{ presentation: 'modal' }} />
          {/* Full screen, not a card: the offer needs the whole height for the
              benefits, both prices and the renewal disclosure. */}
          <Stack.Screen name="paywall" options={{ presentation: 'fullScreenModal' }} />
        </Stack.Protected>
      </Stack>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.screen,
  },
});
