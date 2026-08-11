import { StyleSheet, View } from 'react-native';

import { WheelGroup } from './WheelGroup';
import { WheelPicker } from './WheelPicker';
import type { HeightUnit } from '../domain/units';
import { HEIGHT_BOUNDS, HEIGHT_REST } from '../stores/onboarding';

const INCHES_PER_FOOT = 12;
/** Wide enough for `7 ft` and `11 in` at the band's type size. */
const COLUMN_WIDTH = 88;

const FEET = range(
  Math.floor(HEIGHT_BOUNDS.in.min / INCHES_PER_FOOT),
  Math.floor(HEIGHT_BOUNDS.in.max / INCHES_PER_FOOT),
);
const INCHES = range(0, INCHES_PER_FOOT - 1);
const CENTIMETRES = range(HEIGHT_BOUNDS.cm.min, HEIGHT_BOUNDS.cm.max);

interface HeightPickerProps {
  unit: HeightUnit;
  /** Whole inches or whole centimetres, in `unit`. Null until the user answers. */
  value: number | null;
  onChange: (value: number) => void;
}

/**
 * Height as a wheel, in the unit the screen is set to.
 *
 * Centimetres are one number so they are one wheel. Inches are read as feet and
 * inches by everyone who reads them that way, so they are two wheels under one
 * band, and the pair covers 4 ft 0 in to 7 ft 11 in with no gap. The store keeps
 * the total in inches either way, which is what `domain/units` takes.
 */
export function HeightPicker({ unit, value, onChange }: HeightPickerProps) {
  if (unit === 'cm') {
    return (
      <WheelPicker
        values={CENTIMETRES}
        value={value}
        restValue={HEIGHT_REST.cm}
        onChange={onChange}
        format={(cm) => `${cm} cm`}
        accessibilityLabel="Height in centimetres"
      />
    );
  }

  // The wheels always show something, so they read the resting height while the
  // answer is null. `value` stays null until a finger settles a wheel.
  const shown = value ?? HEIGHT_REST.in;
  const feet = Math.floor(shown / INCHES_PER_FOOT);
  const inches = shown % INCHES_PER_FOOT;

  return (
    <WheelGroup>
      <View style={styles.column}>
        <WheelPicker
          bare
          values={FEET}
          value={value === null ? null : feet}
          restValue={Math.floor(HEIGHT_REST.in / INCHES_PER_FOOT)}
          onChange={(next) => onChange(next * INCHES_PER_FOOT + inches)}
          format={(next) => `${next} ft`}
          accessibilityLabel="Height in feet"
        />
      </View>
      <View style={styles.column}>
        <WheelPicker
          bare
          values={INCHES}
          value={value === null ? null : inches}
          restValue={HEIGHT_REST.in % INCHES_PER_FOOT}
          onChange={(next) => onChange(feet * INCHES_PER_FOOT + next)}
          format={(next) => `${next} in`}
          accessibilityLabel="Height in inches"
        />
      </View>
    </WheelGroup>
  );
}

function range(min: number, max: number): number[] {
  return Array.from({ length: max - min + 1 }, (_, index) => min + index);
}

const styles = StyleSheet.create({
  column: {
    width: COLUMN_WIDTH,
  },
});
