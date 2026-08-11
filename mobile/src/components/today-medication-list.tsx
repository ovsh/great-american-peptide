import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { router } from 'expo-router';
import { format } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { GripVertical, Plus } from 'lucide-react-native';

import { Text } from '@/components/Text';
import { medicationColor } from '@/components/today-hero-card';
import { PressScale, usePressScale } from '@/components/today-motion';
import type { DoseState, TodayMedicationSummary } from '@/components/today-types';
import { FREE_MEDICATION_LIMIT } from '@/repositories/medications';
import {
  colors,
  easing,
  elevation,
  fonts,
  motion,
  radius,
  spacing,
  springTo,
  springs,
  timeTo,
} from '@/theme';

const ROW_HEIGHT = 54;
/** Reveal slot for the colour dot and the grip, which trade places inside it. */
const HANDLE_WIDTH = 16;
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const CHIP_FILL = [colors.surfaceMuted, colors.successSoft];
const CHIP_EDGE = [colors.border, 'rgba(20,122,82,0.2)'];
const CHIP_INK = [colors.inkMuted, colors.successDeep];

interface MedicationListProps {
  rows: readonly TodayMedicationSummary[];
  /** Every running medication, the hero's one included. Decides the add shape. */
  activeCount: number;
  onSelect: (medicationId: string) => void;
  onReorder: (medicationIds: readonly string[]) => void;
  onDragChange: (dragging: boolean) => void;
}

/**
 * The rest of the medications, and the way to add one more.
 *
 * The add affordance has two shapes, and which one shows is decided by how much
 * of the free allowance is still open, not by how long the list is:
 *
 * - Under the allowance the list has no rows left to draw — the one medication
 *   is in the hero — so the card is dropped and an empty slot stands in its
 *   place. A card whose only row is "Add medication" is a footer with nothing
 *   above it, and the second medication is the moment Poke starts being useful.
 * - At the allowance and above, the slot collapses back to the quiet last row of
 *   the list card. Adding is no longer the point of the screen by then.
 */
export function TodayMedicationList(props: MedicationListProps) {
  // The slot replaces the whole card, so the drag machinery below is not just
  // unused in that state — it has nothing to hold.
  if (props.rows.length === 0 && props.activeCount < FREE_MEDICATION_LIMIT) {
    return <AddSlot first={props.activeCount === 0} />;
  }
  return <MedicationCard {...props} />;
}

/**
 * Every medication that is not the one in the hero card, plus the way to add
 * another. One tap moves a row into the hero; a hold picks it up.
 *
 * The order is the user's, and it is the order Today opens in, so the list is
 * the only place it can be set.
 *
 * Motion. The hold is a gate with nothing in it — 250 ms of stillness, and the
 * platform cancels it if the finger travels, so a scroll never becomes a lift.
 * What the lift changes is the mode of the card, and the card says so: every
 * colour dot turns into a grip in the same 16 pt slot, so no row changes width
 * and no text moves. The drop springs the row into its slot and the list only
 * re-orders once it has landed, so nothing ever jumps a row-height.
 */
function MedicationCard({
  rows,
  onSelect,
  onReorder,
  onDragChange,
}: MedicationListProps) {
  const reduced = useReducedMotion();
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeIndex = useSharedValue(-1);
  const hoverIndex = useSharedValue(-1);
  const dragY = useSharedValue(0);
  /** 0 at rest, 1 while a row is off the card. Drives the lift and the grips. */
  const lift = useSharedValue(0);
  const awaitingOrder = useRef(false);
  const failsafe = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** True from the moment a row is picked up until the finger leaves the card. */
  const holding = useRef(false);

  const order = rows.map((row) => row.medication.id).join('|');

  const clearDrag = useCallback(() => {
    activeIndex.value = -1;
    hoverIndex.value = -1;
    dragY.value = 0;
  }, [activeIndex, dragY, hoverIndex]);

  const releaseDrag = useCallback(() => {
    awaitingOrder.current = false;
    holding.current = false;
    if (failsafe.current !== null) {
      clearTimeout(failsafe.current);
      failsafe.current = null;
    }
    setActiveId(null);
    onDragChange(false);
    lift.value = springTo(0, { config: springs.settle, reduced });
  }, [lift, onDragChange, reduced]);

  const beginDrag = useCallback((medicationId: string) => {
    holding.current = true;
    setActiveId(medicationId);
    onDragChange(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [onDragChange]);

  const endHold = useCallback(() => {
    holding.current = false;
  }, []);

  const cancelDrag = useCallback(() => {
    clearDrag();
    releaseDrag();
  }, [clearDrag, releaseDrag]);

  /**
   * The row has landed on its slot and holds itself there with a transform. The
   * new order is applied now, and the transform is only released once React has
   * drawn it — otherwise the row would sit one slot out for a frame.
   */
  const landDrag = useCallback((from: number, to: number) => {
    if (from === to) {
      cancelDrag();
      return;
    }
    const ids = rows.map((row) => row.medication.id);
    const moved = ids[from];
    if (moved === undefined) {
      cancelDrag();
      return;
    }
    ids.splice(from, 1);
    ids.splice(to, 0, moved);
    awaitingOrder.current = true;
    // If the new order never arrives — a rejected write, a screen going away —
    // the card must not stay in drag mode.
    failsafe.current = setTimeout(cancelDrag, motion.slow);
    Haptics.selectionAsync().catch(() => {});
    onReorder(ids);
  }, [cancelDrag, onReorder, rows]);

  useLayoutEffect(() => {
    if (!awaitingOrder.current) return;
    // A second row was picked up while the first was still landing. That gesture
    // owns the shared values now, and clearing them would drop it.
    if (holding.current) {
      awaitingOrder.current = false;
      return;
    }
    clearDrag();
    releaseDrag();
  }, [clearDrag, order, releaseDrag]);

  useEffect(() => () => {
    if (failsafe.current !== null) clearTimeout(failsafe.current);
  }, []);

  return (
    <View testID="today-medication-list" style={styles.card}>
      <View style={styles.rows}>
        <DropPlaceholder hoverIndex={hoverIndex} lift={lift} />
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
            lift={lift}
            onSelect={onSelect}
            onBeginDrag={beginDrag}
            onEndHold={endHold}
            onCancelDrag={cancelDrag}
            onLand={landDrag}
          />
        ))}
      </View>

      <PressScale>
        {(handlers) => (
          <Pressable
            testID="today-add-medication"
            accessibilityRole="button"
            accessibilityLabel="Add medication"
            onPress={() => router.push('/medications/new')}
            style={[styles.row, rows.length > 0 && styles.rowDivided]}
            {...handlers}
          >
            <View style={styles.addCircle}>
              <Plus size={14} strokeWidth={2.4} color={colors.successDeep} />
            </View>
            <Text color={colors.successDeep} style={styles.addLabel}>Add medication</Text>
          </Pressable>
        )}
      </PressScale>
    </View>
  );
}

