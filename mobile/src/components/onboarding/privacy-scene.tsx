import { useAnimatedProps, useReducedMotion } from 'react-native-reanimated';
import { Defs, Path, Rect, RadialGradient, LinearGradient, Stop, Circle } from 'react-native-svg';

import {
  AnimatedEllipse,
  AnimatedPath,
  AnimatedRect,
  Scene,
  SceneBase,
  SceneLayer,
  useCue,
  useDraw,
  useFade,
  usePop,
  useSceneFrame,
  useTravel,
} from '@/components/onboarding/scene';
import { colors, easing, motion, springs } from '@/theme';

const VB_WIDTH = 264;
const VB_HEIGHT = 200;

/** The rounded rectangle's own perimeter: two runs of 56 and 122, plus one r18 circle. */
const OUTLINE_LENGTH = 470;
/** Seven up, a half turn of radius ten, seven down. */
const SHACKLE_LENGTH = 48;
/** How far an entry chip stands off centre before it settles into the phone. */
const CHIP_TRAVEL = 52;

/**
 * The phone locking itself, on the beat grid.
 *
 * Read the order rather than the delays: the phone exists, three kinds of entry
 * travel into it, it locks, it seals, and only then do the words arrive. The
 * screen makes its promise before it is read.
 */
const privacyBeats = {
  /** The outline draws itself and its shadow settles under it. */
  outline: 0,
  /** The speaker line, and the first entry chip behind it. */
  entry: motion.beat,
  /** Each following chip is one beat later, from the other side. */
  entryStep: motion.beat,
  /** The lock body lands. */
  lock: 4 * motion.beat,
  /** The shackle draws closed, and the phone's own light blooms. */
  clasp: 5 * motion.beat,
  /** The outline turns green and one soft ring closes onto it. */
  seal: 6 * motion.beat,
} as const;

/** The rows under the scene rise together, last. Read by the screen. */
export const privacyRowsBeat = 8 * motion.beat;

const RING = { cx: 132, cy: 91, halfWidth: 46, halfHeight: 79, radius: 18 } as const;

export function PrivacyScene() {
  const reduced = useReducedMotion();
  const frame = useSceneFrame(VB_WIDTH, VB_HEIGHT);

  const outline = useCue({ delay: privacyBeats.outline, duration: motion.slow, easing: easing.out }, reduced);
  const speaker = useCue({ delay: privacyBeats.entry, duration: motion.base, easing: easing.out }, reduced);
  const lock = useCue({ delay: privacyBeats.lock, spring: springs.pop }, reduced);
  const clasp = useCue({ delay: privacyBeats.clasp, duration: motion.fast, easing: easing.out }, reduced);
  const glow = useCue({ delay: privacyBeats.clasp, duration: motion.slow, easing: easing.out }, reduced);
  const seal = useCue({ delay: privacyBeats.seal, duration: motion.base, easing: easing.out }, reduced);

  const shadowProps = useFade(outline);
  const outlineProps = useDraw(outline, OUTLINE_LENGTH);
  const speakerProps = useFade(speaker);
  const glowProps = useFade(glow);
  const sealProps = useFade(seal);
  const shackleProps = useDraw(clasp, SHACKLE_LENGTH);
  const lockStyle = usePop(lock, 0.55);

  // One ring closes inward onto the sealed edge and leaves. It is drawn as the
  // rectangle's own geometry rather than a scaled group, so it needs no
  // transform: the box contracts from a tenth over full size back to full, and
  // the stroke fades up and out inside the same base.
  const ringProps = useAnimatedProps(() => {
    const step = seal.value;
    const scale = 1.12 - 0.12 * step;
    const alpha = step < 0.45 ? (step / 0.45) * 0.55 : (1 - (step - 0.45) / 0.55) * 0.55;
    return {
      x: RING.cx - RING.halfWidth * scale,
      y: RING.cy - RING.halfHeight * scale,
      width: RING.halfWidth * 2 * scale,
      height: RING.halfHeight * 2 * scale,
      rx: RING.radius * scale,
      opacity: Math.max(0, alpha),
    };
  });

  return (
    <Scene
      frame={frame}
      label="Three kinds of entry settle inside one phone, and the phone locks."
    >
      <SceneBase frame={frame}>
        <Defs>
          <RadialGradient id="pvGlow" cx="50%" cy="46%" r="52%">
            <Stop offset="0" stopColor={colors.accent} stopOpacity={0.15} />
            <Stop offset="1" stopColor={colors.accent} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="pvShadow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.successDeep} stopOpacity={0.16} />
            <Stop offset="1" stopColor={colors.successDeep} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        <AnimatedEllipse
          animatedProps={glowProps}
          cx={132}
          cy={94}
          rx={94}
          ry={94}
          fill="url(#pvGlow)"
        />
        <AnimatedEllipse
          animatedProps={shadowProps}
          cx={132}
          cy={192}
          rx={56}
          ry={8}
          fill="url(#pvShadow)"
        />

        <AnimatedRect
          animatedProps={outlineProps}
          x={86}
          y={12}
          width={92}
          height={158}
          rx={18}
          fill="none"
          stroke={colors.ink}
          strokeOpacity={0.2}
          strokeWidth={2}
          strokeDasharray={OUTLINE_LENGTH}
        />
        <AnimatedRect
          animatedProps={speakerProps}
          x={122}
          y={22}
          width={20}
          height={4}
          rx={2}
          fill={colors.ink}
          fillOpacity={0.16}
        />

        <AnimatedRect
          animatedProps={sealProps}
          x={86}
          y={12}
          width={92}
          height={158}
          rx={18}
          fill="none"
          stroke={colors.accent}
          strokeWidth={2}
        />
        <AnimatedRect
          animatedProps={ringProps}
          x={86}
          y={12}
          width={92}
          height={158}
          rx={18}
          fill="none"
          stroke={colors.accent}
          strokeWidth={2}
        />

        <AnimatedPath
          animatedProps={shackleProps}
          d="M122,158 v-7 a10,10 0 0 1 20,0 v7"
          fill="none"
          stroke={colors.successDeep}
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeDasharray={SHACKLE_LENGTH}
        />
      </SceneBase>

      <EntryChip frame={frame} index={0} reduced={reduced} />
      <EntryChip frame={frame} index={1} reduced={reduced} />
      <EntryChip frame={frame} index={2} reduced={reduced} />

      <SceneLayer frame={frame} box={{ x: 110, y: 154, width: 44, height: 36 }} style={lockStyle}>
        <Rect
          x={114}
          y={158}
          width={36}
          height={28}
          rx={8}
          fill={colors.surface}
          stroke={colors.successDeep}
          strokeWidth={2.4}
        />
        <Circle cx={132} cy={170} r={3} fill={colors.successDeep} />
        <Rect x={130.7} y={170} width={2.6} height={7} rx={1.3} fill={colors.successDeep} />
      </SceneLayer>
    </Scene>
  );
}

