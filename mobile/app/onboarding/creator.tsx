import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Input } from '@/components/Input';
import { OnboardingStep } from '@/components/OnboardingStep';
import { Text } from '@/components/Text';
import { CODE_PREFIX } from '@/domain/testerCode';
import { useEntitlementStore, useTesterProAt } from '@/stores/entitlement';
import { colors, radius, spacing } from '@/theme';

/** Four payload characters and a checksum. `docs/tester-codes.md` is the spec. */
const CODE_BODY_LENGTH = 5;

type Note = { kind: 'none' } | { kind: 'granted' } | { kind: 'rejected' };

/**
 * The second door to the tester code, and the same door.
 *
 * `app/redeem.tsx` is the first one, in Profile, and it stays. Both screens call
 * `redeemTesterCode`, both reject in the same words, and a grant from either one
 * is the same grant: Poke Pro on this device. Nothing here knows about the
 * paywall, and nothing here needs to. `onboarding/plan.tsx` opens the paywall
 * only when `paywallEnabledNow() && !isProNow()`, and `accessFromState` reads a
 * tester grant as Pro, so a code applied here closes that branch on its own.
 *
 * Read `src/services/testerAccess.ts` before you put anything else behind this.
 * The constants that mint a code ship in the binary, so a code is a convenience
 * for people Poke invited and it is not a lock.
 */
export default function CreatorScreen() {
  const redeemTesterCode = useEntitlementStore((state) => state.redeemTesterCode);
  const testerProAt = useTesterProAt();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  // A user who applies a code, walks on, then presses back arrives at a screen
  // that already knows. Read once at mount, because only this screen changes it
  // afterwards.
  const [note, setNote] = useState<Note>(
    testerProAt === null ? { kind: 'none' } : { kind: 'granted' },
  );

  const apply = async (advance: () => void) => {
    setBusy(true);
    const outcome = await redeemTesterCode(`${CODE_PREFIX}${code}`).catch(() => 'rejected' as const);
    setBusy(false);
    if (outcome !== 'granted') {
      setNote({ kind: 'rejected' });
      return;
    }
    // The line lands in the same frame the fade out starts, so the confirmation
    // is on screen on the way to the next question. A code that works earns a
    // sentence and not a screen of its own.
    setNote({ kind: 'granted' });
    advance();
  };

  return (
    <OnboardingStep
      step="creator"
      title="Did a creator send you?"
      subtitle="A creator code unlocks Poke Pro on this device."
      canContinue={!busy && code.length > 0}
      continueLabel={busy ? 'Checking your code' : 'Apply the code'}
      onContinue={(advance) => {
        void apply(advance);
      }}
      secondary={{ label: 'Skip this', onPress: (advance) => advance() }}
    >
      <View style={styles.codeRow}>
        <Text variant="bodyStrong" color={colors.inkMuted}>{CODE_PREFIX}</Text>
        <View style={styles.codeField}>
          <Input
            value={code}
            onChangeText={(next) => {
              setCode(codeBody(next));
              setNote({ kind: 'none' });
            }}
            placeholder="Your code"
            accessibilityLabel="Creator code"
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            editable={!busy}
            returnKeyType="done"
          />
        </View>
      </View>

      {note.kind === 'none' ? null : (
        <View
          accessibilityRole="alert"
          style={[styles.note, note.kind === 'rejected' ? styles.noteBad : styles.noteGood]}
        >
          <Text variant="small" color={note.kind === 'rejected' ? colors.danger : colors.ink}>
            {note.kind === 'rejected'
              // One sentence for every reason a code fails. A message that named
              // the reason would teach the shape of a code to somebody guessing
              // at one. `app/redeem.tsx` says the same words.
              ? 'This code is not valid.'
              : 'Poke Pro is on for this device.'}
          </Text>
        </View>
      )}
    </OnboardingStep>
  );
}

/**
 * The characters after the prefix, as the field holds them.
 *
 * The prefix is drawn beside the field, so a code pasted whole would otherwise
 * arrive as `POKE-POKE-VQ7CE`, which is nine characters and reads as invalid.
 * Poke drops the prefix the way `decodeTesterCode` does, before the lookalike
 * mapping, and keeps at most a code's worth of what is left. The decoder is
 * still the only judge of whether a code is real.
 */
function codeBody(input: string): string {
  const text = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const body = text.startsWith('POKE') || text.startsWith('P0KE') ? text.slice(4) : text;
  return body.slice(0, CODE_BODY_LENGTH);
}

const styles = StyleSheet.create({
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  codeField: {
    flex: 1,
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
