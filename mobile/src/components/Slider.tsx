import { useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import type { AccessibilityActionEvent, LayoutChangeEvent } from 'react-native';

import { Text } from './Text';
import { colors, radius, spacing } from '../theme';

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  accessibilityLabel: string;
  /** Renders the ends of the track, and the accessibility value. */
  format: (value: number) => string;
}

const THUMB_SIZE = 36;

/** A continuous slider that snaps to `step`. Drag, or use the accessibility actions. */
export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  accessibilityLabel,
  format,
}: SliderProps) {
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const startXRef = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const clamp = (next: number) => Math.max(min, Math.min(max, next));
  const snap = (next: number) => clamp(Math.round(next / step) * step);

  const setFromX = (x: number) => {
    const usableWidth = Math.max(widthRef.current - THUMB_SIZE, 1);
    const centeredX = Math.max(0, Math.min(usableWidth, x - THUMB_SIZE / 2));
    onChangeRef.current(snap(min + (centeredX / usableWidth) * (max - min)));
  };

  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => {
      startXRef.current = event.nativeEvent.locationX;
      setFromX(startXRef.current);
    },
    onPanResponderMove: (_event, gesture) => {
      setFromX(startXRef.current + gesture.dx);
    },
  })).current;

  const onLayout = (event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    widthRef.current = nextWidth;
    setWidth(nextWidth);
  };

  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    const delta = event.nativeEvent.actionName === 'increment' ? step : -step;
    onChange(snap(value + delta));
  };

  const usableWidth = Math.max(width - THUMB_SIZE, 0);
  const span = max - min;
  const thumbLeft = span > 0 ? (usableWidth * (clamp(value) - min)) / span : 0;

  return (
    <View style={styles.root}>
      {/* A plain View, not a Pressable. `Pressable` renders
          `<View {...restProps} {...eventHandlers}>`, and those event handlers come
          from `usePressability`. They land after the spread panHandlers and
          overwrite `onStartShouldSetResponder` and `onResponderGrant`, so the
          PanResponder below never gets a grant and the slider does not move at all
          on a device. Do not put a Pressable back here. */}
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ min, max, now: value, text: format(value) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={onAccessibilityAction}
        onLayout={onLayout}
        style={styles.control}
        {...responder.panHandlers}
      >
        <View style={styles.track} />
        <View style={[styles.fill, { width: thumbLeft + THUMB_SIZE / 2 }]} />
        <View style={[styles.thumb, { left: thumbLeft }]} />
      </View>
      <View style={styles.labels}>
        <Text variant="caption" color={colors.inkMuted}>{format(min)}</Text>
        <Text variant="caption" color={colors.inkMuted}>{format(max)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.xs,
  },
  control: {
    height: 56,
    justifyContent: 'center',
  },
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
  },
  fill: {
    position: 'absolute',
    left: 0,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: 4,
    borderColor: colors.surface,
    backgroundColor: colors.accent,
    boxShadow: '0 4px 12px rgba(17,20,24,0.18)',
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
