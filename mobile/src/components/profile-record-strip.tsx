import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';
import { format } from 'date-fns';

import { Text } from '@/components/Text';
import { colors, motion, spacing, springTo, springs } from '@/theme';

/** Thirteen weeks: one quarter of a routine, and the strip stays under a phone's width. */
export const RECORD_WEEKS = 13;

const BAR_WIDTH = 9;
const BAR_GAP = 3;
/** A week with no shot is still a week, so every bar starts from a stub. */
const BAR_BASE = 7;
const BAR_SPAN = 21;
const STRIP_HEIGHT = BAR_BASE + BAR_SPAN + 2;

/**
 * How far apart the bars grow.
 *
 * `draw` is the token for a picture drawing itself on arrival, once per mount,
 * and the week axis already splits it across its seven columns. This is the same
 * division across thirteen: `460 ÷ 13 = 35 ms`, so the strip finishes inside the
 * same 700 ms arrival budget the rest of the app keeps.
 */
const BAR_STEP = motion.draw / RECORD_WEEKS;

export interface ProfileRecord {
  /** Shots per week, oldest first. Always `RECORD_WEEKS` long. */
  weeks: readonly number[];
  total: number;
  /** The first shot inside the window, or null when there is none. */
  since: number | null;
}

/**
 * The picture Profile opens on: how many shots this person has taken, and the
 * shape of the thirteen weeks they took them in.
 *
 * It is the one thing on this screen nobody had to tap for, and the only mark
 * the screen draws. The last bar is the week running now, so it is short by
 * definition and is drawn in `successDeep` to say so rather than to read as a
 * bad week.
 *
 * A week with no shot is drawn as an ink stub, not a green one. A green mark on
 * this screen means a shot happened, and a green stub on an empty week would
 * claim one.
 */
export function ProfileRecordStrip({
  record,
  entered,
}: {
  record: ProfileRecord;
  entered: boolean;
}) {
  const { weeks, total, since } = record;
  const peak = weeks.reduce((high, value) => (value > high ? value : high), 0);
  const headline = total === 0
    ? 'No shots yet'
    : `${total} ${total === 1 ? 'shot' : 'shots'}`;
  const sinceLabel = since === null ? null : sinceDate(since);

  return (
    <View
      testID="profile-record-strip"
      accessible
      accessibilityLabel={sinceLabel === null ? headline : `${headline} since ${sinceLabel}`}
      style={styles.strip}
    >
      <View style={styles.name}>
        {/* The zero state drops a type step. "No shots yet" set at 28 px wraps
            onto a second line next to the bars, and a two-line headline turns the
            one calm thing on the screen into a paragraph. */}
        <Text variant={total === 0 ? 'h2' : 'display'} style={styles.count}>{headline}</Text>
        {sinceLabel === null ? null : (
          <Text variant="small" color={colors.inkMuted}>since {sinceLabel}</Text>
        )}
      </View>
      <View style={styles.bars}>
        {weeks.map((count, index) => (
          <RecordBar
            // The bars are a fixed-length window, so the index is the week.
            key={index}
            index={index}
            height={peak === 0 ? BAR_BASE : BAR_BASE + (count / peak) * BAR_SPAN}
            color={
              count === 0
                ? colors.borderStrong
                : index === weeks.length - 1
                  ? colors.successDeep
                  : colors.success
            }
            entered={entered}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * One week. It grows out of the baseline on the `settle` spring, on its own step
 * of the crossing, and never again: coming back to the tab does not replay it.
 *
 * Reduce motion draws it at its height in one frame, which is the whole picture
 * without the growth.
 */
function RecordBar({
  height,
  index,
  color,
  entered,
}: {
  height: number;
  index: number;
  color: string;
  entered: boolean;
}) {
  const reduced = useReducedMotion();
  const grow = useSharedValue(entered && reduced ? 1 : 0);
  const played = useRef(false);

  useEffect(() => {
    if (!entered || played.current) return;
    played.current = true;
    if (reduced) {
      grow.value = 1;
      return;
    }
    grow.value = springTo(1, { config: springs.settle, delay: index * BAR_STEP, reduced });
  }, [entered, grow, index, reduced]);

  // Scale, not height: a laid-out box may not animate its layout. A view scales
  // about its centre, so the translate before it puts the bottom edge back where
  // it was and the bar grows out of the baseline. `settle` overshoots by about
  // 4 %, which lifts the top and leaves the baseline where it stands.
  const animated = useAnimatedStyle(() => ({
    transform: [
      { translateY: (height * (1 - grow.value)) / 2 },
      { scaleY: grow.value },
    ],
  }));

  return <Animated.View style={[styles.bar, { height, backgroundColor: color }, animated]} />;
}

/** `since 14 May` reads as a date this year; an older one has to carry its year. */
function sinceDate(ms: number): string {
  const date = new Date(ms);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return format(date, sameYear ? 'MMM d' : 'MMM d, yyyy');
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.lg,
    paddingHorizontal: spacing.xs,
  },
  name: {
    flex: 1,
    minWidth: 0,
  },
  count: {
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: BAR_GAP,
    height: STRIP_HEIGHT,
  },
  bar: {
    width: BAR_WIDTH,
    borderRadius: 2.5,
  },
});
