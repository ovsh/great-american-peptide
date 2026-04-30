import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts as useFraunces,
  Fraunces_400Regular,
  Fraunces_600SemiBold,
} from '@expo-google-fonts/fraunces';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import 'react-native-reanimated';

import { initDb } from '@/db/client';
import { useAppStore } from '@/stores/app';
import { colors } from '@/theme';
import { refreshScheduledReminders } from '@/services/notifications';

SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ duration: 220, fade: true });

export const unstable_settings = {
  anchor: '(tabs)',
};

let dbInitPromise: Promise<void> | null = null;
let dbInitialized = false;
let remindersInitialized = false;
let fontsInitialized = false;

function ensureDbInitialized(): Promise<void> {
  if (dbInitialized) return Promise.resolve();
  if (!dbInitPromise) {
    dbInitPromise = initDb()
      .catch((err) => {
        console.warn('[db] init failed', err);
      })
      .finally(() => {
        dbInitialized = true;
      });
  }
  return dbInitPromise;
}

export default function RootLayout() {
  const [fontsLoaded] = useFraunces({
    Fraunces_400Regular,
    Fraunces_600SemiBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_700Bold,
  });
  if (fontsLoaded) fontsInitialized = true;
  const fontsReady = fontsLoaded || fontsInitialized;

  const [dbReady, setDbReady] = useState(dbInitialized);
  const setReady = useAppStore((s) => s.setReady);

  useEffect(() => {
    if (dbInitialized) {
      setDbReady(true);
      return;
    }
    ensureDbInitialized().then(() => setDbReady(true));
  }, []);

  useEffect(() => {
    if (!dbReady) return;
    setReady(true);
    if (!remindersInitialized) {
      remindersInitialized = true;
      refreshScheduledReminders().catch((err) => console.warn('[notifications]', err));
    }
  }, [dbReady, setReady]);

  useEffect(() => {
    if (fontsReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsReady]);

  if (!fontsReady) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.ink} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="log-shot" options={{ presentation: 'modal' }} />
        <Stack.Screen name="log-weight" options={{ presentation: 'modal' }} />
        <Stack.Screen name="medications" options={{ presentation: 'card' }} />
        <Stack.Screen name="reports" options={{ presentation: 'card' }} />
        <Stack.Screen name="calculator" options={{ presentation: 'modal' }} />
      </Stack>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
