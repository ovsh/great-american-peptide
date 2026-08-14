// One day of the board, opened as a half sheet.
//
// The sheet is the cell you tapped, enlarged: the same mark vocabulary at row
// scale, so a solid stripe in the grid is a solid stripe in the sheet. A dose
// that never happened keeps its hollow mark and is written in the colour of a
// plan rather than of a record — the row says what the schedule wanted, not
// what you did.
//
// The board is never reflowed under the finger, so a day with seven entries
// cannot push the month off the screen. The cost is that the sheet is a mode:
// the scrim and the drag-down both dismiss it.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronRight, Syringe, Trash2 } from 'lucide-react-native';

import { Text } from './Text';
import { medicationColor } from './today-hero-card';
import type { InjectionRow, MeasurementRow, MedicationRow } from '../db/types';
import { getBodySite } from '../domain/bodySites';
import { doseOnDay } from '../domain/doseByDay';
import { cadenceLabel, type BoardDay, type LaneMark } from '../domain/historyBoard';
import { sideEffectLabel } from '../domain/sideEffects';
import { formatDose, formatWeight, type WeightUnit } from '../domain/units';
import { listInjections } from '../repositories/injections';
import { listMeasurements } from '../repositories/measurements';
import { listSideEffects, softDeleteSideEffect, type SideEffectLog } from '../repositories/sideEffects';
import { deleteInjectionAndRefresh } from '../services/injectionMutations';
import { colors, easing, motion, radius, spacing, text } from '../theme';
import { confirmDelete } from '../utils/confirmDelete';
import { endOfDay, fmtTime } from '../utils/date';

const SHEET_MIN_HEIGHT = 400;
const SHEET_MAX_HEIGHT = 560;
const SHEET_FRACTION = 0.56;
/** How far the sheet has to be dragged down before releasing dismisses it. */
const DISMISS_DISTANCE = 90;
const DELETE_WIDTH = 88;

const MONTH_SHORT = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;
const WEEKDAYS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const;

function dayTitle(dayStart: number): string {
  const date = new Date(dayStart);
  return `${WEEKDAYS[date.getDay()]}, ${MONTH_SHORT[date.getMonth()]} ${date.getDate()}`;
}

function dayAndMonth(dayStart: number): string {
  const date = new Date(dayStart);
  return `${MONTH_SHORT[date.getMonth()]} ${date.getDate()}`;
}

/* ── what a day holds ─────────────────────────────────────────────────── */

interface DayEntries {
  shots: InjectionRow[];
  weights: MeasurementRow[];
  effects: SideEffectLog[];
}

const EMPTY_ENTRIES: DayEntries = { shots: [], weights: [], effects: [] };

/* ── a row that can be swiped away ────────────────────────────────────── */

/**
 * A record row, with delete behind it, and an editor in front of it when the
 * record has one.
 *
 * A shot row carries two verbs now. The press opens the shot on the log screen,
 * and the chevron on the row is the promise that it does. Delete stays behind
 * the swipe, where a phone user looks for it, and both verbs are published as
 * accessibility actions for anyone who cannot swipe or tap accurately.
 *
 * A row with no `onPress` draws no chevron and takes no tap: a weight and a
 * missed dose have nowhere to go.
 */
