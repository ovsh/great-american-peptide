import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import { Text } from './Text';
import { colors, radius, spacing } from '../theme';

/** One row, and the touch target minimum. Five rows fit in the frame. */
const ITEM_HEIGHT = 44;
const VISIBLE_ROWS = 5;
const EDGE_ROWS = (VISIBLE_ROWS - 1) / 2;
const FRAME_HEIGHT = ITEM_HEIGHT * VISIBLE_ROWS;

/**
 * How long the web wheel waits after the last scroll event before it takes the
 * row under the band as the answer.
 *
 * react-native-web forwards `onMomentumScrollEnd` and `onScrollEndDrag` from
 * props, and the DOM has no event that fires either one, so on web they never
 * arrive and the wheel would never report anything. `scroll` does arrive, and it
 * keeps arriving through the snap animation, so quiet means stopped. Long enough
 * to sit out a snap, short enough that the answer is there before the thumb
 * reaches Continue.
 *
 * A quiet scroll only counts once the user has moved this wheel. See
 * `WEB_GESTURES`.
 */
const WEB_SETTLE_MS = 150;

/**
 * The web events that mean a person moved the wheel.
 *
 * The DOM fires one `scroll` event for a finger and for the wheel placing
 * itself, so a settle driven by `scroll` alone settles the placement too, and
 * the screen opens holding an answer nobody gave. None of these four fire for a
 * programmatic scroll, so they separate the two. `pointerdown` covers a drag of
 * the scrollbar and `keydown` covers the arrow keys, which move a scroller
 * without either a wheel or a touch.
 */
const WEB_GESTURES = ['wheel', 'touchmove', 'pointerdown', 'keydown'] as const;

/**
 * What `ScrollView` exposes on web, written out here because React Native has no
 * type for it and this project has no DOM types.
 */
interface WebScrollNode {
  getScrollableNode?: () => {
    addEventListener: (type: string, listener: () => void, options?: { passive: boolean }) => void;
    removeEventListener: (type: string, listener: () => void) => void;
  } | null;
}

/** For a parent that draws the band itself. See the `bare` prop. */
export const WHEEL_ITEM_HEIGHT = ITEM_HEIGHT;
export const WHEEL_FRAME_HEIGHT = FRAME_HEIGHT;

interface WheelPickerProps<T extends string | number> {
  values: readonly T[];
  value: T | null;
  onChange: (value: T) => void;
  format?: (value: T) => string;
  accessibilityLabel: string;
  /**
   * Drops the frame and the band, for a wheel that sits beside another one.
   * Two wheels in a row need one band across both, and the parent is the only
   * thing that can draw it. `InlineTimePicker` does exactly that.
   */
  bare?: boolean;
  /**
   * Where the wheel sits while `value` is null. Row zero is the bottom of the
   * range, and 4 ft 0 in is nobody's opening guess at their own height, so a
   * wheel that can open unanswered says where to open instead.
   *
   * This is a resting position and not an answer: the wheel writes nothing
   * until the finger settles it, so `canContinue` stays false until the user
   * has actually chosen. Leave it out and the wheel opens on row zero.
   */
  restValue?: T;
}

/**
 * A scrolling wheel. The row under the band is the answer, the way every iOS
 * picker works, so there is nothing to type and nothing to confirm.
 *
 * A visible row is also a target: tapping one brings it under the band, the way
 * a tap works on a native picker. The `Pressable` goes on the row, inside the
 * scroll view, where a drag still reaches the scroll view and scrolls it.
 *
 * The scroll view owns the gesture. Do not wrap it in a `Pressable` and do not
 * spread a PanResponder onto it: `Pressable` renders
 * `<View {...restProps} {...eventHandlers}>` and its own responder handlers win.
 * `Slider.tsx` carries the same warning for the same reason.
 */
