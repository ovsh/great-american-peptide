import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ChevronDown, ChevronUp, MapPin, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { addDays, differenceInCalendarDays, subDays } from 'date-fns';

import { BodyDiagram } from '@/components/BodyDiagram';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { InlineTimePicker } from '@/components/InlineTimePicker';
import { Input } from '@/components/Input';
import { Stepper } from '@/components/Stepper';
import { Text } from '@/components/Text';
import { TimeRangeToggle } from '@/components/TimeRangeToggle';
import { WheelPicker } from '@/components/WheelPicker';
import type { MedicationRow } from '@/db/types';
import { getBodySite, type BodySite, type View as BodyView } from '@/domain/bodySites';
import type { Unit } from '@/domain/peptides';
import { recommendNextSite } from '@/domain/rotation';
import { createInjection, lastSiteUseFor, type SiteUse } from '@/repositories/injections';
import { listMedications } from '@/repositories/medications';
import { maybePromptForReview, recordPositiveEvent } from '@/services/review';
import { refreshScheduledReminders } from '@/services/notifications';
import { useAppStore } from '@/stores/app';
import { colors, radius, spacing } from '@/theme';
import { fmtDayLabel, fmtTime, startOfDay } from '@/utils/date';
import { safeBack } from '@/utils/nav';

interface LogShotDraft {
  medicationId: string | null;
  dose: number;
  suggestedSiteId: string | null;
  selectedSiteId: string | null;
  takenAt: number;
  /**
   * True once the user picks a day or a time. Poke then keeps that answer and
   * stops moving `takenAt` to the clock.
   */
  takenAtChosen: boolean;
  notes: string;
  detailsOpen: boolean;
}

/**
 * A fresh draft, built when the screen opens. `takenAt` cannot sit in a module
 * constant: the constant runs once per bundle, so a phone left open from Monday
 * to Wednesday would file Wednesday's shot on Monday.
 *
 * `chosen` is the day the route named, or null. History sends it when the user
 * taps a past day on the calendar, and the draft opens on that day with the
 * answer already marked as the user's, so the clock does not take it back.
 */
function createDraft(chosen: number | null): LogShotDraft {
  return {
    medicationId: null,
    dose: 0,
    suggestedSiteId: null,
    selectedSiteId: null,
    takenAt: chosen ?? Date.now(),
    takenAtChosen: chosen !== null,
    notes: '',
    // Open, so the wheel shows the day the user tapped rather than hiding it
    // behind a summary line.
    detailsOpen: chosen !== null,
  };
}

/**
 * The highest dose Poke writes, per unit. The ceiling catches a digit that ran
 * away on the keypad and nothing else, so each one sits far above every real
 * dose:
 *
 *   iu  — HCG ships in a 10000 IU vial and a whole vial is one real dose.
 *   mcg — 20000 mcg is 20 mg, and the largest preset in mcg is 250 mcg.
 *   mg  — the largest preset in mg is NAD+ at 100 mg.
 *
 * One number for all three units is what broke this screen: 1000 is roomy for
 * mg and it cuts an HCG dose of 2500 iu down to 1000.
 */
const DOSE_MAX: Record<Unit, number> = {
  mg: 1000,
  mcg: 20000,
  iu: 20000,
};

/** How far back the date wheel reaches on its own. A missed shot gets filed within a month. */
const DATE_DAYS = 30;

/** How many used sites the diagram marks as recent. */
const RECENT_SITES = 4;

