import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import { Text } from './Text';
import { colors, radius, spacing } from '../theme';

/** One row, and the touch target minimum. Five rows fit in the frame. */
const ITEM_HEIGHT = 44;
const VISIBLE_ROWS = 5;
const EDGE_ROWS = (VISIBLE_ROWS - 1) / 2;
const FRAME_HEIGHT = ITEM_HEIGHT * VISIBLE_ROWS;

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
}

/**
 * A scrolling wheel. The row under the band is the answer, the way every iOS
 * picker works, so there is nothing to type and nothing to confirm.
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
}: WheelPickerProps<T>) {
  const scroller = useRef<ScrollView>(null);
  const selectedIndex = value === null ? -1 : values.indexOf(value);
  const [centerIndex, setCenterIndex] = useState(Math.max(0, selectedIndex));
  // The wheel scrolls itself to the current value once, when it first has a
  // height to scroll within. After that the finger owns the offset, so a
  // second scrollTo would fight the gesture.
  const placed = useRef(false);

  const settle = useCallback((offsetY: number) => {
    const index = Math.min(values.length - 1, Math.max(0, Math.round(offsetY / ITEM_HEIGHT)));
    const next = values[index];
    if (next !== undefined && next !== value) onChange(next);
  }, [onChange, value, values]);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    setCenterIndex((current) => (current === index ? current : index));
  };

  const onLayout = (event: LayoutChangeEvent) => {
    if (placed.current || event.nativeEvent.layout.height === 0) return;
    placed.current = true;
    scroller.current?.scrollTo({ y: Math.max(0, selectedIndex) * ITEM_HEIGHT, animated: false });
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
        onMomentumScrollEnd={(event) => settle(event.nativeEvent.contentOffset.y)}
        onScrollEndDrag={(event) => settle(event.nativeEvent.contentOffset.y)}
        contentContainerStyle={styles.content}
      >
        {values.map((item, index) => {
          const distance = Math.abs(index - centerIndex);
          return (
            <View key={String(item)} style={styles.row}>
              <Text
                variant={distance === 0 ? 'h2' : 'body'}
                align="center"
                color={distance === 0 ? colors.ink : colors.inkSubtle}
                style={distance > 1 ? styles.far : undefined}
              >
                {format(item)}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

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
