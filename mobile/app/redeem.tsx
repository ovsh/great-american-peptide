import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { KeyRound } from 'lucide-react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { Input } from '@/components/Input';
import { Text } from '@/components/Text';
import { useEntitlementStore, useTesterId, useTesterProAt } from '@/stores/entitlement';
import { colors, radius, spacing } from '@/theme';

/**
 * The tester door. It is reached from Profile and from nowhere else. It is
 * deliberately absent from the paywall: a buyer looking at a price must never be
 * shown a way around it. See `src/services/testerAccess.ts` for why a code in
 * the binary is a convenience and not a lock.
 */
type Note =
  | { kind: 'none' }
  | { kind: 'granted' }
  | { kind: 'rejected' }
  | { kind: 'revoked' };

export default function RedeemScreen() {
  const insets = useSafeAreaInsets();
  const testerProAt = useTesterProAt();
  const testerId = useTesterId();
  const redeemTesterCode = useEntitlementStore((state) => state.redeemTesterCode);
  const revokeTesterCode = useEntitlementStore((state) => state.revokeTesterCode);
  const subscribed = useEntitlementStore((state) => state.status === 'pro');

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>({ kind: 'none' });

  const redeem = async () => {
    setBusy(true);
    const outcome = await redeemTesterCode(code).catch(() => 'rejected' as const);
    setBusy(false);
    if (outcome === 'granted') {
      setCode('');
      setNote({ kind: 'granted' });
    } else {
      setNote({ kind: 'rejected' });
    }
  };

  const revoke = async () => {
    setBusy(true);
    await revokeTesterCode().catch(() => {});
    setBusy(false);
    setNote({ kind: 'revoked' });
  };

  return (
    <View style={styles.root}>
      <View style={{ paddingTop: insets.top }}>
        <Header title="Tester access" showBack backFallback="/profile" />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <KeyRound size={22} color={colors.accent} strokeWidth={2} />
            </View>
            <Text variant="h2">Poke Pro for testers</Text>
            <Text color={colors.inkMuted}>
              Poke sends a code to every invited tester. A code turns Poke Pro on for this device.
            </Text>
          </View>

          {testerProAt === null ? (
            <Card style={styles.card}>
              <Text variant="bodyStrong">Enter your code</Text>
              <Input
                value={code}
                // Uppercased on the way in, because a code is printed in
                // uppercase and the keyboard shift key is one more thing to get
                // wrong. `decodeTesterCode` accepts either.
                onChangeText={(next) => {
                  setCode(next.toUpperCase());
                  setNote({ kind: 'none' });
                }}
                placeholder="Your tester code"
                accessibilityLabel="Tester code"
                autoCapitalize="characters"
                autoCorrect={false}
                autoComplete="off"
                editable={!busy}
                returnKeyType="go"
                onSubmitEditing={redeem}
              />
              <Button disabled={busy || code.trim().length === 0} onPress={redeem}>
                {busy ? 'Checking your code' : 'Turn on Poke Pro'}
              </Button>
            </Card>
          ) : (
            <Card style={styles.card}>
              <Text variant="bodyStrong">Tester access is on.</Text>
              <Text variant="small" color={colors.inkMuted}>
                {testerId === null
                  ? `A tester code unlocked Poke Pro on ${format(testerProAt, 'd MMMM yyyy')}. The code unlocks this device only.`
                  : `The code for tester ${testerId} unlocked Poke Pro on ${format(testerProAt, 'd MMMM yyyy')}. The code unlocks this device only.`}
              </Text>
              <Button variant="outline" disabled={busy} onPress={revoke}>
                {busy ? 'Turning off tester access' : 'Turn off tester access'}
              </Button>
              <Text variant="caption" color={colors.inkSubtle}>
                Turn tester access off to see the free version again and check that a locked screen still locks.
              </Text>
            </Card>
          )}

          {note.kind === 'none' ? null : (
            <View
              accessibilityRole="alert"
              style={[styles.note, note.kind === 'rejected' ? styles.noteBad : styles.noteGood]}
            >
              <Text variant="small" color={note.kind === 'rejected' ? colors.danger : colors.ink}>
                {noteCopy(note.kind, subscribed)}
              </Text>
            </View>
          )}

          <Text variant="caption" color={colors.inkSubtle}>
            A tester code is not a purchase and it does not renew. Poke charges a tester nothing. A subscription is the other way to reach Poke Pro.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function noteCopy(kind: Exclude<Note['kind'], 'none'>, subscribed: boolean): string {
  // The reject says one thing for every reason. A message that named the reason
  // would teach the shape of the code to someone guessing at it.
  if (kind === 'rejected') return 'This code is not valid.';
  // The card above already reads "Tester access is on.", so the note adds the
  // part the card does not say.
  if (kind === 'granted') return 'Every Pro screen is open now.';
  if (subscribed) return 'Poke turned tester access off. Your subscription keeps Poke Pro on.';
  return 'Poke turned tester access off. The free version is back.';
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.hero,
  },
  content: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    gap: spacing.xl,
  },
  hero: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  card: {
    gap: spacing.md,
  },
  note: {
    padding: spacing.lg,
    borderRadius: radius.lg,
  },
  noteGood: {
    backgroundColor: colors.accentSoft,
  },
  noteBad: {
    backgroundColor: colors.dangerSoft,
  },
});
