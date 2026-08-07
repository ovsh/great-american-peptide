import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Lock } from 'lucide-react-native';

import { Button } from './Button';
import { Card } from './Card';
import { Text } from './Text';
import { isProNow, useIsPro } from '../stores/entitlement';
import { colors, radius, spacing } from '../theme';

export function openPaywall(): void {
  router.push('/paywall');
}

/**
 * Wraps an action that only paying users may run. Free users get the paywall
 * instead of a dead tap — never a silent no-op.
 */
export function useProAction(action: () => void): () => void {
  return useCallback(() => {
    if (isProNow()) action();
    else openPaywall();
  }, [action]);
}

interface ProLockProps {
  title: string;
  body: string;
  cta?: string;
}

/** Replaces a paid section with an honest, tappable explanation of what is behind it. */
export function ProLock({ title, body, cta = 'Unlock with Pro' }: ProLockProps) {
  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <View style={styles.icon}>
          <Lock size={19} color={colors.accent} strokeWidth={2} />
        </View>
        <View style={styles.copy}>
          <Text variant="bodyStrong">{title}</Text>
          <Text variant="small" color={colors.inkMuted}>{body}</Text>
        </View>
      </View>
      <Button size="sm" variant="outline" onPress={openPaywall}>{cta}</Button>
    </Card>
  );
}

/** Renders `children` for paying users and the lock card for everyone else. */
export function ProSection({
  title,
  body,
  cta,
  children,
}: ProLockProps & { children: React.ReactNode }) {
  const pro = useIsPro();
  if (pro) return <>{children}</>;
  return <ProLock title={title} body={body} cta={cta} />;
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.lg,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
  },
});
