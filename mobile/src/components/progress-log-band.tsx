import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { Check, Scale } from 'lucide-react-native';

import { Text } from '@/components/Text';
import { usePressScale, useSwapTransition } from '@/components/today-motion';
import { colors, easing, motion, radius, spacing, timeTo } from '@/theme';
import { fmtTime } from '@/utils/date';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** quiet, solid, logged — the three tones the fill moves between. */
const TONE = [colors.surfaceMuted, colors.successDeep, colors.successSoft];
const EDGE = [colors.divider, 'rgba(17,20,24,0)', 'rgba(17,20,24,0)'];

export type ProgressBandKind = 'idle' | 'push' | 'done';

interface BandFace {
  kind: ProgressBandKind;
  time: string;
}

/**
 * The log action, at the foot of the journey card, in every state.
 *
 * Presence is not stateful; emphasis is. It is quiet while the curve has a
 * recent point, solid `successDeep` when the journey is waiting for its next
 * one, and soft green the moment a reading lands — still tappable, because a
 * second weigh-in happens.
 *
 * The fill never cuts: it interpolates between the three tones, so a logged
 * weight drains the solid green rather than replacing it.
 */
export function ProgressLogBand({ kind, loggedAt }: { kind: ProgressBandKind; loggedAt: number | null }) {
  const reduced = useReducedMotion();
  const face: BandFace = {
    kind,
    time: kind === 'done' && loggedAt !== null ? fmtTime(loggedAt).toLocaleLowerCase() : '',
  };
  const label = useSwapTransition(face, `${face.kind}:${face.time}`, {
    swapAt: motion.fast,
    axis: 'y',
    distance: 6,
  });

  const tone = useSharedValue(toneOf(kind));
  const press = usePressScale();

  useEffect(() => {
    tone.value = timeTo(toneOf(kind), {
      duration: motion.base,
      easing: easing.standard,
      reduced,
    });
  }, [kind, reduced, tone]);

  const bandStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(tone.value, [0, 1, 2], TONE),
    borderTopColor: interpolateColor(tone.value, [0, 1, 2], EDGE),
    transform: [{ scale: 1 - 0.03 * press.pressed.value }],
  }));

  return (
    <AnimatedPressable
      testID="progress-log-weight-action"
      accessibilityRole="button"
      accessibilityLabel={
        face.kind === 'done' ? `Weight logged ${face.time}. Log another weight` : 'Log weight'
      }
      onPress={() => router.push('/log-weight')}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={[styles.band, bandStyle]}
    >
      <Animated.View style={[styles.label, label.style]}>
        <BandFaceView face={label.shown} />
      </Animated.View>
    </AnimatedPressable>
  );
}

function BandFaceView({ face }: { face: BandFace }) {
  if (face.kind === 'done') {
    return (
      <>
        <View style={styles.tick}>
          <Check size={12} strokeWidth={2.6} color={colors.successDeep} />
        </View>
        <Text variant="smallStrong" color={colors.successDeep}>Logged {face.time}</Text>
      </>
    );
  }
  const solid = face.kind === 'push';
  return (
    <>
      <Scale size={19} color={solid ? colors.inkInverse : colors.successDeep} />
      <Text
        variant={solid ? 'bodyStrong' : 'smallStrong'}
        color={solid ? colors.inkInverse : colors.successDeep}
      >
        Log weight
      </Text>
    </>
  );
}

function toneOf(kind: ProgressBandKind): number {
  return kind === 'push' ? 1 : kind === 'done' ? 2 : 0;
}

const styles = StyleSheet.create({
  band: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  label: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tick: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
});
