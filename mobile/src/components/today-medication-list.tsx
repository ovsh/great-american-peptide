import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { router } from 'expo-router';
import { format } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { GripVertical, Plus } from 'lucide-react-native';

import { Text } from '@/components/Text';
import { medicationColor } from '@/components/today-hero-card';
import type { DoseState, TodayMedicationSummary } from '@/components/today-types';
import { colors, elevation, fonts, motion, radius, spacing } from '@/theme';

const ROW_HEIGHT = 54;
const LONG_PRESS_MS = 220;

/**
 * Every medication that is not the one in the hero card, plus the way to add
 * another. One tap moves a row into the hero; a hold picks it up.
 *
 * The order is the user's, and it is the order Today opens in, so the list is
 * the only place it can be set.
 */
export function TodayMedicationList({
  rows,
  onSelect,
  onReorder,
  onDragChange,
}: {
  rows: readonly TodayMedicationSummary[];
  onSelect: (medicationId: string) => void;
  onReorder: (medicationIds: readonly string[]) => void;
  onDragChange: (dragging: boolean) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeIndex = useSharedValue(-1);
  const hoverIndex = useSharedValue(-1);
  const dragY = useSharedValue(0);

  const beginDrag = useCallback((medicationId: string) => {
    setActiveId(medicationId);
    onDragChange(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [onDragChange]);

  const endDrag = useCallback(() => {
    setActiveId(null);
    onDragChange(false);
  }, [onDragChange]);

  const commit = useCallback((from: number, to: number) => {
    if (from === to) return;
    const ids = rows.map((row) => row.medication.id);
    const moved = ids[from];
    if (moved === undefined) return;
    ids.splice(from, 1);
    ids.splice(to, 0, moved);
    Haptics.selectionAsync().catch(() => {});
    onReorder(ids);
  }, [onReorder, rows]);

  return (
    <View testID="today-medication-list" style={styles.card}>
      <View style={styles.rows}>
        <DropPlaceholder activeIndex={activeIndex} hoverIndex={hoverIndex} />
        {rows.map((row, index) => (
          <MedicationRow
            key={row.medication.id}
            summary={row}
            index={index}
            count={rows.length}
            active={activeId === row.medication.id}
            dragging={activeId !== null}
            activeIndex={activeIndex}
            hoverIndex={hoverIndex}
            dragY={dragY}
            onSelect={onSelect}
            onBeginDrag={beginDrag}
            onEndDrag={endDrag}
            onCommit={commit}
          />
        ))}
      </View>

      <Pressable
        testID="today-add-medication"
        accessibilityRole="button"
        accessibilityLabel="Add medication"
        onPress={() => router.push('/medications/new')}
        style={({ pressed }) => [
          styles.row,
          rows.length > 0 && styles.rowDivided,
          pressed && styles.rowPressed,
        ]}
      >
        <View style={styles.addCircle}>
          <Plus size={14} strokeWidth={2.4} color={colors.successDeep} />
        </View>
        <Text color={colors.successDeep} style={styles.addLabel}>Add medication</Text>
      </Pressable>
    </View>
  );
}

function MedicationRow({
  summary,
  index,
  count,
  active,
  dragging,
  activeIndex,
  hoverIndex,
  dragY,
  onSelect,
  onBeginDrag,
  onEndDrag,
  onCommit,
}: {
  summary: TodayMedicationSummary;
  index: number;
  count: number;
  active: boolean;
  dragging: boolean;
  activeIndex: SharedValue<number>;
  hoverIndex: SharedValue<number>;
  dragY: SharedValue<number>;
  onSelect: (medicationId: string) => void;
  onBeginDrag: (medicationId: string) => void;
  onEndDrag: () => void;
  onCommit: (from: number, to: number) => void;
}) {
  const medication = summary.medication;
  const chip = rowChip(summary);

  const pan = Gesture.Pan()
    .activateAfterLongPress(LONG_PRESS_MS)
    .onStart(() => {
      activeIndex.value = index;
      hoverIndex.value = index;
      dragY.value = 0;
      runOnJS(onBeginDrag)(medication.id);
    })
    .onUpdate((event) => {
      dragY.value = event.translationY;
      const steps = Math.round(event.translationY / ROW_HEIGHT);
      hoverIndex.value = Math.min(Math.max(index + steps, 0), count - 1);
    })
    .onEnd(() => {
      runOnJS(onCommit)(index, hoverIndex.value);
    })
    .onFinalize(() => {
      activeIndex.value = -1;
      hoverIndex.value = -1;
      dragY.value = 0;
      runOnJS(onEndDrag)();
    });

  const animated = useAnimatedStyle(() => {
    if (activeIndex.value === index) {
      return {
        zIndex: 3,
        transform: [
          { translateY: dragY.value },
          { scale: 1.02 },
          { rotate: '-1deg' },
        ],
      };
    }
    if (activeIndex.value < 0) {
      return { zIndex: 0, transform: [{ translateY: withTiming(0, { duration: motion.fast }) }] };
    }
    const from = activeIndex.value;
    const to = hoverIndex.value;
    let shift = 0;
    if (from < to && index > from && index <= to) shift = -ROW_HEIGHT;
    else if (from > to && index >= to && index < from) shift = ROW_HEIGHT;
    return {
      zIndex: 0,
      transform: [{ translateY: withTiming(shift, { duration: motion.fast }) }],
    };
  });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={animated}>
        <Pressable
          testID={`today-medication-row-${medication.id}`}
          accessibilityRole="button"
          accessibilityLabel={`${medication.name}, ${chip.spoken}`}
          accessibilityHint="Shows this medication in the card above. Hold to reorder."
          onPress={() => onSelect(medication.id)}
          style={({ pressed }) => [
            styles.row,
            styles.medRow,
            index > 0 && styles.rowDivided,
            active && styles.rowLift,
            pressed && !dragging && styles.rowPressed,
          ]}
        >
          {dragging ? <GripVertical size={16} color={colors.inkSubtle} /> : null}
          <View style={[styles.dot, { backgroundColor: medicationColor(medication.color_index) }]} />
          <Text numberOfLines={1} style={styles.name}>{medication.name}</Text>
          <View style={[styles.chip, chip.tone === 'due' && styles.chipDue]}>
            <Text
              align="center"
              style={styles.chipLabel}
              color={chip.tone === 'due' ? colors.successDeep : colors.inkMuted}
            >
              {chip.label}
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

/** The slot the lifted row drops into. It is the only thing that says where. */
function DropPlaceholder({
  activeIndex,
  hoverIndex,
}: {
  activeIndex: SharedValue<number>;
  hoverIndex: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: activeIndex.value < 0 ? 0 : 1,
    transform: [{ translateY: withTiming(Math.max(0, hoverIndex.value) * ROW_HEIGHT, { duration: motion.fast }) }],
  }));

  return <Animated.View pointerEvents="none" style={[styles.placeholder, style]} />;
}

function rowChip(summary: TodayMedicationSummary): {
  label: string;
  spoken: string;
  tone: 'due' | 'muted';
} {
  const dose: DoseState = summary.dose;
  switch (dose.kind) {
    case 'due':
      return { label: 'Due', spoken: 'due today', tone: 'due' };
    case 'loggedToday':
      return { label: 'Done', spoken: 'logged today', tone: 'due' };
    case 'upcoming':
      return summary.medication.frequency_kind === 'daily'
        ? { label: 'Daily', spoken: 'every day', tone: 'muted' }
        : {
          label: format(dose.scheduledAt, 'EEE'),
          spoken: `next shot ${format(dose.scheduledAt, 'EEEE, MMMM d')}`,
          tone: 'muted',
        };
    case 'unscheduled':
      return { label: 'Manual', spoken: 'no schedule', tone: 'muted' };
    default: {
      const exhaustive: never = dose;
      return exhaustive;
    }
  }
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    ...elevation.card,
  },
  rows: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  row: {
    minHeight: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.surface,
  },
  // Fixed, because the drop placeholder counts rows to find the slot the lifted
  // row falls into, and a row that grows by a hairline moves the count off.
  medRow: {
    height: ROW_HEIGHT,
  },
  rowDivided: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  rowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  rowLift: {
    borderTopColor: 'transparent',
    borderRadius: 14,
    ...elevation.raised,
  },
  placeholder: {
    position: 'absolute',
    left: spacing.sm,
    right: spacing.sm,
    top: 0,
    height: ROW_HEIGHT,
    borderWidth: 1.6,
    borderStyle: 'dashed',
    borderColor: 'rgba(20,122,82,0.45)',
    borderRadius: 14,
    backgroundColor: colors.successSoft,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
  },
  name: {
    flex: 1,
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.15,
  },
  chipLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    lineHeight: 16,
  },
  chip: {
    minWidth: 44,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  chipDue: {
    borderColor: 'rgba(20,122,82,0.2)',
    backgroundColor: colors.successSoft,
  },
  addCircle: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.successSoft,
    marginHorizontal: -4,
  },
  addLabel: {
    flex: 1,
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.15,
  },
});
