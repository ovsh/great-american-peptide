import { useReducedMotion } from 'react-native-reanimated';
import { Circle, Rect } from 'react-native-svg';

import {
  AnimatedPath,
  AnimatedRect,
  Scene,
  SceneBase,
  SceneLayer,
  useCue,
  useDraw,
  useFade,
  useLift,
  useSceneFrame,
} from '@/components/onboarding/scene';
import { colors, easing, motion, rise } from '@/theme';

const VB_WIDTH = 264;
const VB_HEIGHT = 140;

const PHONE = { x: 98, y: 8, width: 68, height: 118, radius: 14 } as const;
/** Two runs of 40 and 90, plus one r14 circle. */
const PHONE_LENGTH = 348;

/** The wifi fan the slash goes through. */
const ARC_SMALL = 'M192,104 A11,11 0 0 1 208,104';
const ARC_LARGE = 'M186,97 A21,21 0 0 1 214,97';
const SLASH = 'M182,122 L218,92';
const SLASH_LENGTH = 46.9;

/** The three rows that settle inside. */
const ROWS = [46, 70, 94] as const;

/**
 * The privacy phone again, smaller, with the network crossed out beside it.
 *
 * The screen before this one drew a phone that locks. This is the same phone,
 * so a user who saw the first scene reads this one as the same promise applied
 * to a second question: the log settles inside the outline, and the one arrow
 * that could carry it off the phone is struck through.
 */
const onDeviceBeats = {
  /** The outline draws itself. */
  phone: 0,
  /** The first row settles inside it. */
  row: motion.beat,
  /** One row per beat after it. */
  rowStep: motion.beat,
  /** The network fan fades up outside the phone. */
  network: 4 * motion.beat,
  /** The slash draws through it. */
  slash: 5 * motion.beat,
} as const;

/** The two promises rise last. Read by the screen. */
export const onDeviceRowsBeat = 6 * motion.beat;

export function OnDeviceScene() {
  const reduced = useReducedMotion();
  const frame = useSceneFrame(VB_WIDTH, VB_HEIGHT);

  const phone = useCue({ delay: onDeviceBeats.phone, duration: motion.slow, easing: easing.out }, reduced);
  const network = useCue({ delay: onDeviceBeats.network, duration: motion.base, easing: easing.out }, reduced);
  const slash = useCue({ delay: onDeviceBeats.slash, duration: motion.fast, easing: easing.out }, reduced);

  const phoneProps = useDraw(phone, PHONE_LENGTH);
  const speakerProps = useFade(phone);
  const networkProps = useFade(network);
  const slashProps = useDraw(slash, SLASH_LENGTH);

  return (
    <Scene
      frame={frame}
      label="A log settles inside one phone, and the network beside it is crossed out."
    >
      <SceneBase frame={frame}>
        <AnimatedRect
          animatedProps={phoneProps}
          x={PHONE.x}
          y={PHONE.y}
          width={PHONE.width}
          height={PHONE.height}
          rx={PHONE.radius}
          fill="none"
          stroke={colors.accent}
          strokeOpacity={0.55}
          strokeWidth={2}
          strokeDasharray={PHONE_LENGTH}
        />
        <AnimatedRect
          animatedProps={speakerProps}
          x={124}
          y={17}
          width={16}
          height={3.5}
          rx={1.75}
          fill={colors.ink}
          fillOpacity={0.16}
        />

        <AnimatedPath
          animatedProps={networkProps}
          d={ARC_SMALL}
          fill="none"
          stroke={colors.inkSubtle}
          strokeWidth={2.4}
          strokeLinecap="round"
        />
        <AnimatedPath
          animatedProps={networkProps}
          d={ARC_LARGE}
          fill="none"
          stroke={colors.inkSubtle}
          strokeOpacity={0.6}
          strokeWidth={2.4}
          strokeLinecap="round"
        />
        <AnimatedRect
          animatedProps={networkProps}
          x={197}
          y={107}
          width={6}
          height={6}
          rx={3}
          fill={colors.inkSubtle}
        />

        <AnimatedPath
          animatedProps={slashProps}
          d={SLASH}
          fill="none"
          stroke={colors.successDeep}
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeDasharray={SLASH_LENGTH}
        />
      </SceneBase>

      {ROWS.map((y, index) => (
        <LogRow key={y} frame={frame} y={y} index={index} reduced={reduced} />
      ))}
    </Scene>
  );
}

/** One entry of the log, settling into the phone it never leaves. */
function LogRow({
  frame,
  y,
  index,
  reduced,
}: {
  frame: ReturnType<typeof useSceneFrame>;
  y: number;
  index: number;
  reduced: boolean;
}) {
  const cue = useCue(
    {
      delay: onDeviceBeats.row + index * onDeviceBeats.rowStep,
      duration: motion.base,
      easing: easing.out,
    },
    reduced,
  );
  const style = useLift(cue, frame, rise.line);

  return (
    <SceneLayer frame={frame} box={{ x: 106, y: y - 8, width: 54, height: 16 }} style={style}>
      <Circle cx={113} cy={y} r={4.5} fill={colors.accent} />
      <Rect
        x={124}
        y={y - 2.5}
        width={32}
        height={5}
        rx={2.5}
        fill={colors.accent}
        fillOpacity={0.3}
      />
    </SceneLayer>
  );
}