/**
 * The empty slot: a row-height card, dashed, standing where the medication the
 * user has not added yet will stand.
 *
 * The dash is ink, not green. Green dashes on soft green are already the drop
 * placeholder a lifted row falls into, and an invitation and a drag target must
 * not look alike. What the slot keeps from the add row is the part that names
 * the action — the soft-green disc and the deep-green word — so the affordance
 * is recognised again once it collapses back into the list.
 *
 * No price and no plan chip. The slot says what it gives; the third medication
 * is where the paywall lives, and `medications/new` already carries it.
 */
function AddSlot({ first }: { first: boolean }) {
  const label = first ? 'Add your first medication' : 'Add your second medication';

  return (
    <PressScale>
      {(handlers) => (
        <Pressable
          testID="today-add-slot"
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={() => router.push('/medications/new')}
          style={styles.slot}
          {...handlers}
        >
          <View style={styles.slotDisc}>
            <Plus size={14} strokeWidth={2.4} color={colors.successDeep} />
          </View>
          <Text color={colors.successDeep} style={styles.slotLabel}>{label}</Text>
        </Pressable>
      )}
    </PressScale>
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
  lift,
  onSelect,
  onBeginDrag,
  onEndHold,
  onCancelDrag,
  onLand,
}: {
  summary: TodayMedicationSummary;
  index: number;
  count: number;
  active: boolean;
  dragging: boolean;
  activeIndex: SharedValue<number>;
  hoverIndex: SharedValue<number>;
  dragY: SharedValue<number>;
  lift: SharedValue<number>;
  onSelect: (medicationId: string) => void;
  onBeginDrag: (medicationId: string) => void;
  onEndHold: () => void;
  onCancelDrag: () => void;
  onLand: (from: number, to: number) => void;
}) {
  const reduced = useReducedMotion();
  const medication = summary.medication;
  const chip = rowChip(summary);
  const press = usePressScale();

  const pan = Gesture.Pan()
    .activateAfterLongPress(motion.hold)
    .onStart(() => {
      activeIndex.value = index;
      hoverIndex.value = index;
      dragY.value = 0;
      lift.value = reduced ? 1 : withSpring(1, springs.lift);
      runOnJS(onBeginDrag)(medication.id);
    })
    .onUpdate((event) => {
      dragY.value = event.translationY;
      const steps = Math.round(event.translationY / ROW_HEIGHT);
      hoverIndex.value = Math.min(Math.max(index + steps, 0), count - 1);
    })
    .onEnd(() => {
      // The row travels to the slot it is over, and the list is told to re-order
      // only once it is there.
      const to = hoverIndex.value;
      const slot = (to - index) * ROW_HEIGHT;
      if (reduced) {
        dragY.value = slot;
        runOnJS(onLand)(index, to);
        return;
      }
      dragY.value = withSpring(slot, springs.settle, () => {
        runOnJS(onLand)(index, to);
      });
    })
    .onFinalize((_event, success) => {
      if (success) {
        runOnJS(onEndHold)();
        return;
      }
      activeIndex.value = -1;
      hoverIndex.value = -1;
      dragY.value = 0;
      runOnJS(onCancelDrag)();
    });

  const outer = useAnimatedStyle(() => {
    const held = activeIndex.value === index;
    if (held) {
      return {
        zIndex: 3,
        transform: [
          { translateY: dragY.value },
          { scale: 1 + 0.025 * lift.value },
          { rotate: `${-lift.value}deg` },
        ],
      };
    }
    const from = activeIndex.value;
    const to = hoverIndex.value;
    let shift = 0;
    if (from >= 0) {
      if (from < to && index > from && index <= to) shift = -ROW_HEIGHT;
      else if (from > to && index >= to && index < from) shift = ROW_HEIGHT;
    }
    return {
      zIndex: 0,
      transform: [
        { translateY: reduced ? shift : withSpring(shift, springs.settle) },
        { scale: 1 - 0.03 * press.pressed.value },
      ],
    };
  });

  const surface = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(press.pressed.value, [0, 1], [
      colors.surface,
      colors.surfaceMuted,
    ]),
    shadowOpacity: 0.1 * lift.value * (activeIndex.value === index ? 1 : 0),
    shadowRadius: 26 * lift.value,
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={outer}>
        <AnimatedPressable
          testID={`today-medication-row-${medication.id}`}
          accessibilityRole="button"
          accessibilityLabel={`${medication.name}, ${chip.spoken}`}
          accessibilityHint="Shows this medication in the card above. Hold to reorder."
          onPress={() => onSelect(medication.id)}
          onPressIn={dragging ? undefined : press.onPressIn}
          onPressOut={dragging ? undefined : press.onPressOut}
          style={[
            styles.row,
            styles.medRow,
            index > 0 && styles.rowDivided,
            active && styles.rowLift,
            surface,
          ]}
        >
          <RowHandle color={medicationColor(medication.color_index)} lift={lift} />
          <Text numberOfLines={1} style={styles.name}>{medication.name}</Text>
          <RowChip label={chip.label} due={chip.tone === 'due'} reduced={reduced} />
        </AnimatedPressable>
      </Animated.View>
    </GestureDetector>
  );
}