function SwipeRow({
  children,
  deleteLabel,
  onDelete,
  openLabel,
  onOpen,
}: {
  children: React.ReactNode;
  deleteLabel: string;
  onDelete: () => void;
  openLabel?: string;
  onOpen?: () => void;
}) {
  const offset = useSharedValue(0);
  const open = useSharedValue(0);
  const reduced = useReducedMotion();
  const duration = reduced ? 0 : motion.fast;

  const pan = Gesture.Pan()
    .activeOffsetX([-14, 14])
    .failOffsetY([-10, 10])
    .onUpdate((event) => {
      const next = open.value + event.translationX;
      offset.value = Math.min(0, Math.max(-DELETE_WIDTH, next));
    })
    .onEnd(() => {
      const to = offset.value < -DELETE_WIDTH / 2 ? -DELETE_WIDTH : 0;
      open.value = to;
      offset.value = withTiming(to, { duration, easing: easing.out });
    });

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));

  const close = () => {
    open.value = 0;
    offset.value = withTiming(0, { duration, easing: easing.out });
  };

  const remove = () => {
    close();
    onDelete();
  };

  const press = () => {
    // A revealed delete button owns the next tap. It puts the row back, so a
    // finger that reaches for the row it just uncovered cannot open a screen it
    // did not ask for.
    if (open.value !== 0) {
      close();
      return;
    }
    onOpen?.();
  };

  return (
    <View style={styles.swipeRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={deleteLabel}
        onPress={remove}
        style={styles.deleteAction}
      >
        <Trash2 size={19} color={colors.inkInverse} />
      </Pressable>
      <GestureDetector gesture={pan}>
        {/*
          The row is one accessibility element, and which node holds it depends
          on whether the row opens anything. A row that opens a screen hands the
          job to the pressable inside, so the row reads as a button and the press
          is the real press. A row that opens nothing keeps it here, the way it
          always has. Marking both is what draws a button inside a button, which
          is invalid on the web and reads the row out twice everywhere else.
        */}
        <Animated.View
          accessible={!onOpen}
          accessibilityActions={onOpen ? undefined : [{ name: 'delete', label: 'Delete' }]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'delete') remove();
          }}
          style={[styles.swipeSurface, style]}
        >
          {onOpen ? (
            <Pressable
              accessible
              accessibilityRole="button"
              accessibilityLabel={openLabel}
              accessibilityActions={[{ name: 'delete', label: 'Delete' }]}
              onAccessibilityAction={(event) => {
                if (event.nativeEvent.actionName === 'delete') remove();
              }}
              onPress={press}
              style={({ pressed }) => (pressed ? styles.rowPressed : null)}
            >
              {children}
            </Pressable>
          ) : children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

/* ── the rows ─────────────────────────────────────────────────────────── */

function Row({
  mark,
  hex,
  round,
  title,
  meta,
  value,
  planned,
  chevron,
}: {
  mark: 'logged' | 'missed' | 'point';
  hex: string;
  round?: boolean;
  title: string;
  meta: string;
  value: string;
  planned?: boolean;
  /** Drawn on a row that opens something. It is the row's promise of a screen. */
  chevron?: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowMark}>
        <View
          style={[
            round ? styles.markPoint : styles.markBar,
            mark === 'missed'
              ? { borderWidth: 1.6, borderColor: hex }
              : { backgroundColor: hex },
          ]}
        />
      </View>
      <View style={styles.rowCopy}>
        <Text variant="smallStrong" numberOfLines={1} style={styles.rowTitle}>
          {title}
        </Text>
        <Text variant="small" color={colors.inkMuted} numberOfLines={1} style={styles.rowMeta}>
          {meta}
        </Text>
      </View>
      <Text
        variant="smallStrong"
        color={planned ? colors.inkSubtle : colors.ink}
        style={styles.rowValue}
      >
        {value}
      </Text>
      {chevron ? <ChevronRight size={18} color={colors.inkSubtle} /> : null}
    </View>
  );
}

/* ── the sheet ────────────────────────────────────────────────────────── */

export interface HistoryDaySheetProps {
  /** The open day, or null. The sheet keeps drawing the last one while it leaves. */
  day: BoardDay | null;
  lanes: readonly MedicationRow[];
  /** Every medication, archived ones included, so an old shot still has a name. */
  medicationsById: ReadonlyMap<string, MedicationRow>;
  weightUnit: WeightUnit;
  dataVersion: number;
  onClose: () => void;
  onChanged: () => void;
  onLogShot: (day: BoardDay) => void;
}

