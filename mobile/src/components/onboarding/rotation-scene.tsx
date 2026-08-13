import { interpolate, useAnimatedProps, useReducedMotion } from 'react-native-reanimated';
import {
  Defs,
  LinearGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import {
  AnimatedCircle,
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
const VB_HEIGHT = 222;

/**
 * One half of the figure, drawn from the crown down, and mirrored about the
 * centre line so the silhouette is exactly symmetrical. The open path closes
 * against the mirror, so the two halves make one shape with no seam.
 */
const BODY = 'M132 10C141.4 10 149 19 149 30C149 38.4 147.4 41.4 145 43.4C142.8 46 140.8 47.4 140.5 51L140.5 62C142.4 62.5 148.1 64 152 65C155.9 66 160.7 67 164 68C167.3 69 170.2 70 172 71C173.8 72 174.2 72.5 175 74C175.8 75.5 176.2 77.7 176.5 80C176.8 82.3 177.2 85.5 177 88C176.8 90.5 176.5 93 175.5 95C174.5 97 172.4 98.3 171 100C169.6 101.7 167.9 103.3 167 105C166.1 106.7 166.1 107.8 165.5 110C164.9 112.2 164.2 115 163.5 118C162.8 121 161.8 124.7 161 128C160.2 131.3 159.2 134.7 159 138C158.8 141.3 159.4 144.7 160 148C160.6 151.3 161.7 155 162.5 158C163.3 161 164.5 163.7 165 166C165.5 168.3 165.5 169.7 165.5 172C165.5 174.3 165.2 177 165 180C164.8 183 164.3 186 164 190C163.7 194 163.2 199.3 163 204C162.8 208.7 162.6 214.7 162.5 218C162.4 221.3 162.5 223 162.5 224';
const BODY_FILL = `${BODY}L140 224C139.4 208 137 192 132.6 179C132.4 178.6 132.2 178.3 132 178Z`;
const INNER = 'M132 178C132.2 178.3 132.4 178.6 132.6 179C137 192 139.4 208 140 224';
const MIRROR = 'translate(264,0) scale(-1,1)';

/** Both measured by flattening the paths above. */
const BODY_LENGTH = 256.3;
const INNER_LENGTH = 46.9;
/** One sweep through all four sites. */
const ORBIT = 'M117 124A21.21 19.8 0 0 1 147 124A21.21 19.8 0 0 1 147 152A21.21 19.8 0 0 1 117 152A21.21 19.8 0 0 1 117 124';
const ORBIT_LENGTH = 128.9;
const LEADER = 'M85 124L110 124';
const LEADER_LENGTH = 25;

/** The rotation order `domain/rotation.ts` walks: across, down, back, up. */
const SITES = [
  { cx: 117, cy: 124 },
  { cx: 147, cy: 124 },
  { cx: 147, cy: 152 },
  { cx: 117, cy: 152 },
] as const;
const SITE_R = 7;
/** A used site keeps its place at this much of full strength. */
const SITE_DIM = 0.6;

/**
 * The cycle, played once: the figure draws itself, each site takes its turn and
 * steps back, and the tag returns to the site that has waited longest.
 */
const rotationBeats = {
  /** The fill settles and both outline halves draw from the crown. */
  body: 0,
  /** The navel lands; the sweep starts, at a constant rate. */
  orbit: 2 * motion.beat,
  /** The inner-thigh pair is short, so it draws late and closes with the rest. */
  inner: 3 * motion.beat,
  /** Site 1. */
  site: 3 * motion.beat,
  /** One site per beat after it. */
  siteStep: motion.beat,
  /**
   * How long a site holds full strength before it steps back. This is the pop's
   * own tail rather than an event on the grid, which is why it is a duration
   * token and not a beat count.
   */
  siteHold: motion.fast,
  /** The leader hairline draws out to site 1. */
  leader: 7 * motion.beat,
  /**
   * The tag lands, and site 1 comes back to full under it. This is the last
   * frame of the scene, so it is a `fast` pop rather than a spring: 520 + 150
   * puts the end at 670 ms, which is the budget `motion.md` rule 3 sets.
   */
  tag: 8 * motion.beat,
} as const;

/** The one line under the scene arrives with the tag. Read by the screen. */
export const rotationLineBeat = rotationBeats.tag;

export function RotationScene() {
  const reduced = useReducedMotion();
  const frame = useSceneFrame(VB_WIDTH, VB_HEIGHT);

  const fill = useCue({ delay: rotationBeats.body, duration: motion.base, easing: easing.out }, reduced);
  const outline = useCue({ delay: rotationBeats.body, duration: motion.draw, easing: easing.out }, reduced);
  const inner = useCue({ delay: rotationBeats.inner, duration: motion.base, easing: easing.out }, reduced);
  const navel = useCue({ delay: rotationBeats.orbit, duration: motion.fast, easing: easing.out }, reduced);
  // The sweep is the metronome of motion rule 5, so it runs at a constant rate
  // and every mark that lands on it carries its own eased pop.
  const orbit = useCue({ delay: rotationBeats.orbit, duration: motion.slow, easing: easing.linear }, reduced);
  const leader = useCue({ delay: rotationBeats.leader, duration: motion.fast, easing: easing.out }, reduced);
  const tag = useCue(
    { delay: rotationBeats.tag, duration: motion.fast, easing: easing.out },
    reduced,
  );

  const fillProps = useFade(fill);
  const outlineProps = useDraw(outline, BODY_LENGTH);
  const innerProps = useDraw(inner, INNER_LENGTH);
  const navelProps = useFade(navel);
  const orbitProps = useDraw(orbit, ORBIT_LENGTH);
  const leaderProps = useDraw(leader, LEADER_LENGTH);
  const tagStyle = usePop(tag);

  return (
    <Scene
      frame={frame}
      label="A figure with four injection sites on the abdomen. The rotation returns to the first site."
    >
      <SceneBase frame={frame}>
        <Defs>
          <LinearGradient id="rtBody" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.successSoft} stopOpacity={0.95} />
            <Stop offset="1" stopColor={colors.successSoft} stopOpacity={0.4} />
          </LinearGradient>
          <LinearGradient
            id="rtCrop"
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1="180"
            x2="0"
            y2="218"
          >
            <Stop offset="0" stopColor={colors.background} stopOpacity={0} />
            <Stop offset="1" stopColor={colors.background} stopOpacity={1} />
          </LinearGradient>
        </Defs>

        <AnimatedPath animatedProps={fillProps} d={BODY_FILL} fill="url(#rtBody)" />
        <AnimatedPath
          animatedProps={fillProps}
          d={BODY_FILL}
          transform={MIRROR}
          fill="url(#rtBody)"
        />

        <AnimatedPath
          animatedProps={outlineProps}
          d={BODY}
          fill="none"
          stroke={colors.accent}
          strokeOpacity={0.6}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={BODY_LENGTH}
        />
        <AnimatedPath
          animatedProps={outlineProps}
          d={BODY}
          transform={MIRROR}
          fill="none"
          stroke={colors.accent}
          strokeOpacity={0.6}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={BODY_LENGTH}
        />
        <AnimatedPath
          animatedProps={innerProps}
          d={INNER}
          fill="none"
          stroke={colors.accent}
          strokeOpacity={0.6}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={INNER_LENGTH}
        />
        <AnimatedPath
          animatedProps={innerProps}
          d={INNER}
          transform={MIRROR}
          fill="none"
          stroke={colors.accent}
          strokeOpacity={0.6}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={INNER_LENGTH}
        />

        {/* The thighs leave the frame rather than being cut off by it. */}
        <Rect x={0} y={180} width={VB_WIDTH} height={42} fill="url(#rtCrop)" />

        <AnimatedPath
          animatedProps={orbitProps}
          d={ORBIT}
          fill="none"
          stroke={colors.accent}
          strokeOpacity={0.3}
          strokeWidth={1.25}
          strokeDasharray={ORBIT_LENGTH}
        />
        <AnimatedCircle
          animatedProps={navelProps}
          cx={132}
          cy={138}
          r={2.4}
          fill={colors.successDeep}
          fillOpacity={0.4}
        />

        {SITES.map((site, index) => (
          <RotationSite key={`${site.cx}-${site.cy}`} site={site} index={index} reduced={reduced} />
        ))}

        <AnimatedPath
          animatedProps={leaderProps}
          d={LEADER}
          fill="none"
          stroke={colors.successDeep}
          strokeOpacity={0.65}
          strokeWidth={1.25}
          strokeDasharray={LEADER_LENGTH}
        />
      </SceneBase>

      <SceneLayer frame={frame} box={{ x: 4, y: 113, width: 79, height: 22 }} style={tagStyle}>
        <Rect x={4} y={113} width={79} height={22} rx={11} fill={colors.successDeep} />
        <SvgText
          x={43.5}
          y={127.5}
          textAnchor="middle"
          fontSize={11}
          fontFamily={fonts.sansSemiBold}
          fill={colors.inkInverse}
        >
          Next: here
        </SvgText>
      </SceneLayer>
    </Scene>
  );
}

/**
 * One site taking its turn: it pops, one soft ring leaves it, and it steps back
 * to `SITE_DIM` so the next one reads as the live one. Site 1 comes back to full
 * under the tag, which is what closes the circle.
 */
function RotationSite({
  site,
  index,
  reduced,
}: {
  site: { cx: number; cy: number };
  index: number;
  reduced: boolean;
}) {
  const at = rotationBeats.site + index * rotationBeats.siteStep;
  const pop = useCue({ delay: at, spring: springs.pop }, reduced);
  const ring = useCue({ delay: at, duration: motion.base, easing: easing.out }, reduced);
  const dim = useCue(
    { delay: at + rotationBeats.siteHold, duration: motion.press, easing: easing.out },
    reduced,
  );
  const restore = useCue(
    { delay: rotationBeats.tag, duration: motion.fast, easing: easing.out },
    reduced,
  );
  const first = index === 0;

  const ringProps = useAnimatedProps(() => {
    const step = ring.value;
    const alpha = step < 0.18 ? (step / 0.18) * 0.45 : (1 - (step - 0.18) / 0.82) * 0.45;
    return { r: SITE_R * (0.9 + 1.6 * step), opacity: Math.max(0, alpha) };
  });

  const dotProps = useAnimatedProps(() => {
    const back = first ? dim.value * (1 - restore.value) : dim.value;
    // Site 1 does not merely brighten under the tag, it comes back: one 16 %
    // swell and down again, which is the same gesture as its first pop.
    const swell = first ? 0.16 * interpolate(restore.value, [0, 0.62, 1], [0, 1, 0]) : 0;
    return {
      r: SITE_R * pop.value * (1 + swell),
      opacity: Math.min(1, pop.value) * (1 - (1 - SITE_DIM) * back),
    };
  });

  return (
    <>
      <AnimatedCircle
        animatedProps={ringProps}
        cx={site.cx}
        cy={site.cy}
        r={SITE_R}
        fill="none"
        stroke={colors.accent}
        strokeWidth={1.5}
      />
      <AnimatedCircle
        animatedProps={dotProps}
        cx={site.cx}
        cy={site.cy}
        r={SITE_R}
        fill={colors.accent}
        stroke={colors.surface}
        strokeWidth={1.6}
      />
    </>
  );
}
