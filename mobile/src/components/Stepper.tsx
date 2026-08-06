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
  max?: number;
  format?: (v: number) => string;
  unit?: string;
}

export function Stepper({ value, onChange, step = 0.5, min = 0, max = 1000, format, unit }: StepperProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  const dec = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    onChange(Math.max(min, +(value - step).toFixed(2)));
  };
  const inc = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    onChange(Math.min(max, +(value + step).toFixed(2)));
  };

  const onFocus = () => {
    setDraft(String(value));
  };

  const onBlur = () => {
    if (draft !== null) {
      const n = parseFloat(draft.replace(',', '.'));
      if (!isNaN(n)) onChange(+Math.max(min, Math.min(max, n)).toFixed(2));
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
