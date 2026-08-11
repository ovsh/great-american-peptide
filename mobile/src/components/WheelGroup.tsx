import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { WHEEL_FRAME_HEIGHT, WHEEL_ITEM_HEIGHT } from './WheelPicker';
import { colors, radius, spacing } from '../theme';

/** The band sits on the middle row, so it starts half a frame less half a row down. */
const BAND_TOP = (WHEEL_FRAME_HEIGHT - WHEEL_ITEM_HEIGHT) / 2;

interface WheelGroupProps {
  children: ReactNode;
}

/**
 * The frame and the band for a set of `bare` wheels that read as one number.
 *
 * Feet and inches, or a weight and its tenth, are two wheels and one answer.
 * Two framed wheels side by side would draw two bands with a seam between them,
 * so the parent draws the one band across the whole row. `InlineTimePicker`
 * does the same thing for the hour and the minute.
 */
export function WheelGroup({ children }: WheelGroupProps) {
  return (
    <View style={styles.frame}>
      <View pointerEvents="none" style={styles.band} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    height: WHEEL_FRAME_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  band: {
    position: 'absolute',
    left: spacing.sm,
    right: spacing.sm,
    top: BAND_TOP,
    height: WHEEL_ITEM_HEIGHT,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
  },
});
