import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { router } from 'expo-router';
import { Check, Syringe } from 'lucide-react-native';

import { Text } from '@/components/Text';
import { usePressScale, useSwapTransition } from '@/components/today-motion';
import type { DoseState } from '@/components/today-types';
import { getBodySite } from '@/domain/bodySites';
import { colors, easing, motion, radius, spacing, timeTo } from '@/theme';
import { fmtTime } from '@/utils/date';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type BandKind = 'idle' | 'due' | 'logged';
type BandFace = { kind: BandKind; time: string };

/** idle, due, logged — the three tones the fill moves between. */
const TONE = [colors.surfaceMuted, colors.successDeep, colors.successSoft];
const EDGE = [colors.divider, 'rgba(17,20,24,0)', 'rgba(17,20,24,0)'];

/**
 * The log action, at the foot of the hero card, in every state.
 *
 * The old band came and went with the schedule: due and unscheduled had one,
 * upcoming had none, so the one action the app is for disappeared on five days
 * out of seven. This one never leaves. Due today makes it solid green; a shot
 * already logged turns it soft and reports the time, and it still opens the log
 * screen, because a second shot is a thing that happens.
 *
 * Motion. The fill never cuts: it interpolates between the three tones, so a
 * logged shot drains the solid green rather than replacing it. The label is a
 * different sentence, so it swaps — out on `fast`, in on `base` from 6 px below,
 * with the words changed while nothing is on screen.
 */
export function TodayLogBand({
  dose,
  medicationId,
  medicationName,
}: {
  dose: DoseState;
  medicationId: string;
  medicationName: string;
}) {
  const reduced = useReducedMotion();
  const logged = dose.kind === 'loggedToday' ? dose.injection : null;
  const due = dose.kind === 'due';

  const face: BandFace = {
    kind: logged !== null ? 'logged' : due ? 'due' : 'idle',
    time: logged !== null ? fmtTime(logged.taken_at).toLocaleLowerCase() : '',
  };
  const label = useSwapTransition(face, `${medicationId}:${face.kind}:${face.time}`, {
    swapAt: motion.fast,
    axis: 'y',
    distance: 6,
  });

  const tone = useSharedValue(toneOf(face.kind));
  const press = usePressScale();

  useEffect(() => {
    tone.value = timeTo(toneOf(face.kind), {
      duration: motion.base,
      easing: easing.standard,
      reduced,
    });
  }, [face.kind, reduced, tone]);

  const bandStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(tone.value, [0, 1, 2], TONE),
    borderTopColor: interpolateColor(tone.value, [0, 1, 2], EDGE),
    transform: [{ scale: 1 - 0.03 * press.pressed.value }],
  }));

  return (
    <AnimatedPressable
      testID="today-log-shot-action"
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel(dose, medicationName)}
      onPress={() => router.push({ pathname: '/log-shot', params: { medicationId } })}
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
  if (face.kind === 'logged') {
    return (
      <>
        <View style={styles.tick}>
          <Check size={12} strokeWidth={2.6} color={colors.successDeep} />
        </View>
        <Text variant="smallStrong" color={colors.successDeep}>
          Logged {face.time}
        </Text>
      </>
    );
  }
  const solid = face.kind === 'due';
  return (
    <>
      <Syringe size={19} color={solid ? colors.inkInverse : colors.successDeep} />
      <Text
        variant={solid ? 'bodyStrong' : 'smallStrong'}
        color={solid ? colors.inkInverse : colors.successDeep}
      >
        Log shot
      </Text>
    </>
  );
}

function toneOf(kind: BandKind): number {
  return kind === 'due' ? 1 : kind === 'logged' ? 2 : 0;
}

function accessibilityLabel(dose: DoseState, medicationName: string): string {
  if (dose.kind === 'loggedToday') {
    const site = dose.injection.site_id ? getBodySite(dose.injection.site_id) : undefined;
    const where = site ? `, ${site.label.toLocaleLowerCase()}` : '';
    return `${medicationName} logged ${fmtTime(dose.injection.taken_at).toLocaleLowerCase()}${where}. Log another shot`;
  }
  if (dose.kind === 'due') return `Log ${medicationName} shot, due today`;
  return `Log ${medicationName} shot`;
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