export function WheelPicker<T extends string | number>({
  values,
  value,
  onChange,
  format = (item) => String(item),
  accessibilityLabel,
  bare = false,
  restValue,
}: WheelPickerProps<T>) {
  const scroller = useRef<ScrollView>(null);
  const selectedIndex = value === null ? -1 : values.indexOf(value);
  const restIndex = restValue === undefined ? 0 : Math.max(0, values.indexOf(restValue));
  // The answer when there is one, the resting row when there is not.
  const openIndex = selectedIndex >= 0 ? selectedIndex : restIndex;
  const [centerIndex, setCenterIndex] = useState(openIndex);
  // The wheel scrolls itself to its opening row once, when it first has a height
  // to scroll within. After that the finger owns the offset, so a second
  // scrollTo would fight the gesture.
  const placed = useRef(false);
  /**
   * Whether a finger has ever moved this wheel.
   *
   * The wheel scrolls itself to its opening row, and on iOS that placement comes
   * back through `onMomentumScrollEnd` looking exactly like the end of a fling.
   * A wheel that can open unanswered then took its own resting row as the
   * answer: the height and the weight screens enabled Continue before anybody
   * touched them, and the plan card drew a BMI and a distance from numbers
   * nobody had given. Nothing settles until this is true. `onScrollBeginDrag`
   * sets it on native, `WEB_GESTURES` sets it on web, and a tap on a row sets it
   * because a tap is an answer too.
   */
  const gestured = useRef(false);
  const webSettle = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (webSettle.current) clearTimeout(webSettle.current);
  }, []);

  const place = () => {
    if (placed.current) return;
    placed.current = true;
    scroller.current?.scrollTo({ y: openIndex * ITEM_HEIGHT, animated: false });
  };

  /**
   * Web only: place the wheel without waiting to be measured.
   *
   * `onLayout` reaches react-native-web through a ResizeObserver, and a browser
   * delivers nothing to that observer while the page is hidden, so a wheel in a
   * background tab opened on row zero and stayed there. There is nothing to
   * measure here in the first place: the rows are a fixed height inside a fixed
   * frame, and by the time a layout effect runs the node is scrollable.
   */
  useLayoutEffect(() => {
    if (Platform.OS !== 'web') return;
    place();
    // Mount only. After the placement the finger owns the offset.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Web only. See `WEB_GESTURES`.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = (scroller.current as unknown as WebScrollNode | null)?.getScrollableNode?.();
    if (!node) return;
    const mark = () => {
      gestured.current = true;
    };
    WEB_GESTURES.forEach((name) => node.addEventListener(name, mark, { passive: true }));
    return () => WEB_GESTURES.forEach((name) => node.removeEventListener(name, mark));
  }, []);

  const settle = useCallback((offsetY: number) => {
    if (!gestured.current) return;
    const index = Math.min(values.length - 1, Math.max(0, Math.round(offsetY / ITEM_HEIGHT)));
    const next = values[index];
    if (next !== undefined && next !== value) onChange(next);
  }, [onChange, value, values]);

  /**
   * A tap on a row rather than a drag to it. `centerIndex` moves first so the
   * effect below sees the wheel already on the row and leaves the animation
   * alone, instead of cutting it short with an instant scroll.
   *
   * A tap on the row already under the band is an answer as much as a tap on any
   * other row, so an untouched wheel takes one tap to confirm what it shows.
   */
  const selectRow = useCallback((index: number) => {
    const next = values[index];
    if (next === undefined) return;
    gestured.current = true;
    setCenterIndex(index);
    scroller.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: true });
    if (next !== value) onChange(next);
  }, [onChange, value, values]);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const index = Math.round(offsetY / ITEM_HEIGHT);
    setCenterIndex((current) => (current === index ? current : index));
    // On web the scroll is the only signal there is, so a wheel the user has
    // moved settles when its scroll goes quiet. See `WEB_SETTLE_MS`.
    if (Platform.OS !== 'web' || !gestured.current) return;
    if (webSettle.current) clearTimeout(webSettle.current);
    webSettle.current = setTimeout(() => settle(offsetY), WEB_SETTLE_MS);
  };

  const onLayout = (event: LayoutChangeEvent) => {
    if (event.nativeEvent.layout.height === 0) return;
    place();
  };

  // A value set from outside the wheel, such as Back arriving with an answer
  // already in the store, still has to move the wheel to it.
  useEffect(() => {
    if (!placed.current || selectedIndex < 0 || selectedIndex === centerIndex) return;
    scroller.current?.scrollTo({ y: selectedIndex * ITEM_HEIGHT, animated: false });
    // `centerIndex` is deliberately absent: this runs when the answer changes,
    // not on every frame of a scroll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex]);

  return (
    <View style={[styles.frame, bare && styles.frameBare]}>
      {bare ? null : <View pointerEvents="none" style={styles.band} />}
      <ScrollView
        ref={scroller}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ text: value === null ? undefined : format(value) }}
        onLayout={onLayout}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={onScroll}
        // The one native event a programmatic scroll cannot raise. See `gestured`.
        onScrollBeginDrag={() => {
          gestured.current = true;
        }}
        onMomentumScrollEnd={(event) => settle(event.nativeEvent.contentOffset.y)}
        onScrollEndDrag={(event) => settle(event.nativeEvent.contentOffset.y)}
        contentContainerStyle={styles.content}
      >
        {values.map((item, index) => (
          <Row
            key={String(item)}
            index={index}
            label={format(item)}
            tier={rowTier(Math.abs(index - centerIndex))}
            onSelect={selectRow}
          />
        ))}
      </ScrollView>
    </View>
  );
}

/**
 * A row draws in one of three ways, so it re-renders only when it moves between
 * the three. A weight wheel carries five hundred rows and every scroll frame
 * moves the centre, and re-rendering all five hundred of them per frame drops
 * the scroll. Six rows change tier per step. Those six are the work.
 */
type RowTier = 0 | 1 | 2;

function rowTier(distance: number): RowTier {
  if (distance === 0) return 0;
  return distance === 1 ? 1 : 2;
}

const Row = memo(function Row({
  index,
  label,
  tier,
  onSelect,
}: {
  index: number;
  label: string;
  tier: RowTier;
  onSelect: (index: number) => void;
}) {
  return (
    // `index` and `onSelect` are both stable for the life of a row, so the memo
    // still holds and a scroll frame re-renders only the six rows that changed
    // tier. A closure built here per render would re-render all of them.
    <Pressable onPress={() => onSelect(index)} style={styles.row}>
      <Text
        variant={tier === 0 ? 'h2' : 'body'}
        align="center"
        color={tier === 0 ? colors.ink : colors.inkSubtle}
        style={tier === 2 ? styles.far : undefined}
      >
        {label}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  frame: {
    height: FRAME_HEIGHT,
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  frameBare: {
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  band: {
    position: 'absolute',
    left: spacing.sm,
    right: spacing.sm,
    top: ITEM_HEIGHT * EDGE_ROWS,
    height: ITEM_HEIGHT,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
  },
  content: {
    paddingVertical: ITEM_HEIGHT * EDGE_ROWS,
  },
  row: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
  },
  far: {
    opacity: 0.45,
  },
});