export function HistoryDaySheet({
  day,
  lanes,
  medicationsById,
  weightUnit,
  dataVersion,
  onClose,
  onChanged,
  onLogShot,
}: HistoryDaySheetProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const reduced = useReducedMotion();

  const sheetHeight = Math.max(
    SHEET_MIN_HEIGHT,
    Math.min(SHEET_MAX_HEIGHT, Math.round(windowHeight * SHEET_FRACTION)),
  ) + insets.bottom;

  const [shown, setShown] = useState<BoardDay | null>(null);
  const [entries, setEntries] = useState<DayEntries>(EMPTY_ENTRIES);

  const veil = useSharedValue(0);
  const slide = useSharedValue(1);
  const drag = useSharedValue(0);

  // Both start on the same frame; the scrim is fast and the sheet lands last.
  useEffect(() => {
    if (day) {
      setShown(day);
      drag.value = 0;
      veil.value = withTiming(1, { duration: reduced ? 0 : motion.fast, easing: easing.standard });
      slide.value = withTiming(0, { duration: reduced ? 0 : motion.base, easing: easing.out });
      return;
    }
    veil.value = withTiming(0, { duration: reduced ? 0 : motion.fast, easing: easing.standard });
    slide.value = withTiming(1, { duration: reduced ? 0 : motion.base, easing: easing.in }, (done) => {
      if (done) runOnJS(setShown)(null);
    });
  }, [day, veil, slide, drag, reduced]);

  const dayStart = shown?.dayStart ?? null;

  useEffect(() => {
    if (dayStart === null) return;
    let alive = true;
    Promise.all([
      listInjections({ fromMs: dayStart, toMs: endOfDay(dayStart), limit: 100 }),
      listMeasurements('weight', { fromMs: dayStart, toMs: endOfDay(dayStart), limit: 50 }),
      listSideEffects({ fromMs: dayStart, toMs: endOfDay(dayStart), limit: 50 }),
    ])
      .then(([shots, weights, effects]) => {
        if (!alive) return;
        setEntries({
          shots: [...shots].sort((a, b) => a.taken_at - b.taken_at),
          weights: [...weights].sort((a, b) => a.taken_at - b.taken_at),
          effects: [...effects].sort((a, b) => a.taken_at - b.taken_at),
        });
      })
      .catch(() => {
        if (alive) setEntries(EMPTY_ENTRIES);
      });
    return () => {
      alive = false;
    };
  }, [dayStart, dataVersion]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: veil.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slide.value * sheetHeight + drag.value }],
  }));

  const dismiss = Gesture.Pan()
    .activeOffsetY([-12, 12])
    .onUpdate((event) => {
      drag.value = Math.max(0, event.translationY);
    })
    .onEnd(() => {
      if (drag.value > DISMISS_DISTANCE) {
        runOnJS(onClose)();
        return;
      }
      drag.value = withTiming(0, { duration: reduced ? 0 : motion.fast, easing: easing.out });
    });

  const remove = useCallback(
    (label: string, run: () => Promise<void>) => {
      confirmDelete(label, () => {
        run().then(onChanged).catch(() => undefined);
      });
    },
    [onChanged],
  );

  /**
   * Opens one shot on the log screen, which is also the edit screen.
   *
   * The sheet closes first. Both are modals, and a log screen pushed over an
   * open sheet would drop the user back onto the sheet instead of onto the day
   * behind it, with the row it just changed still reading the old numbers.
   */
  const openShot = useCallback(
    (shotId: string) => {
      onClose();
      router.push({ pathname: '/log-shot', params: { injectionId: shotId } });
    },
    [onClose],
  );

  /* The medication rows, in lane order: what happened, then what the schedule
     wanted and did not get. A shot of an archived medication still gets a row. */
  const medicationRows = useMemo(() => {
    if (!shown) return [];
    const rows: React.ReactNode[] = [];
    const claimed = new Set<string>();

    lanes.forEach((medication, laneIndex) => {
      const hex = medicationColor(medication.color_index);
      const mine = entries.shots.filter((shot) => shot.medication_id === medication.id);
      mine.forEach((shot) => claimed.add(shot.id));

      if (mine.length > 0) {
        mine.forEach((shot) => {
          rows.push(
            <SwipeRow
              key={shot.id}
              deleteLabel={`Delete ${medication.name} shot`}
              onDelete={() =>
                remove(`${medication.name}, ${fmtTime(shot.taken_at)}.`, () => deleteInjectionAndRefresh(shot.id))
              }
              openLabel={`Edit ${medication.name} shot, ${fmtTime(shot.taken_at)}`}
              onOpen={() => openShot(shot.id)}
            >
              <Row
                mark="logged"
                hex={hex}
                title={medication.name}
                meta={siteMeta(shot)}
                value={formatDose(shot.dose, shot.unit)}
                chevron
              />
            </SwipeRow>,
          );
        });
        return;
      }

      const mark = shown.marks[laneIndex] ?? 'none';
      const meta = planMeta(mark, medication);
      if (!meta) return;
      rows.push(
        <Row
          key={medication.id}
          mark="missed"
          hex={hex}
          title={medication.name}
          meta={meta}
          /* The dose the plan wanted on this day, which is the default dose
             unless the user set one per weekday. */
          value={formatDose(
            doseOnDay(medication.dose_by_day, medication.default_dose, shown.dayStart),
            medication.default_unit,
          )}
          planned
        />,
      );
    });

    // A shot whose medication is no longer in the list. History withholds nothing.
    entries.shots
      .filter((shot) => !claimed.has(shot.id))
      .forEach((shot) => {
        const medication = medicationsById.get(shot.medication_id);
        const hex = medication ? medicationColor(medication.color_index) : colors.inkSubtle;
        rows.push(
          <SwipeRow
            key={shot.id}
            deleteLabel="Delete shot"
            onDelete={() =>
              remove(`${medication?.name ?? 'Shot'}, ${fmtTime(shot.taken_at)}.`, () =>
                deleteInjectionAndRefresh(shot.id),
              )
            }
            openLabel={medication
              ? `Edit ${medication.name} shot, ${fmtTime(shot.taken_at)}`
              : `Edit shot, ${fmtTime(shot.taken_at)}`}
            onOpen={() => openShot(shot.id)}
          >
            <Row
              mark="logged"
              hex={hex}
              title={medication?.name ?? 'Shot'}
              meta={siteMeta(shot)}
              value={formatDose(shot.dose, shot.unit)}
              chevron
            />
          </SwipeRow>,
        );
      });

    return rows;
  }, [shown, lanes, entries.shots, medicationsById, remove, openShot]);

  const pointRows = useMemo(() => {
    const rows: React.ReactNode[] = [];
    entries.weights.forEach((measurement) => {
      const unit: WeightUnit = measurement.unit === 'kg' ? 'kg' : measurement.unit === 'lb' ? 'lb' : weightUnit;
      rows.push(
        <Row
          key={measurement.id}
          mark="point"
          round
          hex={colors.amber}
          title="Weight"
          meta={fmtTime(measurement.taken_at)}
          value={formatWeight(measurement.value, unit)}
        />,
      );
    });
    entries.effects.forEach((effect) => {
      rows.push(
        <SwipeRow
          key={effect.id}
          deleteLabel={`Delete ${sideEffectLabel(effect.effect)}`}
          onDelete={() =>
            remove(`${sideEffectLabel(effect.effect)}, ${fmtTime(effect.taken_at)}.`, () =>
              softDeleteSideEffect(effect.id),
            )
          }
        >
          <Row
            /* An all-clear draws the chart's own mark for it, the hollow violet
               ring, and carries no severity: the title is the whole reading. */
            mark={effect.effect.kind === 'clear' ? 'missed' : 'point'}
            round
            hex={colors.violet}
            title={sideEffectLabel(effect.effect)}
            meta={fmtTime(effect.taken_at)}
            value={effect.effect.kind === 'clear' ? '' : `${effect.severity} of 10`}
          />
        </SwipeRow>,
      );
    });
    return rows;
  }, [entries.weights, entries.effects, weightUnit, remove]);

  if (!shown) return null;

  const hasRows = medicationRows.length > 0 || pointRows.length > 0;
  const due = shown.marks.includes('due');
  const kept = !due
    && shown.marks.some((mark: LaneMark) => mark === 'logged' || mark === 'loggedTwice')
    && !shown.marks.includes('missed');
  const bandLabel = shown.isPast ? `Log shot on ${dayAndMonth(shown.dayStart)}` : 'Log shot';

  return (
    <Modal
      transparent
      visible
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[styles.scrim, scrimStyle]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            style={styles.scrimPress}
          />
        </Animated.View>

        <Animated.View
          testID="history-sheet"
          accessibilityViewIsModal
          style={[styles.sheet, { height: sheetHeight }, sheetStyle]}
        >
          <GestureDetector gesture={dismiss}>
            <View accessibilityRole="header" style={styles.head}>
              <View style={styles.grabber} />
              <Text variant="h2">{dayTitle(shown.dayStart)}</Text>
            </View>
          </GestureDetector>

          {hasRows ? (
            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            >
              {medicationRows}
              {medicationRows.length > 0 && pointRows.length > 0 ? <View style={styles.gap} /> : null}
              {pointRows}
            </ScrollView>
          ) : (
            <View style={styles.void}>
              <View
                accessibilityRole="image"
                accessibilityLabel={`Nothing logged on this day. ${lanes.length} medication lanes, all empty.`}
                style={styles.voidTile}
              >
                <Text style={styles.voidNumeral} color={colors.inkSubtle}>
                  {shown.dayOfMonth}
                </Text>
                <View style={styles.voidLanes}>
                  {lanes.map((medication) => (
                    <View key={medication.id} style={styles.voidLane} />
                  ))}
                </View>
              </View>
            </View>
          )}

          <Pressable
            testID="history-log-action"
            accessibilityRole="button"
            accessibilityLabel={bandLabel}
            onPress={() => onLogShot(shown)}
            style={[
              styles.band,
              { height: 82 + insets.bottom, paddingBottom: 26 + insets.bottom },
              due ? styles.bandDue : null,
              kept ? styles.bandKept : null,
            ]}
          >
            <Syringe size={18} color={due ? colors.inkInverse : colors.successDeep} />
            <Text
              variant={due ? 'bodyStrong' : 'smallStrong'}
              color={due ? colors.inkInverse : colors.successDeep}
              style={due ? undefined : styles.bandLabel}
            >
              {bandLabel}
            </Text>
          </Pressable>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

/** `8:05 am in the upper left abdomen`, or the time alone when no site was recorded. */
function siteMeta(shot: InjectionRow): string {
  const site = shot.site_id ? getBodySite(shot.site_id) : undefined;
  // Every site label starts a phrase, so it carries a capital of its own. Inside
  // the sentence it takes the lower case.
  return site
    ? `${fmtTime(shot.taken_at)} in the ${site.label.toLowerCase()}`
    : fmtTime(shot.taken_at);
}

/** What the schedule wanted on a day it did not get: `Missed, every Tuesday`. */
function planMeta(mark: LaneMark, medication: MedicationRow): string | null {
  if (mark === 'none' || mark === 'logged' || mark === 'loggedTwice') return null;
  const state = mark === 'missed' ? 'Missed' : mark === 'due' ? 'Due today' : 'Planned';
  const cadence = cadenceLabel(medication);
  return cadence ? `${state}, ${cadence}` : state;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17,20,24,0.40)',
  },
  scrimPress: {
    flex: 1,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: colors.cardShadow,
    shadowOpacity: 0.16,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: -10 },
    elevation: 12,
  },
  head: {
    paddingHorizontal: spacing.screen,
    paddingBottom: 12,
  },
  grabber: {
    width: 38,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(17,20,24,0.22)',
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 7,
  },

  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 4,
  },
  swipeRow: {
    justifyContent: 'center',
  },
  deleteAction: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: DELETE_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
  },
  swipeSurface: {
    backgroundColor: colors.surface,
  },
  rowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  row: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.screen,
    paddingVertical: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  rowMark: {
    width: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markBar: {
    width: 18,
    height: 6,
    borderRadius: 3,
  },
  markPoint: {
    width: 11,
    height: 11,
    borderRadius: radius.pill,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 15,
    lineHeight: 20,
  },
  rowMeta: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 1,
  },
  rowValue: {
    fontVariant: ['tabular-nums'],
  },
  gap: {
    height: 9,
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },

  void: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voidTile: {
    width: 168,
    paddingTop: 20,
    paddingBottom: 22,
    borderRadius: 22,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(17,20,24,0.22)',
    alignItems: 'center',
    gap: 14,
  },
  voidNumeral: {
    ...text.h1,
    fontSize: 40,
    lineHeight: 44,
    fontVariant: ['tabular-nums'],
  },
  voidLanes: {
    gap: 6,
  },
  voidLane: {
    width: 76,
    height: 9,
    borderRadius: 5,
    backgroundColor: 'rgba(17,20,24,0.05)',
  },

  band: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  bandDue: {
    backgroundColor: colors.successDeep,
    borderTopColor: 'transparent',
  },
  bandKept: {
    backgroundColor: colors.successSoft,
    borderTopColor: 'transparent',
  },
  bandLabel: {
    fontSize: 15,
    lineHeight: 20,
  },
});