/**
 * A dose, a level curve and a note: the three kinds of thing the next few
 * minutes ask for. They alternate sides so the eye follows one at a time.
 */
function EntryChip({
  frame,
  index,
  reduced,
}: {
  frame: ReturnType<typeof useSceneFrame>;
  index: 0 | 1 | 2;
  reduced: boolean;
}) {
  const cue = useCue(
    {
      delay: privacyBeats.entry + index * privacyBeats.entryStep,
      duration: motion.base,
      easing: easing.out,
    },
    reduced,
  );
  const style = useTravel(cue, frame, index === 1 ? CHIP_TRAVEL : -CHIP_TRAVEL);
  const top = 36 + index * 35;

  return (
    <SceneLayer frame={frame} box={{ x: 96, y: top - 2, width: 72, height: 32 }} style={style}>
      <Defs>
        <LinearGradient id={`pvDrop${index}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.accent} />
          <Stop offset="1" stopColor={colors.successDeep} />
        </LinearGradient>
      </Defs>
      <Rect x={98} y={top} width={68} height={28} rx={10} fill={colors.successSoft} />

      {index === 0 ? (
        <Path
          d="M120,41 C124.5,47 127,50 127,52.5 A7,7 0 0 1 113,52.5 C113,50 115.5,47 120,41 Z"
          fill="url(#pvDrop0)"
        />
      ) : null}

      {index === 1 ? (
        <>
          <Path
            d="M106,93 C110,93 111,77 117,77 C123,77 125,87 131,90"
            fill="none"
            stroke={colors.accent}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle cx={117} cy={77} r={2.6} fill={colors.successDeep} />
        </>
      ) : null}

      {index === 2 ? (
        <>
          <Circle cx={108} cy={114} r={3} fill={colors.successDeep} />
          <Circle cx={120} cy={114} r={3} fill={colors.accent} fillOpacity={0.45} />
          <Circle cx={132} cy={114} r={3} fill={colors.successDeep} />
          <Circle cx={108} cy={126} r={3} fill={colors.accent} fillOpacity={0.45} />
          <Circle cx={120} cy={126} r={3} fill={colors.successDeep} />
          <Circle cx={132} cy={126} r={3} fill={colors.accent} fillOpacity={0.45} />
        </>
      ) : null}

      <Rect
        x={140}
        y={top + 12}
        width={18}
        height={4}
        rx={2}
        fill={colors.inkSubtle}
        fillOpacity={0.45}
      />
    </SceneLayer>
  );
}
