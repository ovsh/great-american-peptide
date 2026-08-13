import { interpolate, useAnimatedStyle, useReducedMotion } from 'react-native-reanimated';
import { Rect, Text as SvgText } from 'react-native-svg';

import {
  AnimatedLine,
  Scene,
  SceneBase,
  SceneLayer,
  useCue,
  useDraw,
  useLift,
  useSceneFrame,
} from '@/components/onboarding/scene';
import { colors, easing, fonts, motion, rise } from '@/theme';

const VB_WIDTH = 264;
const VB_HEIGHT = 136;

const RULE_FROM = 62;
const RULE_TO = 202;
const RULE_LENGTH = RULE_TO - RULE_FROM;
/** How far the pace value lifts and drops again on its tick. */
const TICK = 4;

/**
 * The division, assembled in the order a person would write it.
 *
 * The screen's sentence says Poke divides the distance by the pace and prints
 * the date that falls on. The scene is that sentence with the user's own three
 * numbers in it: nothing is drawn that `planProjection` did not return, and
 * nothing lands under the rule line that is not the quotient.
 */
const dateMathBeats = {
  /** The distance, on top. */
  distance: 0,
  /** The rule line wipes across under it. */
  rule: motion.beat,
  /** The pace, underneath. */
  pace: 2 * motion.beat,
  /** The pace ticks once: the sum is live, and the plan screen's slider moves it. */
  tick: 4 * motion.beat,
  /** The date the division lands on, last. */
  date: 6 * motion.beat,
} as const;

export function DateMathScene({
  distance,
  pace,
  date,
}: {
  /** The distance left, already formatted with its unit. */
  distance: string;
  /** The weekly pace, already formatted as a phrase. */
  pace: string;
  /** The date the division lands on, already formatted. */
  date: string;
}) {
  const reduced = useReducedMotion();
  const frame = useSceneFrame(VB_WIDTH, VB_HEIGHT);

  const distanceCue = useCue(
    { delay: dateMathBeats.distance, duration: motion.base, easing: easing.out },
    reduced,
  );
  const ruleCue = useCue(
    { delay: dateMathBeats.rule, duration: motion.base, easing: easing.out },
    reduced,
  );
  const paceCue = useCue(
    { delay: dateMathBeats.pace, duration: motion.base, easing: easing.out },
    reduced,
  );
  const tickCue = useCue(
    { delay: dateMathBeats.tick, duration: motion.fast, easing: easing.standard },
    reduced,
  );
  const dateCue = useCue(
    { delay: dateMathBeats.date, duration: motion.base, easing: easing.out },
    reduced,
  );

  const distanceStyle = useLift(distanceCue, frame, rise.line);
  const dateStyle = useLift(dateCue, frame, rise.card);
  const ruleProps = useDraw(ruleCue, RULE_LENGTH);
  const stemProps = useDraw(dateCue, 8);

  // The pace both arrives and, two beats later, ticks. One style carries both,
  // because two transforms on one view is one place where they can disagree.
  const paceUnit = frame.unit;
  const paceStyle = useAnimatedStyle(() => {
    const arrive = (1 - paceCue.value) * rise.line;
    const tick = interpolate(tickCue.value, [0, 0.5, 1], [0, -TICK, 0]);
    return {
      opacity: Math.min(1, paceCue.value),
      transform: [{ translateY: (arrive + tick) * paceUnit }],
    };
  });

  return (
    <Scene
      frame={frame}
      label={`${distance} divided by ${pace} gives ${date}.`}
    >
      <SceneBase frame={frame}>
        <AnimatedLine
          animatedProps={ruleProps}
          x1={RULE_FROM}
          y1={54}
          x2={RULE_TO}
          y2={54}
          stroke={colors.ink}
          strokeOpacity={0.35}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeDasharray={RULE_LENGTH}
        />
        <AnimatedLine
          animatedProps={stemProps}
          x1={132}
          y1={86}
          x2={132}
          y2={94}
          stroke={colors.accent}
          strokeOpacity={0.45}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeDasharray={8}
        />
      </SceneBase>

      <SceneLayer
        frame={frame}
        box={{ x: 20, y: 14, width: 224, height: 32 }}
        style={distanceStyle}
      >
        <SvgText
          x={132}
          y={40}
          textAnchor="middle"
          fontSize={24}
          fontFamily={fonts.sansSemiBold}
          fill={colors.ink}
        >
          {distance}
        </SvgText>
      </SceneLayer>

      <SceneLayer
        frame={frame}
        box={{ x: 20, y: 58, width: 224, height: 26 }}
        style={paceStyle}
      >
        <SvgText
          x={132}
          y={77}
          textAnchor="middle"
          fontSize={15}
          fontFamily={fonts.sansMedium}
          fill={colors.inkMuted}
        >
          {pace}
        </SvgText>
      </SceneLayer>

      <SceneLayer
        frame={frame}
        box={{ x: 40, y: 96, width: 184, height: 36 }}
        style={dateStyle}
      >
        <Rect
          x={48}
          y={98}
          width={168}
          height={32}
          rx={16}
          fill={colors.successSoft}
          stroke={colors.accent}
          strokeOpacity={0.45}
          strokeWidth={1.25}
        />
        <SvgText
          x={132}
          y={119}
          textAnchor="middle"
          fontSize={15}
          fontFamily={fonts.sansSemiBold}
          fill={colors.successDeep}
        >
          {date}
        </SvgText>
      </SceneLayer>
    </Scene>
  );
}
