import {
  interpolate,
  useAnimatedProps,
  useDerivedValue,
  useReducedMotion,
} from 'react-native-reanimated';
import {
  Circle,
  Defs,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import {
  AnimatedCircle,
  AnimatedEllipse,
  AnimatedLine,
  AnimatedPath,
  Scene,
  SceneBase,
  SceneLayer,
  useCue,
  useDraw,
  useFade,
  usePop,
  useSceneFrame,
} from '@/components/onboarding/scene';
import { colors, easing, fonts, motion, springs } from '@/theme';

const VB_WIDTH = 264;
const VB_HEIGHT = 206;

/** One dose: a fast rise and a long fall. The shape is the prototype's, unchanged. */
const CURVE = 'M26,192 C36,188 46,120 60,84 C66,68 72,58 82,58 C96,58 106,86 122,112 C140,141 168,160 200,168 C220,173 236,175 250,176';
const AREA = `${CURVE} L250,192 L26,192 Z`;
/** Measured off the path above by flattening it. The stroke draws over this much. */
const CURVE_LENGTH = 368.4;
/** From the peak up to the source pill. */
const LEADER = 'M106,47 L89,55';
const LEADER_LENGTH = 18.8;

const GUIDE_Y = 125;
const GUIDE_FROM = 26;
const GUIDE_TO = 254;
const GROUND_RISE = 6;

/**
 * The tip rides the curve, sampled at equal arc length.
 *
 * The prototype puts the tip on an `offset-path` carrying the identical curve
 * data, which has no counterpart here. Equal arc length is the same promise by
 * another route: the stroke's dash offset also retreats at a constant rate per
 * unit of length, so the tip and the end of the stroke stay on top of each
 * other for the whole draw.
 */
const TIP_X = [26, 30.59, 33.41, 35.73, 37.78, 39.78, 41.67, 43.5, 45.29, 47.21, 49.09, 51.02, 53.09, 55.32, 57.73, 60.41, 63.31, 66.81, 71.39, 77.76, 85.29, 91.72, 96.68, 100.97, 104.85, 108.55, 112.2, 115.93, 119.76, 123.79, 128.14, 132.98, 138.13, 143.59, 149.34, 155.55, 161.83, 168.55, 175.29, 182.46, 189.59, 196.89, 204.43, 211.95, 219.48, 227, 234.71, 242.34, 249.89];
const TIP_Y = [192, 186.05, 178.95, 171.64, 164.4, 156.78, 149.34, 141.93, 134.68, 126.99, 119.66, 112.41, 104.99, 97.54, 90.21, 82.93, 75.86, 68.99, 62.82, 58.66, 58.52, 62.6, 68.36, 74.79, 81.42, 88.14, 94.87, 101.63, 108.28, 114.8, 121, 127.06, 132.75, 138.07, 143.02, 147.73, 151.92, 155.83, 159.24, 162.35, 164.96, 167.19, 169.08, 170.74, 172.21, 173.46, 174.53, 175.36, 175.99];
const TIP_AT = TIP_X.map((_, index) => index / (TIP_X.length - 1));

/**
 * The curve drawing itself, then naming where its shape came from.
 *
 * Nothing here claims anything the app does not already do: the guide crosses
 * at the half level because that is what a half-life is, and the two pills are
 * the two things `domain/peptides.ts` records about every preset — the tier its
 * half-life comes from, and whether the number is a measurement or an estimate.
 */
const halfLifeBeats = {
  /** The axis and the baseline rise, and the curve starts drawing with its tip. */
  ground: 0,
  /** The area and the bloom fade up; the peak mark pops as the tip clears it. */
  peak: motion.beat,
  /** The amber half-life guide wipes across. */
  guide: 2 * motion.beat,
  /** The half marker pops where the curve meets the guide. */
  half: 3 * motion.beat,
  /** The tip leaves. */
  tipOut: 5 * motion.beat,
  /** The source pill pops and its leader draws back to the peak. */
  source: 7 * motion.beat,
  /**
   * The estimate pill, last. A `fast` pop rather than a spring, because 520 +
   * 150 is the 670 ms last frame `motion.md` rule 3 allows an arrival.
   */
  estimate: 8 * motion.beat,
} as const;

export function HalfLifeScene({ source }: { source: string | null }) {
  const reduced = useReducedMotion();
  const frame = useSceneFrame(VB_WIDTH, VB_HEIGHT);

  const ground = useCue({ delay: halfLifeBeats.ground, duration: motion.base, easing: easing.out }, reduced);
  const draw = useCue({ delay: halfLifeBeats.ground, duration: motion.draw, easing: easing.out }, reduced);
  const tipIn = useCue({ delay: halfLifeBeats.ground, duration: motion.press, easing: easing.out }, reduced);
  const tipOut = useCue({ delay: halfLifeBeats.tipOut, duration: motion.fast, easing: easing.in }, reduced);
  const bloom = useCue({ delay: halfLifeBeats.peak, duration: motion.slow, easing: easing.out }, reduced);
  const peakPop = useCue({ delay: halfLifeBeats.peak, spring: springs.pop }, reduced);
  const guide = useCue({ delay: halfLifeBeats.guide, duration: motion.slow, easing: easing.out }, reduced);
  const half = useCue({ delay: halfLifeBeats.half, spring: springs.pop }, reduced);
  const leader = useCue({ delay: halfLifeBeats.source, duration: motion.fast, easing: easing.out }, reduced);
  const sourcePop = useCue({ delay: halfLifeBeats.source, spring: springs.pop }, reduced);
  const estimatePop = useCue(
    { delay: halfLifeBeats.estimate, duration: motion.fast, easing: easing.out },
    reduced,
  );

  const axisProps = useAnimatedProps(() => ({
    opacity: ground.value,
    y1: 46 + GROUND_RISE * (1 - ground.value),
    y2: 192 + GROUND_RISE * (1 - ground.value),
  }));
  const baseProps = useAnimatedProps(() => ({
    opacity: ground.value,
    y1: 192 + GROUND_RISE * (1 - ground.value),
    y2: 192 + GROUND_RISE * (1 - ground.value),
  }));
  const strokeProps = useDraw(draw, CURVE_LENGTH);
  const areaProps = useFade(bloom);
  const guideProps = useAnimatedProps(() => ({
    opacity: guide.value,
    x2: GUIDE_FROM + (GUIDE_TO - GUIDE_FROM) * guide.value,
  }));
  const haloProps = useAnimatedProps(() => ({ r: 11 * peakPop.value }));
  const markProps = useAnimatedProps(() => ({ r: 4.5 * peakPop.value }));
  const leaderProps = useDraw(leader, LEADER_LENGTH);

  const tipX = useDerivedValue(() => interpolate(draw.value, TIP_AT, TIP_X));
  const tipY = useDerivedValue(() => interpolate(draw.value, TIP_AT, TIP_Y));
  const tipAlpha = useDerivedValue(() => tipIn.value * (1 - tipOut.value));
  const tipGlowProps = useAnimatedProps(() => ({ cx: tipX.value, cy: tipY.value, opacity: tipAlpha.value }));
  const tipSoftProps = useAnimatedProps(() => ({ cx: tipX.value, cy: tipY.value, opacity: tipAlpha.value }));
  const tipCoreProps = useAnimatedProps(() => ({ cx: tipX.value, cy: tipY.value, opacity: tipAlpha.value }));

  const halfStyle = usePop(half, 0.7);
  const sourceStyle = usePop(sourcePop, 0.7);
  const estimateStyle = usePop(estimatePop, 0.7);

  return (
    <Scene
      frame={frame}
      label={
        source
          ? `The estimated level after one dose rises and falls, a dashed guide crosses it at the half level, and the curve is tagged ${source} and tagged Estimate.`
          : 'The estimated level after one dose rises and falls, a dashed guide crosses it at the half level, and the curve is tagged Estimate.'
      }
    >
      <SceneBase frame={frame}>
        <Defs>
          <LinearGradient id="hlArea" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.accent} stopOpacity={0.34} />
            <Stop offset="0.55" stopColor={colors.accent} stopOpacity={0.13} />
            <Stop offset="1" stopColor={colors.accent} stopOpacity={0} />
          </LinearGradient>
          <RadialGradient id="hlBloom" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.accent} stopOpacity={0.22} />
            <Stop offset="1" stopColor={colors.accent} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="hlTip" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.accent} stopOpacity={0.4} />
            <Stop offset="1" stopColor={colors.accent} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        <AnimatedLine
          animatedProps={axisProps}
          x1={26}
          y1={46}
          x2={26}
          y2={192}
          stroke={colors.inkSubtle}
          strokeOpacity={0.5}
          strokeWidth={1}
        />
        <AnimatedLine
          animatedProps={baseProps}
          x1={22}
          y1={192}
          x2={252}
          y2={192}
          stroke={colors.inkSubtle}
          strokeOpacity={0.7}
          strokeWidth={1}
          strokeLinecap="round"
        />

        <AnimatedEllipse
          animatedProps={areaProps}
          cx={84}
          cy={86}
          rx={62}
          ry={52}
          fill="url(#hlBloom)"
        />
        <AnimatedPath animatedProps={areaProps} d={AREA} fill="url(#hlArea)" />

        <AnimatedPath
          animatedProps={strokeProps}
          d={CURVE}
          fill="none"
          stroke={colors.accent}
          strokeOpacity={0.18}
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={CURVE_LENGTH}
        />
        <AnimatedPath
          animatedProps={strokeProps}
          d={CURVE}
          fill="none"
          stroke={colors.accent}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={CURVE_LENGTH}
        />

        <AnimatedLine
          animatedProps={guideProps}
          x1={GUIDE_FROM}
          y1={GUIDE_Y}
          x2={GUIDE_TO}
          y2={GUIDE_Y}
          stroke={colors.amber}
          strokeOpacity={0.55}
          strokeWidth={1.25}
          strokeDasharray="3 5"
          strokeLinecap="round"
        />

        <AnimatedCircle
          animatedProps={haloProps}
          cx={82}
          cy={58}
          r={11}
          fill={colors.accent}
          fillOpacity={0.14}
        />
        <AnimatedCircle
          animatedProps={markProps}
          cx={82}
          cy={58}
          r={4.5}
          fill={colors.accent}
          stroke={colors.surface}
          strokeWidth={2.5}
        />

        {source ? (
          <AnimatedPath
            animatedProps={leaderProps}
            d={LEADER}
            fill="none"
            stroke={colors.accent}
            strokeOpacity={0.55}
            strokeWidth={1.25}
            strokeLinecap="round"
            strokeDasharray={LEADER_LENGTH}
          />
        ) : null}

        <AnimatedCircle animatedProps={tipGlowProps} cx={26} cy={192} r={13} fill="url(#hlTip)" />
        <AnimatedCircle
          animatedProps={tipSoftProps}
          cx={26}
          cy={192}
          r={6}
          fill={colors.accent}
          fillOpacity={0.35}
        />
        <AnimatedCircle
          animatedProps={tipCoreProps}
          cx={26}
          cy={192}
          r={3.2}
          fill={colors.surface}
          stroke={colors.accent}
          strokeWidth={1.5}
        />
      </SceneBase>

      <SceneLayer frame={frame} box={{ x: 118, y: 112, width: 26, height: 26 }} style={halfStyle}>
        <Circle
          cx={131}
          cy={125}
          r={11.5}
          fill={colors.background}
          stroke={colors.amber}
          strokeOpacity={0.6}
          strokeWidth={1.25}
        />
        <Circle cx={131} cy={125} r={11.5} fill={colors.warningSoft} />
        <SvgText
          x={131}
          y={129.4}
          textAnchor="middle"
          fontSize={12}
          fontFamily={fonts.sansSemiBold}
          fill={colors.amber}
        >
          {'½'}
        </SvgText>
      </SceneLayer>

      {source ? (
        <SceneLayer
          frame={frame}
          box={{ x: 104, y: 22, width: 112, height: 24 }}
          style={sourceStyle}
        >
          <Rect
            x={104}
            y={22}
            width={112}
            height={24}
            rx={12}
            fill={colors.successSoft}
            stroke={colors.accent}
            strokeOpacity={0.5}
          />
          <Circle cx={118} cy={34} r={3} fill={colors.accent} />
          <SvgText
            x={167}
            y={38}
            textAnchor="middle"
            fontSize={11.5}
            fontFamily={fonts.sansSemiBold}
            fill={colors.successDeep}
          >
            {source}
          </SvgText>
        </SceneLayer>
      ) : null}

      <SceneLayer
        frame={frame}
        box={{ x: 172, y: 96, width: 80, height: 22 }}
        style={estimateStyle}
      >
        <Rect
          x={172}
          y={96}
          width={80}
          height={22}
          rx={11}
          fill={colors.warningSoft}
          stroke={colors.amber}
          strokeOpacity={0.5}
        />
        <SvgText
          x={212}
          y={111}
          textAnchor="middle"
          fontSize={11}
          fontFamily={fonts.sansSemiBold}
          fill={colors.amber}
        >
          Estimate
        </SvgText>
      </SceneLayer>
    </Scene>
  );
}
