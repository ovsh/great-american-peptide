import { useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, View } from 'react-native';
import type { AccessibilityActionEvent, LayoutChangeEvent } from 'react-native';

import { Text } from './Text';
import { colors, radius, spacing } from '../theme';

interface SeveritySliderProps {
  value: number;
  onChange: (value: number) => void;
}

const MIN = 0;
const MAX = 10;
const THUMB_SIZE = 36;

export function SeveritySlider({ value, onChange }: SeveritySliderProps) {
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const startXRef = useRef(0);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  valueRef.current = value;
  onChangeRef.current = onChange;

  const setFromX = (x: number) => {
    const usableWidth = Math.max(widthRef.current - THUMB_SIZE, 1);
    const centeredX = Math.max(0, Math.min(usableWidth, x - THUMB_SIZE / 2));
    onChangeRef.current(Math.round(MIN + centeredX / usableWidth * (MAX - MIN)));
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
    const delta = event.nativeEvent.actionName === 'increment' ? 1 : -1;
    onChange(Math.max(MIN, Math.min(MAX, value + delta)));
  };

  const usableWidth = Math.max(width - THUMB_SIZE, 0);
  const thumbLeft = usableWidth * (value - MIN) / (MAX - MIN);

  return (
    <View style={styles.root}>
      <Pressable
        accessibilityRole="adjustable"
        accessibilityLabel="Severity"
        accessibilityValue={{ min: MIN, max: MAX, now: value, text: `${value} of ${MAX}` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={onAccessibilityAction}
        onLayout={onLayout}
        style={styles.control}
        {...responder.panHandlers}
      >
        <View style={styles.track} />
        <View style={[styles.fill, { width: thumbLeft + THUMB_SIZE / 2 }]} />
        <View style={[styles.thumb, { left: thumbLeft }]} />
      </Pressable>
      <View style={styles.labels}>
        <Text variant="caption" color={colors.inkMuted}>0</Text>
        <Text variant="caption" color={colors.inkMuted}>5</Text>
        <Text variant="caption" color={colors.inkMuted}>10</Text>
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
    backgroundColor: 'rgba(139,123,216,0.18)',
  },
  fill: {
    position: 'absolute',
    left: 0,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.violet,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: 4,
    borderColor: colors.surface,
    backgroundColor: colors.violet,
    boxShadow: '0 4px 12px rgba(17,20,24,0.18)',
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
