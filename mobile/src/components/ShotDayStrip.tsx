import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';

import { Text } from './Text';
import { WEEKDAY_OPTIONS, type Weekday } from '../domain/scheduling';
import { colors, radius, spacing, springs, springTo } from '../theme';

interface ShotDayStripProps {
  /**
   * Every day the schedule lands on. Twice a week fills two of them, and both
   * fill the same way: a day the domain worked out is still a shot day, and a
   * strip that drew it faintly would need a sentence to explain the difference.
   */
  days: readonly Weekday[];
  /** Moves the day the schedule counts from. Any day on the strip accepts it. */
  onPick: (day: Weekday) => void;
  /**
   * How many days the strip can hold. `one` is a choice between seven days, and
   * `many` is a set the user builds a day at a time. It changes only what the
   * screen reader says: the fill already draws as many days as it is given.
   */
  selection?: 'one' | 'many';
  accessibilityLabel: string;
}

/**
 * The week, with the shot days filled in.
 *
 * The strip is the answer. Nothing under it names the days in prose, because the
 * two green discs already do, and a caption that repeats a visual is the caption
 * this screen deleted.
 */
export function ShotDayStrip({ days, onPick, selection = 'one', accessibilityLabel }: ShotDayStripProps) {
  const reduced = useReducedMotion();

  return (
    <View
      // React Native has no group role, and radiogroup would promise a choice of
      // one. A set of checkboxes under a labelled container says it plainly.
      accessibilityRole={selection === 'many' ? undefined : 'radiogroup'}
      accessibilityLabel={accessibilityLabel}
      style={styles.row}
    >
      {WEEKDAY_OPTIONS.map((day) => (
        <DayDot
          key={day.value}
          // One letter, the way the week axis on Today writes a day. Two of them
          // repeat, so the spoken label carries the whole name.
          letter={day.shortLabel.slice(0, 1)}
          name={day.label}
          selected={days.includes(day.value)}
          selection={selection}
          reduced={reduced}
          onPress={() => onPick(day.value)}
        />
      ))}
    </View>
  );
}

/**
 * One day. The fill springs in on `pop` and drains out on `settle`, so a day
 * that stops being a shot day is seen leaving rather than cut.
 */
function DayDot({
  letter,
  name,
  selected,
  selection,
  reduced,
  onPress,
}: {
  letter: string;
  name: string;
  selected: boolean;
  selection: 'one' | 'many';
  reduced: boolean;
  onPress: () => void;
}) {
  // Whatever the day already is, on arrival. Arrival is not the moment.
  const on = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    on.value = springTo(selected ? 1 : 0, {
      config: selected ? springs.pop : springs.settle,
      reduced,
    });
  }, [on, reduced, selected]);

  // A spring overshoots, and an opacity above 1 is not a value, so the fill
  // carries the overshoot in its scale and clamps its opacity.
  const discStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, on.value)),
    transform: [{ scale: 0.7 + on.value * 0.3 }],
  }));
  const onLetter = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, on.value)) }));
  const offLetter = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, 1 - on.value)) }));

  return (
    <Pressable
      accessibilityRole={selection === 'many' ? 'checkbox' : 'radio'}
      // The state is for a phone, the ARIA prop is for the web build.
      // react-native-web drops `accessibilityState` and reads `aria-*`.
      accessibilityState={selection === 'many' ? { checked: selected } : { selected }}
      aria-checked={selected}
      accessibilityLabel={name}
      onPress={onPress}
      style={styles.day}
    >
      <Animated.View pointerEvents="none" style={[styles.disc, discStyle]} />
      <Animated.View pointerEvents="none" style={[styles.letter, offLetter]}>
        <Text variant="smallStrong" color={colors.inkMuted}>{letter}</Text>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.letter, onLetter]}>
        <Text variant="smallStrong" color={colors.inkInverse}>{letter}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  day: {
    flex: 1,
    // A round day on a phone, a short pill on a tablet. The cap keeps seven of
    // them from stretching into buttons on the wide layout.
    maxWidth: 52,
    height: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  disc: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  letter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