/**
 * The colour dot and the grip share one slot and trade places inside it. Nothing
 * widens, so the name and the chip beside it never move — the row only changes
 * what it says about itself.
 */
function RowHandle({ color, lift }: { color: string; lift: SharedValue<number> }) {
  const dot = useAnimatedStyle(() => ({
    opacity: 1 - lift.value,
    transform: [{ scale: 0.8 + 0.2 * (1 - lift.value) }],
  }));
  const grip = useAnimatedStyle(() => ({
    opacity: lift.value,
    transform: [{ scale: 0.8 + 0.2 * lift.value }],
  }));

  return (
    <View style={styles.handle}>
      <Animated.View style={[styles.handleLayer, dot]}>
        <View style={[styles.dot, { backgroundColor: color }]} />
      </Animated.View>
      <Animated.View style={[styles.handleLayer, grip]}>
        <GripVertical size={16} color={colors.inkSubtle} />
      </Animated.View>
    </View>
  );
}

/** Due, Done, or the day. The words cut; the colour does not. */
function RowChip({ label, due, reduced }: { label: string; due: boolean; reduced: boolean }) {
  const tone = useSharedValue(due ? 1 : 0);

  useEffect(() => {
    tone.value = timeTo(due ? 1 : 0, {
      duration: motion.fast,
      easing: easing.standard,
      reduced,
    });
  }, [due, reduced, tone]);

  const box = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(tone.value, [0, 1], CHIP_FILL),
    borderColor: interpolateColor(tone.value, [0, 1], CHIP_EDGE),
  }));
  const ink = useAnimatedStyle(() => ({
    color: interpolateColor(tone.value, [0, 1], CHIP_INK),
  }));

  return (
    <Animated.View style={[styles.chip, box]}>
      <Animated.Text style={[styles.chipLabel, ink]}>{label}</Animated.Text>
    </Animated.View>
  );
}

/** The slot the lifted row drops into. It is the only thing that says where. */
function DropPlaceholder({
  hoverIndex,
  lift,
}: {
  hoverIndex: SharedValue<number>;
  lift: SharedValue<number>;
}) {
  const reduced = useReducedMotion();
  const style = useAnimatedStyle(() => {
    const slot = Math.max(0, hoverIndex.value) * ROW_HEIGHT;
    return {
      opacity: interpolate(lift.value, [0, 1], [0, 1], 'clamp'),
      transform: [{ translateY: reduced ? slot : withSpring(slot, springs.settle) }],
    };
  });

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
  rowLift: {
    borderTopColor: 'transparent',
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
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
  handle: {
    width: HANDLE_WIDTH,
    height: HANDLE_WIDTH,
  },
  handleLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
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
    textAlign: 'center',
  },
  chip: {
    minWidth: 44,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
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
  // The height of a real row, so the slot reads as the medication that is not
  // there yet rather than as a button that happens to be wide.
  slot: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.xl,
    borderWidth: 1.6,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  slotDisc: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.successSoft,
  },
  slotLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.15,
  },
});
