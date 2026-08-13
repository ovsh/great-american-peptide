import { useAnimatedProps, useReducedMotion } from 'react-native-reanimated';
import { Circle, Path } from 'react-native-svg';

import {
  AnimatedCircle,
  AnimatedRect,
  Scene,
  SceneBase,
  SceneLayer,
  useCue,
  useFade,
  usePop,
  useSceneFrame,
} from '@/components/onboarding/scene';
import { colors, easing, motion, springs } from '@/theme';

const VB_WIDTH = 264;
const VB_HEIGHT = 118;

/** The two keys the two taps land on, in the order a finger reaches them. */
const KEYS = [
  { cx: 172, cy: 59 },
  { cx: 216, cy: 59 },
] as const;
const KEY_R = 17;

/**
 * Two taps and it is logged.
 *
 * This is the one scene with no prototype behind it: the screen it replaces had
 * a calendar glyph in a medallion, and the sentence it keeps is about how few
 * taps a log costs, which a still picture cannot say. It is written in the same
 * language as the ported three — a band that exists, marks that land on the
 * beat grid, one quiet close.
 *
 * The band carries two bars and no numbers. A drawn dose would be a number Poke
 * made up, and `AGENTS.md` bans placeholder data on a shipping screen; the bars
 * stand for the dose and the site the app already holds, which is the claim.
 */
const logMomentBeats = {
  /** The band and its two bars settle, and the first tap lands on it. */
  band: 0,
  /** The second tap. */
  second: 2 * motion.beat,
  /** The check, which is the whole delight budget of the screen spent at once. */
  check: 4 * motion.beat,
} as const;

export function LogMomentScene() {
  const reduced = useReducedMotion();
  const frame = useSceneFrame(VB_WIDTH, VB_HEIGHT);

  const band = useCue({ delay: logMomentBeats.band, duration: motion.base, easing: easing.out }, reduced);
  const check = useCue({ delay: logMomentBeats.check, spring: springs.pop }, reduced);

  const bandProps = useFade(band);
  const checkStyle = usePop(check, 0.5);

  return (
    <Scene frame={frame} label="A log row takes two taps and turns into a check.">
      <SceneBase frame={frame}>
        <AnimatedRect
          animatedProps={bandProps}
          x={12}
          y={19}
          width={240}
          height={80}
          rx={20}
          fill={colors.surface}
          stroke={colors.accent}
          strokeOpacity={0.18}
          strokeWidth={1.5}
        />
        <AnimatedRect
          animatedProps={bandProps}
          x={34}
          y={45}
          width={76}
          height={9}
          rx={4.5}
          fill={colors.accent}
          fillOpacity={0.38}
        />
        <AnimatedRect
          animatedProps={bandProps}
          x={34}
          y={64}
          width={52}
          height={9}
          rx={4.5}
          fill={colors.accent}
          fillOpacity={0.18}
        />

        {KEYS.map((key, index) => (
          <TapKey key={key.cx} at={key} index={index} band={bandProps} reduced={reduced} />
        ))}
      </SceneBase>

      <SceneLayer
        frame={frame}
        box={{ x: 196, y: 39, width: 40, height: 40 }}
        style={checkStyle}
      >
        <Circle cx={216} cy={59} r={19} fill={colors.accent} />
        <Path
          d="M208 59.4 L213.6 65 L224.4 53.6"
          fill="none"
          stroke={colors.surface}
          strokeWidth={2.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </SceneLayer>
    </Scene>
  );
}

/**
 * One tap: the key lights for a moment and one ring leaves it. One ring, not a
 * burst — `motion.md` keeps the celebration to a single gesture.
 */
function TapKey({
  at,
  index,
  band,
  reduced,
}: {
  at: { cx: number; cy: number };
  index: number;
  band: ReturnType<typeof useFade>;
  reduced: boolean;
}) {
  const delay = index === 0 ? logMomentBeats.band : logMomentBeats.second;
  const tap = useCue({ delay, duration: motion.slow, easing: easing.out }, reduced);

  const flashProps = useAnimatedProps(() => {
    const step = tap.value;
    const alpha = step < 0.25 ? step / 0.25 : 1 - (step - 0.25) / 0.75;
    return { opacity: Math.max(0, alpha) };
  });
  const ringProps = useAnimatedProps(() => {
    const step = tap.value;
    const alpha = step < 0.15 ? (step / 0.15) * 0.5 : (1 - (step - 0.15) / 0.85) * 0.5;
    return { r: KEY_R * (0.4 + 1.1 * step), opacity: Math.max(0, alpha) };
  });

  return (
    <>
      <AnimatedCircle
        animatedProps={band}
        cx={at.cx}
        cy={at.cy}
        r={KEY_R}
        fill={colors.successSoft}
      />
      <AnimatedCircle
        animatedProps={flashProps}
        cx={at.cx}
        cy={at.cy}
        r={KEY_R}
        fill={colors.accent}
        fillOpacity={0.28}
      />
      <AnimatedCircle
        animatedProps={ringProps}
        cx={at.cx}
        cy={at.cy}
        r={KEY_R}
        fill="none"
        stroke={colors.accent}
        strokeWidth={1.75}
      />
    </>
  );
}
