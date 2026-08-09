import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { WheelGroup } from './WheelGroup';
import { WheelPicker } from './WheelPicker';
import type { WeightUnit } from '../domain/units';
import { WEIGHT_BOUNDS } from '../stores/onboarding';
import { colors } from '../theme';

const TENTHS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
/** Wide enough for `600` and for `9` at the band's type size. */
const WHOLE_WIDTH = 92;
const TENTH_WIDTH = 44;

interface WeightPickerProps {
  unit: WeightUnit;
  /** In `unit`, to one decimal place. Null until the user answers. */
  value: number | null;
  /** The row the wheel rests on while `value` is null. */
  rest: number;
  onChange: (value: number) => void;
  accessibilityLabel: string;
}

/**
 * A weight as a wheel, to one decimal place.
 *
 * The whole number and the tenth are two wheels under one band, the way the hour
 * and the minute are on `InlineTimePicker`. A single wheel at 0.1 steps would be
 * five thousand rows and a scroll nobody can aim.
 */
export function WeightPicker({ unit, value, rest, onChange, accessibilityLabel }: WeightPickerProps) {
  const bounds = WEIGHT_BOUNDS[unit];
  const wholes = useMemo(
    () => Array.from({ length: bounds.max - bounds.min + 1 }, (_, index) => bounds.min + index),
    [bounds.max, bounds.min],
  );

  // The wheels always show something, so they read the resting weight while the
  // answer is null. `value` stays null until a finger settles a wheel.
  const shown = split(value ?? rest);
  const resting = split(rest);
  const combine = (whole: number, tenth: number) => Math.round(whole * 10 + tenth) / 10;

  return (
    <WheelGroup>
      <View style={styles.whole}>
        <WheelPicker
          key={unit}
          bare
          values={wholes}
          value={value === null ? null : shown.whole}
          restValue={resting.whole}
          onChange={(next) => onChange(combine(next, shown.tenth))}
          accessibilityLabel={accessibilityLabel}
        />
      </View>
      <Text variant="h2" color={colors.inkMuted}>.</Text>
      <View style={styles.tenth}>
        <WheelPicker
          key={unit}
          bare
          values={TENTHS}
          value={value === null ? null : shown.tenth}
          restValue={resting.tenth}
          onChange={(next) => onChange(combine(shown.whole, next))}
          accessibilityLabel={`${accessibilityLabel}, tenths`}
        />
      </View>
      <Text variant="h2" color={colors.inkMuted}>{unit}</Text>
    </WheelGroup>
  );
}

/**
 * The two rows that draw one weight. It multiplies before it splits, because
 * subtracting the whole part first leaves float dust: `60.4 - 60` is 0.3999...,
 * and flooring ten times that would park the tenths wheel on 3. Four in ten of
 * the weights this wheel can hold land the wrong way round that way.
 */
function split(value: number): { whole: number; tenth: number } {
  const tenths = Math.round(value * 10);
  return { whole: Math.floor(tenths / 10), tenth: tenths % 10 };
}

const styles = StyleSheet.create({
  whole: {
    width: WHOLE_WIDTH,
  },
  tenth: {
    width: TENTH_WIDTH,
  },
});
