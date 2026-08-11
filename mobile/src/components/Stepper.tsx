import { useRef, useState } from 'react';
import { View, Pressable, StyleSheet, TextInput, Platform } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Text } from './Text';
import { colors, radius, spacing, text as typo } from '../theme';

interface StepperProps {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  /**
   * The highest value the stepper writes. There is no ceiling by default,
   * because a ceiling the caller did not ask for eats a real number in silence:
   * HCG runs to 2500 iu and above. Name a ceiling, and pass `onAboveMax` with it.
   */
  max?: number;
  /**
   * Runs when a press or a typed number goes above `max` and the stepper holds
   * at `max` instead. The caller owns the words, and the caller must put them
   * on screen. A clamp the user cannot see is a lost number.
   */
  onAboveMax?: (max: number) => void;
  format?: (v: number) => string;
  unit?: string;
}

export function Stepper({
  value,
  onChange,
  step = 0.5,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  onAboveMax,
  format,
  unit,
}: StepperProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  const editing = draft !== null;

  /**
   * While the field has focus the typed text is the number the user sees, so a
   * press has to start from that text. A press that read `value` instead would
   * throw the typed digits away on the next render.
   */
  const shown = (): number => {
    if (draft === null) return value;
    const typed = parseFloat(draft.replace(',', '.'));
    return Number.isFinite(typed) ? typed : value;
  };

  const commit = (next: number) => {
    // Two decimals first, so that 2.5 plus 0.1 reads as 2.6 and not as
    // 2.6000000000000005. A ceiling test on the raw sum would report a clamp
    // that only float noise asked for.
    const rounded = +next.toFixed(2);
    if (rounded > max) onAboveMax?.(max);
    const clamped = Math.max(min, Math.min(max, rounded));
    if (editing) setDraft(String(clamped));
    onChange(clamped);
  };

  const dec = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    commit(shown() - step);
  };
  const inc = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    commit(shown() + step);
  };

  const onFocus = () => {
    setDraft(String(value));
  };

  const onBlur = () => {
    if (draft !== null) {
      const typed = parseFloat(draft.replace(',', '.'));
      if (Number.isFinite(typed)) {
        const rounded = +typed.toFixed(2);
        if (rounded > max) onAboveMax?.(max);
        onChange(Math.max(min, Math.min(max, rounded)));
      }
    }
    setDraft(null);
  };

  const display = draft !== null ? draft : format ? format(value) : String(value);

  return (
    <View style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel="Decrease" style={styles.btn} onPress={dec}>
        <Minus size={18} color={colors.ink} />
      </Pressable>
      <View style={styles.valueWrap}>
        <TextInput
          ref={inputRef}
          value={display}
          onFocus={onFocus}
          onChangeText={setDraft}
          onBlur={onBlur}
          onSubmitEditing={() => inputRef.current?.blur()}
          keyboardType="decimal-pad"
          inputMode="decimal"
          returnKeyType="done"
          selectTextOnFocus
          style={styles.input}
        />
        {unit ? (
          draft === null ? (
            <Text variant="small" color={colors.inkMuted} style={styles.unit}>
              {unit}
            </Text>
          ) : null
        ) : null}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Increase" style={styles.btn} onPress={inc}>
        <Plus size={18} color={colors.ink} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  btn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  valueWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderStrong,
    gap: 6,
  },
  input: {
    ...typo.h2,
    color: colors.ink,
    textAlign: 'center',
    minWidth: 80,
    paddingVertical: 6,
  },
  unit: {
    paddingBottom: 8,
  },
});