export default function LogShotScreen() {
  const params = useLocalSearchParams<{ medicationId?: string; takenAt?: string }>();
  const { width, height } = useWindowDimensions();
  const bumpVersion = useAppStore((state) => state.bumpVersion);
  const setFocusMedication = useAppStore((state) => state.setFocusMedication);
  const [medications, setMedications] = useState<MedicationRow[]>([]);
  // The selected medication's own sites, and nothing else. Rotation is per
  // medication by definition: a BPC-157 shot must not move because a
  // Retatrutide shot took a thigh last night.
  const [siteHistory, setSiteHistory] = useState<SiteUse[]>([]);
  const [draft, setDraft] = useState<LogShotDraft>(() => createDraft(dayFromRoute(params.takenAt, Date.now())));
  const [today, setToday] = useState(() => startOfDay(Date.now()));
  const [doseNotice, setDoseNotice] = useState<string | null>(null);
  const [view, setView] = useState<BodyView>('front');
  const [saving, setSaving] = useState(false);
  // Which site read the screen is waiting on. A second chip tapped while the
  // first one reads must win, whichever query answers first.
  const siteRequest = useRef(0);
  const appliedDay = useRef(params.takenAt);

  // The screen reads the clock every time it comes to the front, not only on
  // the first mount, so a modal that reopens on a later day opens on that day.
  useFocusEffect(useCallback(() => {
    const now = Date.now();
    setToday(startOfDay(now));
    setDraft((current) => (current.takenAtChosen ? current : { ...current, takenAt: now }));
  }, []));

  // The draft above reads the route on the first render, which is where a day
  // arrives for a push. A web reload can deliver it one render later, so a day
  // that changes after the first render lands here.
  useEffect(() => {
    if (params.takenAt === appliedDay.current) return;
    appliedDay.current = params.takenAt;
    const chosen = dayFromRoute(params.takenAt, Date.now());
    if (chosen === null) return;
    setDraft((current) => ({ ...current, takenAt: chosen, takenAtChosen: true, detailsOpen: true }));
  }, [params.takenAt]);

  const selectMedication = useCallback(async (medication: MedicationRow) => {
    const request = siteRequest.current + 1;
    siteRequest.current = request;
    setDoseNotice(null);
    setSiteHistory([]);
    setDraft((current) => ({
      ...current,
      medicationId: medication.id,
      dose: medication.default_dose,
      suggestedSiteId: null,
      selectedSiteId: null,
    }));
    selectionHaptic();
    const history = await lastSiteUseFor(medication.id).catch((): SiteUse[] => []);
    if (request !== siteRequest.current) return;
    const suggested = recommendNextSite(history, medication.default_route);
    setSiteHistory(history);
    setDraft((current) => (current.medicationId === medication.id
      ? { ...current, suggestedSiteId: suggested?.id ?? null, selectedSiteId: suggested?.id ?? null }
      : current));
    if (suggested) setView(suggested.view);
  }, []);

  useEffect(() => {
    listMedications()
      .then((medicationRows) => {
        const active = medicationRows.filter((medication) => medication.status === 'active');
        const requested = params.medicationId
          ? active.find((medication) => medication.id === params.medicationId)
          : undefined;
        const initial = requested ?? active[0];
        setMedications(active);
        if (initial) void selectMedication(initial);
      })
      .catch(() => {});
  }, [params.medicationId, selectMedication]);

  const selectedMedication = medications.find((medication) => medication.id === draft.medicationId) ?? null;
  const selectedSite = draft.selectedSiteId ? getBodySite(draft.selectedSiteId) : undefined;
  // Newest first out of the query, one entry per site, so this is the four sites
  // this medication went into most recently.
  const recentSiteIds = useMemo(
    () => siteHistory.slice(0, RECENT_SITES).map((use) => use.siteId),
    [siteHistory],
  );
  const siteCardMaxHeight = Math.min(390, Math.floor(height * 0.46));
  const diagramHeight = Math.max(170, siteCardMaxHeight - 152);
  const diagramWidth = Math.min(
    190,
    width - spacing.screen * 2 - spacing.xl * 2,
    diagramHeight / 2,
  );

  const doseUnit: Unit = selectedMedication?.default_unit ?? 'mg';
  // A dose the user already saved for this medication is an answer, not a typo,
  // so the ceiling never falls below it.
  const doseMax = Math.max(DOSE_MAX[doseUnit], selectedMedication?.default_dose ?? 0);

  const takenDay = startOfDay(draft.takenAt);
  // Oldest row at the top and today at the bottom, the way a calendar reads.
  // The wheel opens on the chosen day. Tomorrow has no row, so the user cannot
  // file a shot in the future.
  //
  // The range reaches back a month on its own, and further when the route names
  // an older day: History can send any day the calendar reaches, and a wheel
  // that cannot show that day would file the shot on the wrong one.
  const days = useMemo(() => {
    const oldest = Math.min(startOfDay(subDays(today, DATE_DAYS - 1).getTime()), takenDay);
    const span = differenceInCalendarDays(today, oldest) + 1;
    return Array.from({ length: span }, (_, index) => startOfDay(addDays(oldest, index).getTime()));
  }, [today, takenDay]);
  const detailsSummary = takenDay === today
    ? `${fmtTime(draft.takenAt)} and notes`
    : `${fmtDayLabel(draft.takenAt)} at ${fmtTime(draft.takenAt)} and notes`;

  const selectSite = (site: BodySite) => {
    setDraft((current) => ({ ...current, selectedSiteId: site.id }));
    selectionHaptic();
  };

  const save = async () => {
    if (!selectedMedication || draft.dose <= 0 || saving) return;
    setSaving(true);
    try {
      await createInjection({
        medicationId: selectedMedication.id,
        dose: draft.dose,
        unit: selectedMedication.default_unit,
        route: selectedMedication.default_route,
        siteId: draft.selectedSiteId,
        // The clock at the moment of saving, unless the user named a day or a
        // time. `log-weight` and `log-side-effect` read the clock here too.
        takenAt: draft.takenAtChosen ? draft.takenAt : Date.now(),
        notes: draft.notes.trim() || null,
      });
      bumpVersion();
      // Name the medication Today should open on, so the card behind this screen
      // is the one this shot went into.
      setFocusMedication(selectedMedication.id);
      await refreshScheduledReminders().catch(() => {});
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      safeBack('/');
      recordPositiveEvent().then(() => maybePromptForReview('shot-logged')).catch(() => {});
    } catch (error: unknown) {
      Alert.alert('Poke could not log your shot', error instanceof Error ? error.message : 'Try again.');
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <Header
        title="Log shot"
        leading={(
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => safeBack('/')} style={styles.close}>
            <X size={22} color={colors.ink} />
          </Pressable>
        )}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {medications.length === 0 ? (
          <Card style={styles.empty}>
            <Text variant="h2">Add a medication first.</Text>
            <Text color={colors.inkMuted}>A medication carries the dose and the route that a shot needs.</Text>
            <Button onPress={() => router.push('/medications/new')}>Add medication</Button>
          </Card>
        ) : (
          <>
            <View style={styles.section}>
              <Text variant="smallStrong">Medication</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {medications.map((medication) => {
                  const selected = medication.id === draft.medicationId;
                  return (
                    <Pressable
                      key={medication.id}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      onPress={() => { void selectMedication(medication); }}
                      style={[styles.chip, selected && styles.chipSelected]}
                    >
                      <Text variant="smallStrong" color={selected ? colors.inkInverse : colors.ink}>{medication.name}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text variant="smallStrong">Dose</Text>
                <Text variant="small" color={colors.inkMuted}>Your usual dose</Text>
              </View>
              <Stepper
                value={draft.dose}
                onChange={(dose) => {
                  setDoseNotice(null);
                  setDraft((current) => ({ ...current, dose }));
                }}
                step={doseUnit === 'mcg' ? 25 : draft.dose < 1 ? 0.05 : 0.1}
                min={0}
                max={doseMax}
                onAboveMax={(max) => setDoseNotice(
                  `Poke holds the dose at ${max} ${doseUnit}, the highest dose Poke accepts.`,
                )}
                format={(value) => value < 1 ? value.toFixed(2) : value.toFixed(1)}
                unit={selectedMedication?.default_unit ?? ''}
              />
              {draft.dose <= 0 ? (
                <Text variant="small" color={colors.danger}>Poke needs a dose above zero.</Text>
              ) : null}
              {doseNotice ? (
                <Text variant="small" color={colors.danger}>{doseNotice}</Text>
              ) : null}
            </View>

            {selectedMedication ? (
              <Card style={[styles.siteCard, { maxHeight: siteCardMaxHeight }]}>
                <View style={styles.sectionHead}>
                  <View style={styles.siteTitle}>
                    <MapPin size={18} color={colors.accent} />
                    <Text variant="smallStrong">Injection site</Text>
                  </View>
                  <TimeRangeToggle options={['front', 'back'] as const} value={view} onChange={setView} size="sm" />
                </View>
                <View style={styles.diagram}>
                  <BodyDiagram
                    width={diagramWidth}
                    height={diagramHeight}
                    view={view}
                    route={selectedMedication.default_route}
                    selectedId={draft.selectedSiteId}
                    suggestedId={draft.suggestedSiteId}
                    recentSiteIds={recentSiteIds}
                    onSelect={selectSite}
                  />
                </View>
                <Text variant="smallStrong" align="center">
                  {selectedSite?.label ?? 'No site yet'}
                </Text>
                <Text variant="caption" color={colors.inkMuted} align="center">
                  Poke suggests the next site. Tap the diagram to choose a different one.
                </Text>
              </Card>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={draft.detailsOpen ? 'Hide details' : 'Show details'}
              accessibilityState={{ expanded: draft.detailsOpen }}
              onPress={() => setDraft((current) => ({ ...current, detailsOpen: !current.detailsOpen }))}
              style={styles.detailsButton}
            >
              <View>
                <Text variant="bodyStrong">Details</Text>
                <Text variant="caption" color={colors.inkMuted}>{detailsSummary}</Text>
              </View>
              {draft.detailsOpen
                ? <ChevronUp size={20} color={colors.inkMuted} />
                : <ChevronDown size={20} color={colors.inkMuted} />}
            </Pressable>

            {draft.detailsOpen ? (
              <Card style={styles.details}>
                <View style={styles.section}>
                  <Text variant="smallStrong">Day</Text>
                  <WheelPicker
                    values={days}
                    value={takenDay}
                    onChange={(day) => setDraft((current) => ({
                      ...current,
                      takenAt: withDay(current.takenAt, day),
                      takenAtChosen: true,
                    }))}
                    format={fmtDayLabel}
                    accessibilityLabel="Shot day"
                  />
                </View>
                <View style={styles.section}>
                  <Text variant="smallStrong">Exact time</Text>
                  <InlineTimePicker
                    value={timeValue(draft.takenAt)}
                    onChange={(value) => setDraft((current) => ({
                      ...current,
                      takenAt: withTime(current.takenAt, value),
                      takenAtChosen: true,
                    }))}
                    label="Shot time"
                  />
                </View>
                <View style={styles.section}>
                  <Text variant="smallStrong">Notes</Text>
                  <Input
                    value={draft.notes}
                    onChangeText={(notes) => setDraft((current) => ({ ...current, notes }))}
                    placeholder="Add a note"
                  />
                </View>
              </Card>
            ) : null}

            <Button disabled={saving || !selectedMedication || draft.dose <= 0} onPress={save}>
              {saving ? 'Logging shot' : 'Log shot'}
            </Button>
          </>
        )}
      </ScrollView>
    </View>
  );
}

/**
 * The day the route named, as a timestamp on that day, or null.
 *
 * History sends the day the user tapped on the calendar. Poke keeps the hour and
 * the minute from the clock, so a shot filed three days late lands at a
 * plausible time of day rather than at midnight.
 *
 * A day that has not arrived is refused here, the way the wheel refuses one by
 * having no row past today. A log records a shot that happened.
 */
function dayFromRoute(value: string | undefined, now: number): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return null;
  const day = startOfDay(parsed);
  if (day > startOfDay(now)) return null;
  return withDay(now, day);
}

function timeValue(timestamp: number): string {
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Moves a timestamp to another day, and keeps the hour and the minute on it. */
function withDay(timestamp: number, day: number): number {
  const time = new Date(timestamp);
  const next = new Date(day);
  next.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return next.getTime();
}

function withTime(timestamp: number, value: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return timestamp;
  const hour = Number.parseInt(match[1] ?? '', 10);
  const minute = Number.parseInt(match[2] ?? '', 10);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return timestamp;
  const date = new Date(timestamp);
  date.setHours(hour, minute, 0, 0);
  return date.getTime();
}

function selectionHaptic() {
  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  close: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.hero,
  },
  section: {
    gap: spacing.md,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  chips: {
    gap: spacing.sm,
  },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    backgroundColor: colors.accent,
  },
  siteCard: {
    gap: spacing.md,
  },
  siteTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  diagram: {
    alignItems: 'center',
    overflow: 'hidden',
  },
  detailsButton: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  details: {
    gap: spacing.xl,
  },
  empty: {
    gap: spacing.lg,
  },
});
