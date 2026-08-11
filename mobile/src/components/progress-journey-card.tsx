import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated from 'react-native-reanimated';
import { ArrowDown, ArrowUp, Flame, Info, Lock } from 'lucide-react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';

import { BottomSheet } from '@/components/BottomSheet';
import { openPaywall } from '@/components/ProLock';
import { Text } from '@/components/Text';
import { ProgressChart } from '@/components/progress-chart';
import {
  PROGRESS_METRICS,
  buildLayout,
  dayDistance,
  type Journey,
  type ProgressMetric,
} from '@/components/progress-geometry';
import { ProgressLogBand, type ProgressBandKind } from '@/components/progress-log-band';
import { usePressScale } from '@/components/today-motion';
import { colors, elevation, radius, spacing } from '@/theme';

/** The slim line over the card: where the run started, and how long it has held. */
export function ProgressHeaderLine({ journey }: { journey: Journey }) {
  const shots = journey.shotTotal === 1 ? '1 shot' : `${journey.shotTotal} shots`;
  const weeks = journey.streakWeeks === 1 ? '1 week' : `${journey.streakWeeks} weeks`;

  return (
    <View style={styles.top}>
      <Text variant="bodyStrong" numberOfLines={1} style={styles.since}>
        Since {journey.sinceLabel}
        <Text variant="smallStrong" color={colors.inkMuted}> · {shots}</Text>
      </Text>
      {journey.streakWeeks > 0 ? (
        <View style={styles.streak} testID="progress-streak">
          <Flame size={15} color={colors.success} fill={colors.success} />
          <Text variant="caption" color={colors.successDeep}>{weeks}</Text>
        </View>
      ) : null}
    </View>
  );
}

interface ProgressJourneyCardProps {
  journey: Journey;
  metric: ProgressMetric;
  onMetric: (metric: ProgressMetric) => void;
  pro: boolean;
  band: ProgressBandKind;
  logToken: number;
  /** The clock the screen read, for the read-out's "how long ago". */
  now: number;
}

/**
 * The whole screen, in one card.
 *
 * A chip row is the single selection axis, a read-out row says what the band
 * under it is worth, the chart carries the meaning, and the log action holds the
 * foot of the card in every state. Nothing here is a second card competing for
 * the same glance.
 */
export function ProgressJourneyCard({
  journey,
  metric,
  onMetric,
  pro,
  band,
  logToken,
  now,
}: ProgressJourneyCardProps) {
  const [width, setWidth] = useState(0);
  const [sheet, setSheet] = useState(false);
  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  // Rebuilt only when the data or the width moves. A layout rebuilt on every
  // render would hand the chart a new set of points mid-animation.
  const layout = useMemo(
    () => (width > 0 ? buildLayout(journey, width) : null),
    [journey, width],
  );
  const readOut = readOutFor(journey, metric, pro, now);

  return (
    <View style={styles.card} testID="progress-journey-card">
      <View style={styles.axis}>
        {PROGRESS_METRICS.map((entry) => (
          <MetricChip
            key={entry.id}
            label={entry.label}
            selected={entry.id === metric}
            onPress={() => onMetric(entry.id)}
          />
        ))}
        <View style={styles.spacer} />
        <Pressable
          testID="progress-info"
          accessibilityRole="button"
          accessibilityLabel="What this chart shows"
          hitSlop={10}
          onPress={() => setSheet(true)}
          style={styles.info}
        >
          <Info size={18} color={colors.inkSubtle} />
        </Pressable>
      </View>

      <View style={styles.read}>
        <View style={[styles.dot, { backgroundColor: readOut.tone }]} />
        {readOut.value === null ? (
          <Text variant="h2" color={colors.inkMuted}>{readOut.unit}</Text>
        ) : (
          <>
            <Text variant="display" testID="progress-read-value">{readOut.value}</Text>
            <Text variant="body" color={colors.inkMuted}>{readOut.unit}</Text>
          </>
        )}
        <View style={styles.spacer} />
        {readOut.locked ? (
          <UnlockPill />
        ) : readOut.pill !== null ? (
          <View style={styles.totals} testID="progress-totals">
            {readOut.direction !== null ? (
              readOut.direction === 'down'
                ? <ArrowDown size={13} color={colors.amber} />
                : <ArrowUp size={13} color={colors.amber} />
            ) : null}
            <Text variant="caption">{readOut.pill}</Text>
          </View>
        ) : null}
      </View>

      <View onLayout={onLayout} style={styles.chart}>
        {layout !== null ? (
          <ProgressChart
            journey={journey}
            layout={layout}
            metric={metric}
            pro={pro}
            logToken={logToken}
          />
        ) : null}
      </View>

      <ProgressLogBand kind={band} loggedAt={journey.loggedWeightAt} />

      <BottomSheet visible={sheet} title="What this chart shows" onClose={() => setSheet(false)}>
        <LegendSheet journey={journey} />
      </BottomSheet>
    </View>
  );
}

function MetricChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const press = usePressScale();
  return (
    <Animated.View style={press.style}>
      <Pressable
        testID={`progress-metric-${label.toLowerCase()}`}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={label}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={[styles.chip, selected ? styles.chipOn : null]}
      >
        <Text variant="smallStrong" color={selected ? colors.inkInverse : colors.inkMuted}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

/** What Pro buys, said as what it gives. */
function UnlockPill() {
  const press = usePressScale();
  return (
    <Animated.View style={press.style}>
      <Pressable
        testID="progress-unlock"
        accessibilityRole="button"
        accessibilityLabel="Unlock your numbers"
        onPress={openPaywall}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={styles.unlock}
      >
        <Lock size={12} color={colors.successDeep} />
        <Text variant="caption" color={colors.successDeep}>Unlock your numbers</Text>
      </Pressable>
    </Animated.View>
  );
}

interface ReadOut {
  /** Null when there is no number yet; `unit` then carries the row on its own. */
  value: string | null;
  unit: string;
  tone: string;
  pill: string | null;
  direction: 'down' | 'up' | null;
  locked: boolean;
}

/**
 * The one number the chosen band is worth, and the total beside it.
 *
 * Free and Pro differ in exactly one place: the total change on the Weight
 * metric. The chip that replaces it is a real slot of the same height, so the
 * row does not move when the user subscribes.
 */
function readOutFor(journey: Journey, metric: ProgressMetric, pro: boolean, now: number): ReadOut {
  if (metric === 'shots') {
    const first = journey.medications[0];
    return {
      value: journey.medications.length === 0 ? null : String(journey.weeksOnTime),
      unit: journey.medications.length === 0
        ? 'No medications yet'
        : journey.weeksOnTime === 1 ? 'week on time' : 'weeks on time',
      tone: first?.color ?? colors.med[0],
      pill: journey.shotTotal > 0
        ? journey.shotTotal === 1 ? '1 shot' : `${journey.shotTotal} shots`
        : null,
      direction: null,
      locked: false,
    };
  }

  if (metric === 'effects') {
    const last = journey.effects[journey.effects.length - 1] ?? null;
    return {
      value: String(journey.effects.length),
      unit: 'logged',
      tone: colors.violet,
      pill: last !== null ? agoLabel(dayDistance(last.takenAt, now)) : null,
      direction: null,
      locked: false,
    };
  }

  const latest = journey.weights[journey.weights.length - 1] ?? null;
  const change = latest !== null && journey.startWeight !== null
    ? journey.startWeight - latest.value
    : 0;
  const hasChange = Math.abs(change) >= 0.05;

  return {
    value: latest !== null ? latest.value.toFixed(1) : null,
    unit: latest !== null ? journey.unit : 'No weight yet',
    tone: colors.amber,
    pill: hasChange ? `${Math.abs(change).toFixed(1)} ${journey.unit} ${change > 0 ? 'down' : 'up'}` : null,
    direction: hasChange ? (change > 0 ? 'down' : 'up') : null,
    locked: !pro && hasChange,
  };
}

/**
 * When the last effect landed. "Last" belongs in front of a count, not in front
 * of a day: "Last today" is not English.
 */
function agoLabel(days: number): string {
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `Last ${days} days ago`;
}

/** Every mark on the chart, named once, behind the (i). */
function LegendSheet({ journey }: { journey: Journey }) {
  const shotColor = journey.medications[0]?.color ?? colors.med[0];

  return (
    <View style={styles.legend}>
      <LegendRow text="A shot you logged, in its medication's colour">
        <Rect x={8} y={2} width={4} height={10} rx={2} fill={shotColor} />
      </LegendRow>
      <LegendRow text="A scheduled dose with nothing logged against it">
        <Rect x={8} y={2} width={4} height={10} rx={2} fill="rgba(17,20,24,0.16)" />
      </LegendRow>
      <LegendRow text="A dose due today">
        <Circle cx={10} cy={6.5} r={5.5} fill="none" stroke={colors.successDeep} strokeWidth={2} />
        <Circle cx={10} cy={6.5} r={2.2} fill={colors.successDeep} />
      </LegendRow>
      <LegendRow text="A side effect. The mark grows with the severity you logged">
        <Circle cx={10} cy={6.5} r={5} fill={colors.violet} />
      </LegendRow>
      <LegendRow text="Your goal weight, set in Profile">
        <Line
          x1={1}
          y1={6.5}
          x2={19}
          y2={6.5}
          stroke={colors.amber}
          strokeOpacity={0.55}
          strokeWidth={1.6}
          strokeDasharray="5 5"
        />
      </LegendRow>

      <View style={styles.rule} />
      <Text variant="small" color={colors.inkMuted}>
        Estimate only. Do not use it to make dosing decisions.
      </Text>
      <Text variant="small" color={colors.inkSubtle}>
        Drawn from the weights and shots you logged. Poke does not predict a result and does not
        propose a dose.
      </Text>
    </View>
  );
}

function LegendRow({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <View style={styles.legendRow}>
      <Svg width={20} height={14}>{children}</Svg>
      <Text variant="small" style={styles.legendText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  top: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  since: {
    flexShrink: 1,
  },
  streak: {
    height: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    borderRadius: radius.pill,
    backgroundColor: colors.successSoft,
  },
  card: {
    marginTop: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    ...elevation.card,
  },
  axis: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  chip: {
    height: 32,
    justifyContent: 'center',
    paddingHorizontal: 13,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipOn: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  spacer: {
    flex: 1,
  },
  info: {
    width: 30,
    height: 30,
    marginRight: -8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  read: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: 4,
    paddingHorizontal: spacing.xl,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
  },
  totals: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  unlock: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 10,
    paddingRight: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  chart: {
    width: '100%',
  },
  legend: {
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  legendText: {
    flex: 1,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.xs,
    backgroundColor: colors.divider,
  },
});
