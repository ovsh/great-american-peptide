import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';

import { Text } from './Text';
import { WHEEL_FRAME_HEIGHT, WHEEL_ITEM_HEIGHT, WheelPicker } from './WheelPicker';
import type { Unit } from '../domain/peptides';
import { colors, radius, spacing, springs, springTo } from '../theme';

/** The band sits on the middle row, so it starts half a frame less half a row down. */
const BAND_TOP = (WHEEL_FRAME_HEIGHT - WHEEL_ITEM_HEIGHT) / 2;

const UNITS: readonly Unit[] = ['mg', 'mcg', 'iu'];

/**
 * The row that means the user has not answered yet.
 *
 * A wheel always shows whatever sits under the band, so a dose wheel that opened
 * on a number would propose one, and `store.config.json` `review.notes` tells
 * App Review that Poke never proposes a dose. The first row is therefore not a
 * dose at all: it says the field is empty, in words, which is also what an empty
 * state owes the reader. Nothing reaches the draft while it is selected, so
 * Continue stays off until the user has really picked a number.
 */
const NO_DOSE = -1;

/**
 * How far each unit's wheel runs.
 *
 * `log-shot` guards a typed number at 1000 mg / 20000 mcg / 20000 iu, but that
 * ceiling exists to catch a runaway digit on a keypad and there is no keypad
 * here. A wheel has a second limit the keypad never had: it must stay aimable.
 * `WeightPicker` already refuses a five-thousand-row wheel for the same reason,
 * and about five hundred rows is the most this app ships. These tops cover every
 * dose the preset library is written in — NAD+ at 100 mg, exenatide at 250 mcg,
 * an HCG vial in the thousands of iu — inside that budget. A dose above the top
 * is still typed in Medications, where the stepper takes a number.
 */
const WHEEL_TOP: Record<Unit, number> = {
  mg: 100,
  mcg: 10_000,
  iu: 5_000,
};

/**
 * The gap between one row and the next.
 *
 * The first three rungs are the `log-shot` stepper's own increments, unchanged:
 * 25 for mcg, 0.05 below one unit, 0.1 from one unit up. The stepper stops
 * there because a keypad carries it the rest of the way, and a wheel has no
 * keypad to fall back on: at 0.1 a step, an HCG dose in the thousands is tens of
 * thousands of rows. So the ladder keeps going in the same direction it was
 * already going, coarser as the number grows, and its last rung is the 25 the
 * stepper itself uses for a unit whose doses run in hundreds.
 *
 * The 0.1 rung runs to 20 rather than to 10, because 12.5 mg is a real
 * tirzepatide dose and a whole-milligram rung would put it off the wheel.
 */
function doseStep(value: number, unit: Unit): number {
  if (unit === 'mcg') return 25;
  if (value < 1) return 0.05;
  if (value < 20) return 0.1;
  if (value < 100) return 1;
  return 25;
}

/** Every dose one unit's wheel offers, smallest first. */
export function doseWheelValues(unit: Unit): number[] {
  const rows: number[] = [];
  const top = WHEEL_TOP[unit];
  let value = 0;
  while (value < top) {
    // Two decimals on every step, so twenty additions of 0.05 land on 1 and not
    // on 1.0000000000000002. An unrounded row would never match a stored dose.
    value = +(value + doseStep(value, unit)).toFixed(2);
    rows.push(value);
  }
  return rows;
}

/**
 * A dose as the wheel prints it: whole micrograms, two decimals below a
 * milligram, one above. The decimals are `log-shot`'s own rule and the whole
 * micrograms are `formatAmount`'s, so one dose reads the same everywhere.
 */
export function formatDose(value: number, unit: Unit): string {
  if (unit === 'mcg') return String(Math.round(value));
  return value < 1 ? value.toFixed(2) : value.toFixed(1);
}

interface DoseWheelProps {
  /** The draft's dose, as stored. Empty until the user settles the wheel. */
  doseText: string;
  unit: Unit;
  onChangeDose: (doseText: string) => void;
  onChangeUnit: (unit: Unit) => void;
  accessibilityLabel: string;
}

/**
 * The dose, as a wheel and three unit chips under one band.
 *
 * The layout is `InlineTimePicker`'s: a bare wheel plus a column of chips inside
 * one frame, so the unit reads as part of the same answer rather than as a
 * second question. Nothing here opens a keyboard.
 */
export function DoseWheel({
  doseText,
  unit,
  onChangeDose,
  onChangeUnit,
  accessibilityLabel,
}: DoseWheelProps) {
  const reduced = useReducedMotion();
  const parsed = Number.parseFloat(doseText);
  const dose = Number.isFinite(parsed) && parsed > 0 ? parsed : null;

  const rows = useMemo(() => doseWheelValues(unit), [unit]);
  /**
   * A saved dose the current unit's ladder does not land on — the user picked
   * 1.5 mg and then switched the unit, or an older build wrote the number. It
   * gets a row of its own rather than being rounded away, the way the log sheet
   * lifts its own ceiling for a medication whose dose sits above it.
   */
  const offGrid = dose !== null && !rows.includes(dose) ? dose : null;
  const values = useMemo(() => {
    const list = offGrid === null ? rows : [...rows, offGrid].sort((a, b) => a - b);
    return [NO_DOSE, ...list];
  }, [offGrid, rows]);

  /**
   * The one moment on this screen: the band springs as the wheel locks a value.
   * It runs on a change of the answer, never on arrival, and it collapses to the
   * end state when the OS asks for less motion.
   */
  const lock = useSharedValue(1);
  useEffect(() => {
    if (dose === null) return;
    lock.value = 0.94;
    lock.value = springTo(1, { config: springs.settle, reduced });
  }, [dose, lock, reduced]);
  const bandStyle = useAnimatedStyle(() => ({ transform: [{ scale: lock.value }] }));

  return (
    <View style={styles.picker}>
      <View style={styles.wheels}>
        <Animated.View pointerEvents="none" style={[styles.band, bandStyle]} />
        <View style={styles.column}>
          <WheelPicker
            bare
            values={values}
            value={dose ?? NO_DOSE}
            onChange={(next) => onChangeDose(next === NO_DOSE ? '' : String(next))}
            format={(value) => (value === NO_DOSE ? 'No dose' : formatDose(value, unit))}
            accessibilityLabel={accessibilityLabel}
          />
        </View>
      </View>
      <View style={styles.units}>
        {UNITS.map((option) => {
          const selected = option === unit;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={option}
              onPress={() => onChangeUnit(option)}
              style={[styles.unit, selected && styles.unitSelected]}
            >
              <Text variant="smallStrong" color={selected ? colors.inkInverse : colors.inkMuted}>
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  wheels: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: BAND_TOP,
    height: WHEEL_ITEM_HEIGHT,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
  },
  column: {
    width: 132,
  },
  units: {
    gap: spacing.xs,
  },
  unit: {
    minWidth: 56,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  unitSelected: {
    backgroundColor: colors.accent,
  },
});
