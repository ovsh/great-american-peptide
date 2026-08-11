import { useEffect } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { colors } from '@/theme';

// Center tab is a CTA that opens /log-shot. We never render this screen,
// but Expo Router needs the file to register the route.
export default function SealRedirect() {
  useEffect(() => {
    router.replace('/log-shot');
  }, []);
  return <View style={{ flex: 1, backgroundColor: colors.background }} />;
}
