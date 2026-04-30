import { router } from 'expo-router';

export function safeBack(fallback: string) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback as any);
}
