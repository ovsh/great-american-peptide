import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
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
import { initAnalytics } from '@/services/analytics';
import { exportWithoutMigrating } from '@/services/export';
import { refreshScheduledReminders } from '@/services/notifications';
import { useAppStore } from '@/stores/app';
import { useEntitlementSettled, useEntitlementStore } from '@/stores/entitlement';
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
  const entitlementSettled = useEntitlementSettled();
  // A screen that renders a lock, or the paid chart behind it, before Poke has
  // asked the App Store shows a decision Poke has not made. So the first paint
  // waits for the answer. The wait is capped inside the entitlement store. The
  // database error screen does not wait, because it has more to say than this.
  const entitlementPending = !entitlementSettled && gate.kind !== 'error';

  // Analytics starts before the gate, so the launch itself is counted. The
  // call is inert without EXPO_PUBLIC_POSTHOG_KEY.
  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    if (gate.kind !== 'checking') return;
    bootstrapApp()
      .then((completed) => {
        setGate({ kind: completed ? 'complete' : 'required' });
        setReady(true);
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Poke could not open the database.';
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
    if (fontsReady && gate.kind !== 'checking' && !entitlementPending) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsReady, gate.kind, entitlementPending]);

  if (!fontsReady || gate.kind === 'checking' || entitlementPending) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (gate.kind === 'error') {
    return (
      <DatabaseErrorScreen
        message={gate.message}
        onRetry={() => {
          setReady(false);
          setGate({ kind: 'checking' });
        }}
      />
    );
  }

  const onboardingRequired = gate.kind === 'required';
  const onboardingComplete = gate.kind === 'complete';

  // expo-router does not put a gesture root in the tree, and the Today list is
  // held and dragged, so the root goes here.
  return (
    <GestureHandlerRootView style={styles.root}>
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
            <Stack.Screen name="redeem" options={{ presentation: 'card' }} />
            {/* Full screen, not a card: the offer needs the whole height for the
                benefits, both prices and the renewal disclosure. */}
            <Stack.Screen name="paywall" options={{ presentation: 'fullScreenModal' }} />
          </Stack.Protected>
        </Stack>
        <StatusBar style="dark" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * The launch stopped before the database opened, so this screen is the whole
 * app for as long as it shows. It says the records are still on the phone, and
 * it offers the one action that works without the upgrade Poke could not
 * finish: `exportWithoutMigrating` opens the file on its own read-only
 * connection, reads whatever schema it meets, and shares a CSV. The retry
 * replays the same migration, so the copy asks for the export first.
 */
function DatabaseErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  const [exporting, setExporting] = useState(false);

  const runExport = async () => {
    setExporting(true);
    const outcome = await exportWithoutMigrating();
    setExporting(false);
    if (outcome.kind === 'empty') {
      Alert.alert(
        'Poke found no records to export',
        'This database holds no shots, no weights and no side effects.',
      );
    } else if (outcome.kind === 'failed') {
      Alert.alert('Poke could not export your data', outcome.message);
    }
  };

  return (
    <SafeAreaProvider>
      <ScrollView style={styles.errorScroll} contentContainerStyle={styles.error}>
        <View style={styles.errorBlock}>
          <Text variant="h2" align="center">Poke could not open your data.</Text>
          <Text color={colors.inkMuted} align="center">
            Your records are still on this phone. Poke could not finish a database upgrade, so
            Poke cannot show the records yet.
          </Text>
          <Text color={colors.inkMuted} align="center">
            Export your data to a file before you try again, and keep the file somewhere safe.
          </Text>
          <Text variant="small" selectable color={colors.inkSubtle} align="center">{message}</Text>
        </View>
        <View style={styles.errorBlock}>
          <Button
            onPress={() => { runExport().catch(() => {}); }}
            disabled={exporting}
            accessibilityLabel="Export your data to a file and open the share sheet"
          >
            Export your data
          </Button>
          <Button
            variant="secondary"
            onPress={onRetry}
            accessibilityLabel="Try to open your data again"
          >
            Try again
          </Button>
        </View>
      </ScrollView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loading: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorScroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // A scroll view, because the SQLite message under the copy can run long and
  // the two buttons have to stay reachable on the shortest phone.
  error: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: spacing.xl,
    padding: spacing.screen,
  },
  errorBlock: {
    gap: spacing.md,
  },
});
