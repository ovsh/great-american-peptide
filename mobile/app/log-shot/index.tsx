import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import type { InjectionRow, MedicationRow } from '@/db/types';
import { getBodySite, type BodySite, type View as BodyView } from '@/domain/bodySites';
import { doseOnDay, maxPlannedDose } from '@/domain/doseByDay';
import type { Route, Unit } from '@/domain/peptides';
import { recommendNextSite } from '@/domain/rotation';
import { siteOnRoute } from '@/domain/shotEdit';
import { getInjection, lastSiteUseFor, type SiteUse } from '@/repositories/injections';
import { listMedications } from '@/repositories/medications';
import {
  createInjectionAndRefresh,
  deleteInjectionAndRefresh,
  updateInjectionAndRefresh,
} from '@/services/injectionMutations';
import { maybePromptForReview, recordPositiveEvent } from '@/services/review';
import { useAppStore } from '@/stores/app';
import { colors, radius, spacing } from '@/theme';
import { confirmDelete } from '@/utils/confirmDelete';
import { fmtDate, fmtDayLabel, fmtTime, startOfDay } from '@/utils/date';
import { safeBack } from '@/utils/nav';

interface LogShotDraft {
  medicationId: string | null;
  dose: number;
  /**
   * The dose Poke last filled in, or null when Poke filled in none.
   *
   * A medication can carry a dose per weekday, so the day the shot is filed on
   * decides the number, and a change of day has to move it. This is how Poke
   * tells its own number from the user's: the day moves the dose only while the
   * field still holds what Poke put there. An edit opens on the logged dose and
   * sets this to null, so a correction of an old shot is never overwritten.
   */
  prefilledDose: number | null;
  /**
   * The unit and the route the shot is saved with.
   *
   * They sit in the draft rather than being read off the selected medication,
   * because an edit can move a shot to another medication and the two answers
   * then part company. The unit is half of a number the user typed, so it stays
   * put. The route is copied from the medication in both modes: no screen has
   * ever asked the user for one, and the diagram draws the sites of the route it
   * is given, so a route that lagged behind the medication would offer sites the
   * new medication does not use.
   */
  unit: Unit;
  route: Route;
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
 *
 * The unit and the route here cover the frames before a medication is selected,
 * which is the same tick the list arrives in. The medication overwrites both.
 */
function createDraft(chosen: number | null): LogShotDraft {
  return {
    medicationId: null,
    dose: 0,
    prefilledDose: null,
    unit: 'mg',
    route: 'sc',
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

/**
 * The most rows the day wheel ever draws.
 *
 * The wheel is a plain list, and the History board reaches six years back, so an
 * uncapped range would mount thousands of rows the moment the user taps an old
 * day. Past the cap the window moves to the chosen day instead of growing.
 */
const DATE_MAX_DAYS = 400;

/** How many used sites the diagram marks as recent. */
const RECENT_SITES = 4;

export default function LogShotScreen() {
  const params = useLocalSearchParams<{ medicationId?: string; takenAt?: string; injectionId?: string }>();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const bumpVersion = useAppStore((state) => state.bumpVersion);
  const setFocusMedication = useAppStore((state) => state.setFocusMedication);
  /**
   * The shot this screen edits, or undefined when it logs a new one.
   *
   * History sends it, the way `/medications/new` takes a `medicationId` and
   * becomes the edit screen for that row. One screen, because every field an
   * edit changes is a field this screen already asks for.
   */
  const editingId = params.injectionId;
  const editing = editingId !== undefined;
  /** The row as it stands on file, once it is read. Null while it loads. */
  const [loaded, setLoaded] = useState<InjectionRow | null>(null);
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
  // The delete runs, the reminder queue rebuilds, and only then does the screen
  // leave, so the button has to hold its own press for that whole stretch. It
  // keeps a flag of its own rather than borrowing `saving`, because the two
  // buttons say different things while they work.
  const [deleting, setDeleting] = useState(false);
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

  /**
   * Points the draft at a medication and reads that medication's site history.
   *
   * A new shot takes the medication's defaults, because there is nothing else to
   * take. The dose is the one the plan carries on the day being filed, which is
   * the default dose on every day the user set no other. An edit keeps the dose
   * and the unit the shot already carries: 0.5 mg
   * does not stop being 0.5 mg because the shot moved to another medication, and
   * a number Poke threw away is a number the user has to type again. The level
   * curve already reads a shot in the unit it was logged in and converts it, so
   * a kept unit costs the chart nothing.
   *
   * Two things follow the medication in both modes. The route, because no screen
   * asks for one and save has always copied it from the medication. And the
   * site, but only when the new route does not offer the one on the shot: a
   * subcutaneous abdomen is not a place an intramuscular shot goes, so that site
   * clears and the card says so. A site both routes offer stays exactly where
   * the user put it.
   */
  const selectMedication = useCallback(async (medication: MedicationRow) => {
    const request = siteRequest.current + 1;
    siteRequest.current = request;
    setDoseNotice(null);
    setSiteHistory([]);
    setDraft((current) => {
      const dose = editing
        ? current.dose
        : doseOnDay(medication.dose_by_day, medication.default_dose, current.takenAt);
      return {
        ...current,
        medicationId: medication.id,
        dose,
        prefilledDose: editing ? null : dose,
        unit: editing ? current.unit : medication.default_unit,
        route: medication.default_route,
        suggestedSiteId: null,
        selectedSiteId: editing ? siteOnRoute(current.selectedSiteId, medication.default_route) : null,
      };
    });
    selectionHaptic();
    const history = await lastSiteUseFor(medication.id).catch((): SiteUse[] => []);
    if (request !== siteRequest.current) return;
    setSiteHistory(history);
    // Rotation proposes the next site for a shot nobody has given yet. This shot
    // has a site already, and it is the user's own record of where the needle
    // went, so Poke does not move it.
    if (editing) return;
    const suggested = recommendNextSite(history, medication.default_route);
    setDraft((current) => (current.medicationId === medication.id
      ? { ...current, suggestedSiteId: suggested?.id ?? null, selectedSiteId: suggested?.id ?? null }
      : current));
    if (suggested) setView(suggested.view);
  }, [editing]);

  /**
   * The chips.
   *
   * An edit adds the shot's own medication to the list whatever its status, so a
   * shot on a paused or a retired medication still names it and can still be
   * saved. That row arrives after the list does, which is why the read runs
   * again when it lands.
   */
  useEffect(() => {
    const ownId = loaded?.medication_id ?? null;
    listMedications(editing)
      .then((medicationRows) => {
        const selectable = medicationRows.filter(
          (medication) => medication.status === 'active' || medication.id === ownId,
        );
        setMedications(selectable);
        // An edit takes its medication from the row, not from the list.
        if (editing) return;
        const requested = params.medicationId
          ? selectable.find((medication) => medication.id === params.medicationId)
          : undefined;
        const initial = requested ?? selectable[0];
        if (initial) void selectMedication(initial);
      })
      .catch(() => {});
  }, [editing, loaded?.medication_id, params.medicationId, selectMedication]);

  /**
   * Fills the draft from the shot on file.
   *
   * The row is the whole answer: the medication, the dose, the unit, the route,
   * the site, the day, the time and the note. A row that is gone gets the alert
   * and the way back, the way `/medications/new` handles a medication deleted
   * out from under it. Details open, because the day and the time are part of
   * what the user came here to read.
   */
  useEffect(() => {
    if (editingId === undefined) return;
    let alive = true;
    getInjection(editingId)
      .then((shot) => {
        if (!alive) return;
        if (!shot) {
          Alert.alert('Poke could not find that shot');
          safeBack('/history');
          return;
        }
        setLoaded(shot);
        setDraft({
          medicationId: shot.medication_id,
          dose: shot.dose,
          // The dose is the record, not a proposal, so no day change moves it.
          prefilledDose: null,
          unit: shot.unit,
          route: shot.route,
          suggestedSiteId: null,
          selectedSiteId: shot.site_id,
          takenAt: shot.taken_at,
          takenAtChosen: true,
          notes: shot.notes ?? '',
          detailsOpen: true,
        });
        const site = shot.site_id ? getBodySite(shot.site_id) : undefined;
        if (site) setView(site.view);
        return lastSiteUseFor(shot.medication_id).catch((): SiteUse[] => []);
      })
      .then((history) => {
        if (alive && history) setSiteHistory(history);
      })
      .catch((error: unknown) => {
        Alert.alert('Poke could not load that shot', error instanceof Error ? error.message : 'Try again.');
      });
    return () => {
      alive = false;
    };
  }, [editingId]);

  const selectedMedication = medications.find((medication) => medication.id === draft.medicationId) ?? null;
  const selectedSite = draft.selectedSiteId ? getBodySite(draft.selectedSiteId) : undefined;
  // Newest first out of the query, one entry per site, so this is the four sites
  // this medication went into most recently.
  const recentSiteIds = useMemo(
    () => siteHistory.slice(0, RECENT_SITES).map((use) => use.siteId),
    [siteHistory],
  );
  // The diagram is the one control on this screen a finger has to be accurate
  // with, so it takes the height the screen can spare.
  //
  // Height is the only thing that makes a dot bigger. The figure is drawn 1:2
  // and the SVG scales to whichever side runs out first, so on a card 322 pt
  // wide a box wider than half its own height only adds margin. Width therefore
  // follows height, and the card is as tall as the diagram and its two lines
  // come to, rather than a cap the contents overran and were clipped by on a
  // small phone.
  const diagramWidth = Math.min(
    Math.max(110, Math.min(155, Math.round(height * 0.17))),
    width - spacing.screen * 2 - spacing.xl * 2,
  );
  const diagramHeight = diagramWidth * 2;

  // Three states of one screen: the form, the row it is still reading, and the
  // account with no medication on it. Only the form has anything to save, and
  // the save is drawn outside the scroll, so both places read the same answer.
  const waitingForRow = editing && !loaded;
  const showForm = !waitingForRow && medications.length > 0;

  const doseUnit: Unit = draft.unit;
  // A dose the user already saved is an answer, not a typo, so the ceiling never
  // falls below one. The largest dose the medication plans on any day counts,
  // and so does the dose already on the shot being edited.
  const doseMax = Math.max(
    DOSE_MAX[doseUnit],
    selectedMedication
      ? maxPlannedDose(selectedMedication.dose_by_day, selectedMedication.default_dose)
      : 0,
    loaded?.dose ?? 0,
  );
  /**
   * True when the medication change took the site with it.
   *
   * The shot arrived with a site, the draft has none, and only the route filter
   * can empty a site the user is not allowed to unpick. The card then says why,
   * because a record that loses a field in silence is worse than no edit screen.
   */
  const siteCleared = editing && (loaded?.site_id ?? null) !== null && draft.selectedSiteId === null;

  const takenDay = startOfDay(draft.takenAt);
  // Oldest row at the top and today at the bottom, the way a calendar reads.
  // The wheel opens on the chosen day. Tomorrow has no row, so the user cannot
  // file a shot in the future.
  //
  // The range reaches back a month on its own, and further when the route names
  // an older day: History can send any day the calendar reaches, and a wheel
  // that cannot show that day would file the shot on the wrong one. It never
  // draws more than `DATE_MAX_DAYS` rows: a day tapped years back moves the
  // window rather than growing it, so the chosen day is always on the wheel.
  const days = useMemo(() => {
    const oldest = Math.min(startOfDay(subDays(today, DATE_DAYS - 1).getTime()), takenDay);
    const newest = Math.min(today, startOfDay(addDays(oldest, DATE_MAX_DAYS - 1).getTime()));
    const span = differenceInCalendarDays(newest, oldest) + 1;
    return Array.from({ length: span }, (_, index) => startOfDay(addDays(oldest, index).getTime()));
  }, [today, takenDay]);
  const detailsSummary = takenDay === today
    ? `${fmtTime(draft.takenAt)} and notes`
    : `${fmtDayLabel(draft.takenAt)} at ${fmtTime(draft.takenAt)} and notes`;

  /**
   * The day carries the dose, so a change of day moves the number with it.
   *
   * Only while the field still holds the number Poke put there. A dose the user
   * typed is the user's answer, and a wheel turned afterwards does not take it
   * back. The day and not the exact time, because a plan names weekdays.
   */
  useEffect(() => {
    if (!selectedMedication) return;
    const planned = doseOnDay(
      selectedMedication.dose_by_day,
      selectedMedication.default_dose,
      takenDay,
    );
    setDraft((current) => (
      current.prefilledDose !== null && current.dose === current.prefilledDose && current.dose !== planned
        ? { ...current, dose: planned, prefilledDose: planned }
        : current
    ));
  }, [selectedMedication, takenDay]);

  const selectSite = (site: BodySite) => {
    setDraft((current) => ({ ...current, selectedSiteId: site.id }));
    selectionHaptic();
  };

  const save = async () => {
    if (!selectedMedication || draft.dose <= 0 || saving) return;
    setSaving(true);
    const record = {
      medicationId: selectedMedication.id,
      dose: draft.dose,
      unit: draft.unit,
      route: draft.route,
      siteId: draft.selectedSiteId,
      // The clock at the moment of saving, unless the user named a day or a
      // time. `log-weight` and `log-side-effect` read the clock here too. An
      // edit always has a day: the shot came with one.
      takenAt: draft.takenAtChosen ? draft.takenAt : Date.now(),
      notes: draft.notes.trim() || null,
    };
    try {
      if (editingId !== undefined) {
        await updateInjectionAndRefresh(editingId, record);
        bumpVersion();
        // No focus handoff and no rating ask. Both belong to a shot the user
        // just gave: the handoff points Today at that medication, and the ask
        // spends one of three yearly review prompts on a win. A correction to
        // an old record is neither, and the way back from here is History.
        if (Platform.OS !== 'web') {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        safeBack('/history');
        return;
      }
      await createInjectionAndRefresh(record);
      bumpVersion();
      // Name the medication Today should open on, so the card behind this screen
      // is the one this shot went into.
      setFocusMedication(selectedMedication.id);
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      safeBack('/');
      recordPositiveEvent().then(() => maybePromptForReview('shot-logged')).catch(() => {});
    } catch (error: unknown) {
      Alert.alert(
        editing ? 'Poke could not save your changes' : 'Poke could not log your shot',
        error instanceof Error ? error.message : 'Try again.',
      );
      setSaving(false);
    }
  };

  /**
   * Removes the shot the screen opened on.
   *
   * The customer who filed this asked for one thing the screen did not have: a
   * shot logged on the wrong day, and no way out of it except a swipe on a row
   * in another screen. So the verb sits where the record does.
   *
   * The question names the row on file, not the draft: the user is throwing away
   * the shot as Poke holds it, and an unsaved medication or day would name a
   * record that never existed. `deleteInjectionAndRefresh` marks the row deleted
   * and rebuilds the reminder queue, which the day owes back to the schedule.
   */
  const remove = () => {
    if (editingId === undefined || !loaded || saving || deleting) return;
    confirmDelete(shotSummary(loaded, medications), () => {
      setDeleting(true);
      void (async () => {
        try {
          await deleteInjectionAndRefresh(editingId);
          bumpVersion();
          if (Platform.OS !== 'web') {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
          safeBack('/history');
        } catch (error: unknown) {
          Alert.alert(
            'Poke could not delete your shot',
            error instanceof Error ? error.message : 'Try again.',
          );
          setDeleting(false);
        }
      })();
    });
  };

  return (
    <View style={styles.root}>
      <Header
        title={editing ? 'Edit shot' : 'Log shot'}
        leading={(
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={() => safeBack(editing ? '/history' : '/')}
            style={styles.close}
          >
            <X size={22} color={colors.ink} />
          </Pressable>
        )}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {waitingForRow ? (
          // The form waits for the row. Drawn early it would show an empty dose
          // and the error under it, over a shot that has a perfectly good one.
          <Card style={styles.loading}>
            <ActivityIndicator color={colors.accent} />
            <Text variant="small" color={colors.inkMuted}>Poke is opening your shot.</Text>
          </Card>
        ) : medications.length === 0 ? (
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
                <Text variant="small" color={colors.inkMuted}>
                  {editing ? 'The dose you logged' : 'Your usual dose'}
                </Text>
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
                unit={draft.unit}
              />
              {draft.dose <= 0 ? (
                <Text variant="small" color={colors.danger}>Poke needs a dose above zero.</Text>
              ) : null}
              {doseNotice ? (
                <Text variant="small" color={colors.danger}>{doseNotice}</Text>
              ) : null}
            </View>

            {selectedMedication ? (
              <Card style={styles.siteCard}>
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
                    route={draft.route}
                    selectedId={draft.selectedSiteId}
                    suggestedId={draft.suggestedSiteId}
                    recentSiteIds={recentSiteIds}
                    onSelect={selectSite}
                  />
                </View>
                <Text variant="smallStrong" align="center">
                  {selectedSite ? siteLabelOnView(selectedSite, view) : 'No site yet'}
                </Text>
                <Text
                  variant="caption"
                  color={siteCleared ? colors.ink : colors.inkMuted}
                  align="center"
                >
                  {siteNote(
                    editing,
                    siteCleared,
                    draft.selectedSiteId,
                    draft.suggestedSiteId,
                    selectedMedication.name,
                  )}
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

            {/* Last thing in the form, under the fields it undoes, which is where
                iOS puts a destructive verb on an edit sheet. It stays inside the
                scroll and out of the footer, so the press the screen exists for
                is the one under the thumb and this one is reached for. A new
                shot has no row to delete, so it draws nothing. */}
            {editing && loaded ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Delete shot"
                accessibilityState={{ disabled: saving || deleting }}
                disabled={saving || deleting}
                onPress={remove}
                style={styles.delete}
              >
                <Text variant="bodyStrong" color={colors.danger}>
                  {deleting ? 'Deleting shot' : 'Delete shot'}
                </Text>
              </Pressable>
            ) : null}

          </>
        )}
      </ScrollView>

      {/* The save sits under the scroll rather than at the end of it. The
          diagram takes the height it needs above, which on a small phone puts
          the end of the form past the fold, and the one press the screen exists
          for is not a thing to go looking for.

          The label names what the press does. An edit writes over the row the
          screen opened on, so it saves changes rather than logging a second
          shot. */}
      {showForm ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <Button disabled={saving || deleting || !selectedMedication || draft.dose <= 0} onPress={save}>
            {editing
              ? (saving ? 'Saving changes' : 'Save changes')
              : (saving ? 'Logging shot' : 'Log shot')}
          </Button>
        </View>
      ) : null}
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
 *
 * The route is a string from outside the app, so the whole of it has to be a
 * timestamp: `Number.parseInt` would read `123abc` as the 1st of January 1970.
 */
function dayFromRoute(value: string | undefined, now: number): number | null {
  if (!value || !/^-?\d+$/.test(value)) return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) return null;
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

/**
 * The site as the label reads it, and the side it sits on when the user is
 * looking at the other one.
 *
 * A flip of the diagram does not drop the selection, and it must not: a shot
 * has one site, and the toggle only turns the body around. But the marked dot
 * goes off screen with the flip, so the label on its own read "Upper left
 * abdomen" over a back view with nothing marked, which looks like a tap that
 * did nothing. That is half of what the beta user reported. The label now says
 * where the site is, so the empty side explains itself.
 */
function siteLabelOnView(site: BodySite, view: BodyView): string {
  return site.view === view ? site.label : `${site.label}, on the ${site.view}`;
}

/** The line under the diagram, which says whose answer the site is. */
function siteNote(
  editing: boolean,
  siteCleared: boolean,
  selectedSiteId: string | null,
  suggestedSiteId: string | null,
  medicationName: string,
): string {
  if (editing) {
    if (siteCleared) return `${medicationName} does not use the site you logged. Tap the diagram to choose a new site.`;
    if (!selectedSiteId) return 'Poke has no site on file for this shot. Tap the diagram to add one.';
    return 'Poke keeps the site you logged. Tap the diagram to choose a different site.';
  }
  if (!selectedSiteId) return 'Tap the diagram to choose a site.';
  // "Poke suggests the next site" is Poke describing what Poke did. Once the
  // user has moved the dot, Poke did not do that, and the line reads over a
  // hand-picked site as if the tap went nowhere. That is the reported
  // complaint in words rather than in pixels.
  return selectedSiteId === suggestedSiteId
    ? 'Poke suggests the next site. Tap the diagram to choose a different one.'
    : 'Poke logs the site you picked. Tap the diagram to choose a different one.';
}

/**
 * The line the delete question puts under its title: `Tirzepatide on Aug 14,
 * 2026 at 8:05 am.`
 *
 * The day is spelled out rather than left as "Today", because the shot the user
 * wants gone is usually the one that landed on the wrong day, and a name for the
 * day is the fact that settles it. The medication list carries the shot's own
 * medication in edit mode, archived or not, so the name is nearly always there.
 */
function shotSummary(shot: InjectionRow, medications: MedicationRow[]): string {
  const name = medications.find((medication) => medication.id === shot.medication_id)?.name;
  return `${name ?? 'This shot'} on ${fmtDate(shot.taken_at)} at ${fmtTime(shot.taken_at)}.`;
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
    // The footer holds the bottom of the screen now, so the scroll only needs
    // enough room to clear the line above it.
    paddingBottom: spacing.xl,
  },
  footer: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.background,
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
  delete: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  empty: {
    gap: spacing.lg,
  },
  loading: {
    alignItems: 'center',
    gap: spacing.md,
  },
});
