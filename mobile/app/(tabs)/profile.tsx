import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { differenceInCalendarWeeks, startOfWeek, subWeeks } from 'date-fns';
import { Activity, Bell, CalendarClock, Gauge, HeartPulse, Info, RefreshCw, Scale, Share, Sparkles, Target } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { clockLabel, InlineTimePicker } from '@/components/InlineTimePicker';
import { Input } from '@/components/Input';
import { Slider } from '@/components/Slider';
import { ProfileRecordStrip, RECORD_WEEKS, type ProfileRecord } from '@/components/profile-record-strip';
import {
  ProfileCard,
  ProfileChipField,
  ProfileExportValue,
  ProfileLink,
  ProfileProSlot,
  ProfileRow,
  ProfileSegment,
  ProfileValuePill,
} from '@/components/profile-settings-rows';
import { Text } from '@/components/Text';
import { TimeRangeToggle } from '@/components/TimeRangeToggle';
import { TodayRise } from '@/components/today-motion';
import type { InjectionRow, PreferencesRow } from '@/db/types';
import { SIDE_EFFECT_PRESETS, type SideEffectPresetId } from '@/domain/sideEffects';
import { kgToLb, lbToKg, type WeightUnit } from '@/domain/units';
import { listInjections } from '@/repositories/injections';
import {
  getPreferences,
  updateGoalWeight,
  updatePreferences,
  type PreferencesPatch,
} from '@/repositories/preferences';
import { exportHistory } from '@/services/export';
import {
  importHealthWeights,
  isHealthSupported,
  stopHealthSync,
  type HealthImport,
} from '@/services/health';
import {
  CHECKIN_DELAY_OPTIONS,
  checkinDelayHours,
  ensureNotificationPermission,
  refreshScheduledReminders,
  resolveSideEffectWatchList,
  serializeSideEffectWatchList,
} from '@/services/notifications';
import { openManageSubscriptions } from '@/services/purchases';
import { maybePromptForReview, openWriteReview } from '@/services/review';
import { useAppStore } from '@/stores/app';
import {
  convertPace,
  formatPace,
  formatPaceRate,
  paceBounds,
  PACE_DEFAULT_LB,
} from '@/stores/onboarding';
import { fmtDateTime } from '@/utils/date';
import {
  useEntitlementStore,
  useIsPro,
  usePaywallEnabled,
  useTesterProAt,
  type DevOverride,
} from '@/stores/entitlement';
import { openPaywall } from '@/components/ProLock';
import { arrivalBeats, colors, rise, spacing } from '@/theme';

/**
 * The three chips on the check-in row. `TimeRangeToggle` speaks strings, so the
 * hours travel as text and `checkinDelayHours` reads them back to the union.
 */
const CHECKIN_DELAY_CHOICES: readonly string[] = CHECKIN_DELAY_OPTIONS.map(String);

const EMPTY_RECORD: ProfileRecord = {
  weeks: new Array<number>(RECORD_WEEKS).fill(0),
  total: 0,
  since: null,
};

/**
 * Profile shows you your record first and your settings second.
 *
 * It holds five things: when Poke speaks, how it reads a weight, the number the
 * user owns, the only way data leaves the device, and the account state. The
 * medication list, the goal track and the six section headers that used to sit
 * here are gone — Today focuses a medication, Progress draws the weight, and the
 * tab bar names the tab.
 */
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const dataVersion = useAppStore((state) => state.dataVersion);
  const bumpVersion = useAppStore((state) => state.bumpVersion);
  const [preferences, setPreferences] = useState<PreferencesRow | null>(null);
  const [injections, setInjections] = useState<InjectionRow[] | null>(null);
  /** The side effects the check-in asks about, in the order the chips draw. */
  const [watchList, setWatchList] = useState<readonly SideEffectPresetId[]>([]);
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalDraft, setGoalDraft] = useState('');
  const [savingGoal, setSavingGoal] = useState(false);
  const [paceOpen, setPaceOpen] = useState(false);
  /** Held as a number, in the saved weight unit. The slider hands over a value. */
  const [paceDraft, setPaceDraft] = useState(PACE_DEFAULT_LB);
  const [savingPace, setSavingPace] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [healthOpen, setHealthOpen] = useState(false);
  const [healthBusy, setHealthBusy] = useState(false);
  /** What the last read did. Null before the first one of this visit. */
  const [healthNote, setHealthNote] = useState<string | null>(null);
  const [timeOpen, setTimeOpen] = useState(false);
  const [delayOpen, setDelayOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const pro = useIsPro();
  const paywallEnabled = usePaywallEnabled();
  const restoring = useEntitlementStore((state) => state.restoring);
  const restore = useEntitlementStore((state) => state.restore);
  const clearError = useEntitlementStore((state) => state.clearError);
  const storeStatus = useEntitlementStore((state) => state.status);
  const devOverride = useEntitlementStore((state) => state.devOverride);
  const setDevOverride = useEntitlementStore((state) => state.setDevOverride);
  const testerProAt = useTesterProAt();

  const load = useCallback(async () => {
    setLoadError(false);
    const [row, shots] = await Promise.all([
      getPreferences(),
      listInjections({ fromMs: recordWindowStart() }),
    ]);
    setPreferences(row);
    setInjections(shots);
    setGoalDraft(row.goal_weight === null ? '' : String(row.goal_weight));
    setPaceDraft(row.weekly_pace ?? restingPace(row.weight_unit));
    // Reading the list is also where the stored default lands, for a user who
    // set Poke up before this field existed. The write happens once.
    setWatchList(await resolveSideEffectWatchList(row.side_effect_concerns));
  }, []);

  useEffect(() => {
    // A swallowed rejection leaves every row at opacity 0 with nothing to tap.
    // The screen says so instead, and offers the retry, the way Progress does.
    load().catch(() => setLoadError(true));
  }, [dataVersion, load]);

  const record = useMemo(
    () => (injections === null ? EMPTY_RECORD : recordFrom(injections)),
    [injections],
  );
  /** Arrival waits for the record, so the bars grow at their real heights. */
  const loaded = preferences !== null && injections !== null;

  const toggleReminders = async () => {
    if (!preferences) return;
    const next: 0 | 1 = preferences.notifications_enabled === 1 ? 0 : 1;
    if (next === 1) {
      const granted = await ensureNotificationPermission();
      if (!granted) {
        Alert.alert('Reminders are unavailable', 'Allow notifications in system settings to turn on shot reminders.');
        return;
      }
    }
    await savePreferences({ notifications_enabled: next }, true);
  };

  const toggleCheckin = async () => {
    if (!preferences) return;
    const next: 0 | 1 = preferences.notif_checkin_enabled === 1 ? 0 : 1;
    await savePreferences({ notif_checkin_enabled: next }, true);
  };

  const toggleMissed = async () => {
    if (!preferences) return;
    const next: 0 | 1 = preferences.notif_missed_enabled === 1 ? 0 : 1;
    await savePreferences({ notif_missed_enabled: next }, true);
  };

  const toggleCycle = async () => {
    if (!preferences) return;
    const next: 0 | 1 = preferences.notif_cycle_enabled === 1 ? 0 : 1;
    await savePreferences({ notif_cycle_enabled: next }, true);
  };

  // Held in preset order rather than in tap order, so the chips never reshuffle
  // under the finger that just pressed one.
  const toggleWatched = async (id: SideEffectPresetId) => {
    const on = watchList.includes(id);
    const next = SIDE_EFFECT_PRESETS
      .map((preset) => preset.id)
      .filter((preset) => (preset === id ? !on : watchList.includes(preset)));
    setWatchList(next);
    await savePreferences({ side_effect_concerns: serializeSideEffectWatchList(next) }, true);
  };

  const setCheckinDelay = async (choice: string) => {
    if (!preferences) return;
    const hours = checkinDelayHours(Number(choice));
    if (hours === preferences.notif_checkin_delay_hours) return;
    setPreferences({ ...preferences, notif_checkin_delay_hours: hours });
    await savePreferences({ notif_checkin_delay_hours: hours }, true);
  };

  const setReminderTime = async (reminderTime: string) => {
    if (!preferences) return;
    setPreferences({ ...preferences, reminder_time: reminderTime });
    await savePreferences({ reminder_time: reminderTime }, true);
  };

  const setWeightUnit = async (weightUnit: WeightUnit) => {
    if (!preferences || weightUnit === preferences.weight_unit) return;
    const patch: PreferencesPatch = {
      weight_unit: weightUnit,
      start_weight: preferences.start_weight === null
        ? null
        : convertWeight(preferences.start_weight, preferences.weight_unit, weightUnit),
      goal_weight: preferences.goal_weight === null
        ? null
        : convertWeight(preferences.goal_weight, preferences.weight_unit, weightUnit),
      // The pace is stored in the weight unit, the same way the setup store
      // holds it, so a switch has to carry it over. Left alone, a saved pace of
      // 1 lb a week reads as 1 kg a week on the row below, which is more than
      // twice the plan the user set.
      weekly_pace: preferences.weekly_pace === null
        ? null
        : convertPace(preferences.weekly_pace, preferences.weight_unit, weightUnit),
    };
    await savePreferences(patch, false);
  };

  const savePreferences = async (patch: PreferencesPatch, refreshReminders: boolean) => {
    try {
      await updatePreferences(patch);
      bumpVersion();
      if (refreshReminders) await refreshScheduledReminders().catch(() => {});
      await load();
    } catch (error: unknown) {
      Alert.alert('Poke could not save your preference', error instanceof Error ? error.message : 'Try again.');
    }
  };

  const saveGoal = async () => {
    const goal = Number.parseFloat(goalDraft);
    if (!Number.isFinite(goal) || goal <= 0) {
      Alert.alert('Enter a valid goal weight');
      return;
    }
    setSavingGoal(true);
    try {
      await updateGoalWeight(goal);
      bumpVersion();
      await load();
      setGoalOpen(false);
    } catch (error: unknown) {
      Alert.alert('Poke could not save your goal', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setSavingGoal(false);
    }
  };

  // The slider fires on every step of a drag, so the value is held in the draft
  // and written once, on the press. A write per step would put a hundred UPDATE
  // statements and a hundred reloads under one thumb.
  const savePace = async () => {
    setSavingPace(true);
    try {
      await updatePreferences({ weekly_pace: paceDraft });
      bumpVersion();
      await load();
      setPaceOpen(false);
    } catch (error: unknown) {
      Alert.alert('Poke could not save your pace', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setSavingPace(false);
    }
  };

  // A read is also the connect: the first one raises the iOS permission sheet,
  // and every later one is the same call with a shorter window. There is no
  // separate "connect" step to write, because iOS owns that state and never
  // reports it back.
  const readHealth = async () => {
    setHealthBusy(true);
    const result = await importHealthWeights();
    setHealthBusy(false);
    setHealthNote(healthNoteFor(result, weightUnit));
    if (result.kind !== 'imported') return;
    bumpVersion();
    await load();
  };

  const stopHealth = async () => {
    await stopHealthSync();
    setHealthNote(null);
    bumpVersion();
    await load();
  };

  const runExport = async () => {
    if (!pro) {
      openPaywall('profile_export');
      return;
    }
    setExporting(true);
    const outcome = await exportHistory();
    setExporting(false);
    if (outcome.kind === 'empty') {
      Alert.alert('Nothing to export yet', 'Log a shot or a weight first.');
    } else if (outcome.kind === 'failed') {
      Alert.alert('Poke could not export your history', outcome.message);
    } else if (outcome.kind === 'shared') {
      maybePromptForReview('export').catch(() => {});
    }
  };

  // The alert is where this outcome is shown, so the stored message is cleared
  // as soon as it is read. Left set, it reappears later on the paywall, under a
  // purchase the user never attempted.
  const runRestore = async () => {
    const outcome = await restore();
    const message = useEntitlementStore.getState().error;
    clearError();
    if (outcome === 'restored') {
      Alert.alert('Poke Pro is active', 'Your subscription is back on this device.');
    } else if (outcome === 'none') {
      Alert.alert('No subscription found', 'Poke found no active subscription for this Apple Account.');
    } else {
      Alert.alert('Poke could not restore your subscription', message ?? 'Try again.');
    }
  };

  /**
   * What the Pro slot may claim, and where it goes.
   *
   * `useIsPro` is true for three different reasons and only one of them is a
   * purchase, so a tester and a subscriber were both told to manage a
   * subscription in an Apple Account. The tester has none, and the tap left them
   * on an App Store page with nothing on it.
   *
   * The order matches `accessFromState`: a tester grant wins over the store, so
   * it is read first here too. The third case is a store Poke asked and could
   * not reach, which unlocks every feature without selling anything — that user
   * is not a subscriber, so the slot offers the subscription rather than calling
   * it active. The row's detail line is gone with every other subtitle, so the
   * distinction the four cases carry now lives in the accessibility label.
   */
  const proSlot = testerProAt !== null
    ? {
      state: 'active' as const,
      label: 'Poke Pro is active from a tester code. Open tester access',
      onPress: () => router.push('/redeem'),
    }
    : storeStatus === 'pro'
      ? {
        state: 'active' as const,
        label: 'Poke Pro is active. Manage the subscription in your Apple Account',
        onPress: openManageSubscriptions,
      }
      : {
        state: 'offer' as const,
        label: pro
          ? 'Poke could not reach the App Store. See Poke Pro'
          : 'See Poke Pro',
        onPress: () => openPaywall('profile_pro'),
      };

  const goalWeight = preferences?.goal_weight ?? null;
  const weightUnit = preferences?.weight_unit ?? 'lb';
  const weeklyPace = preferences?.weekly_pace ?? null;
  const paceRange = paceBounds(weightUnit);
  // The step the floor is a multiple of, so the low end of either unit is an
  // exact zero and the readout is the maintain word rather than "0.0 lb".
  const paceStep = weightUnit === 'lb' ? 0.1 : 0.05;
  // Poke's own switch, which is not the iOS permission. iOS never says whether a
  // read was granted, so this reads "on" only after weight actually arrived.
  const healthOn = preferences?.health_sync_enabled === 1;
  const healthReadAt = preferences?.health_synced_at ?? null;
  const remindersOn = preferences?.notifications_enabled === 1;
  // `notifications_enabled` is the shot-day switch and the master switch both:
  // with it off `refreshScheduledReminders` queues nothing at all. So the two
  // rows under it read off and take no touch, rather than claiming a banner
  // that cannot arrive. The stored answer survives, and comes back with them.
  const checkinOn = remindersOn && preferences?.notif_checkin_enabled === 1;
  const missedOn = remindersOn && preferences?.notif_missed_enabled === 1;
  const cycleOn = remindersOn && preferences?.notif_cycle_enabled === 1;
  const checkinDelay = checkinDelayHours(preferences?.notif_checkin_delay_hours);
  const version = Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? null;

  // The rows below all wait on `loaded`, so a failed read would hold them at
  // opacity 0 for good. This is the whole screen while that is the state.
  if (loadError && !loaded) {
    return (
      <View style={styles.root}>
        <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}>
          <LoadError onRetry={() => load().catch(() => setLoadError(true))} />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}>
        <TodayRise show={loaded} delay={arrivalBeats.header} distance={rise.line}>
          <ProfileRecordStrip record={record} entered={loaded} />
        </TodayRise>

        <TodayRise show={loaded} delay={arrivalBeats.hero} distance={rise.card}>
          <ProfileCard>
            {/* The time is a pill inside the row rather than a row of its own.
                A row that appeared and vanished with the switch took the saved
                time off the screen with it, and the wheels themselves cannot sit
                in a ScrollView: a wheel takes every vertical drag that starts on
                it, so scrolling past this card moved the saved time and said
                nothing. Behind a row, it can catch neither. */}
            <ProfileRow
              testID="profile-reminders-row"
              divided={false}
              icon={<Bell size={22} strokeWidth={1.8} color={colors.inkMuted} />}
              label="Shot day"
              accessibilityLabel={`Reminder time, ${clockLabel(preferences?.reminder_time ?? '09:00')}`}
              onPress={() => setTimeOpen(true)}
              value={(
                <>
                  <ProfileValuePill
                    label={clockLabel(preferences?.reminder_time ?? '09:00').toLowerCase()}
                    quiet={!remindersOn}
                  />
                  {/* The switch sits inside a row that opens the time picker, so
                      it has to take its own touches. The wrapper claims the
                      gesture the switch itself does not, and the row press never
                      fires under a finger that came for the switch. */}
                  <View onStartShouldSetResponder={() => true}>
                    <Switch
                      testID="profile-reminders-switch"
                      accessibilityLabel="Shot day"
                      value={remindersOn}
                      onValueChange={toggleReminders}
                      trackColor={{ true: colors.accent, false: colors.borderStrong }}
                      thumbColor={colors.surface}
                    />
                  </View>
                </>
              )}
            />
            {/* The delay is a pill that opens a sheet, the same shape the row
                above uses for the reminder time. Three chips beside a switch
                would leave the label a word wide on a phone. */}
            <ProfileRow
              testID="profile-checkin-row"
              icon={<Activity size={22} strokeWidth={1.8} color={colors.inkMuted} />}
              label="Day-after check-in"
              accessibilityLabel={`Check-in delay, ${checkinDelay} hours after a shot`}
              onPress={remindersOn ? () => setDelayOpen(true) : undefined}
              value={(
                <>
                  <ProfileValuePill label={`${checkinDelay} h`} quiet={!checkinOn} />
                  <View onStartShouldSetResponder={() => true}>
                    <Switch
                      testID="profile-checkin-switch"
                      accessibilityLabel="Day-after check-in"
                      disabled={!remindersOn}
                      value={checkinOn}
                      onValueChange={toggleCheckin}
                      trackColor={{ true: colors.accent, false: colors.borderStrong }}
                      thumbColor={colors.surface}
                    />
                  </View>
                </>
              )}
            />
            {/* What the check-in asks about, under the row that names it. The
                chips are the whole editor: Poke used to take this list once in
                setup and then never offer it again, so a user who answered
                "None right now" had a switch that could never fire. */}
            <ProfileChipField
              testID="profile-checkin-watch"
              options={SIDE_EFFECT_PRESETS}
              selected={watchList}
              onToggle={(id) => { void toggleWatched(id); }}
              caption={watchList.length === 0 ? 'No check-in until you pick one.' : undefined}
            />
            <ProfileRow
              testID="profile-missed-row"
              icon={<CalendarClock size={22} strokeWidth={1.8} color={colors.inkMuted} />}
              label="Missed shot"
              value={(
                <Switch
                  testID="profile-missed-switch"
                  accessibilityLabel="Missed shot"
                  disabled={!remindersOn}
                  value={missedOn}
                  onValueChange={toggleMissed}
                  trackColor={{ true: colors.accent, false: colors.borderStrong }}
                  thumbColor={colors.surface}
                />
              )}
            />
            {/* Two banners in a whole cycle, and only for a medication that has
                one. A user with no cycle set never meets this loop. */}
            <ProfileRow
              testID="profile-cycle-row"
              icon={<RefreshCw size={22} strokeWidth={1.8} color={colors.inkMuted} />}
              label="Cycle end"
              value={(
                <Switch
                  testID="profile-cycle-switch"
                  accessibilityLabel="Cycle end"
                  disabled={!remindersOn}
                  value={cycleOn}
                  onValueChange={toggleCycle}
                  trackColor={{ true: colors.accent, false: colors.borderStrong }}
                  thumbColor={colors.surface}
                />
              )}
            />
          </ProfileCard>
        </TodayRise>

        {/* The same beat as the notifications card above: the two of them are
            one settings block, split only because five rows on one surface stop
            reading as a group. */}
        <TodayRise show={loaded} delay={arrivalBeats.hero} distance={rise.card}>
          <ProfileCard>
            <ProfileRow
              divided={false}
              testID="profile-units-row"
              icon={<Scale size={22} strokeWidth={1.8} color={colors.inkMuted} />}
              label="Units"
              value={(
                <ProfileSegment
                  options={['lb', 'kg'] as const}
                  value={weightUnit}
                  onChange={setWeightUnit}
                  label="Units"
                />
              )}
            />
            <ProfileRow
              testID="profile-goal-row"
              icon={<Target size={22} strokeWidth={1.8} color={colors.inkMuted} />}
              label="Goal weight"
              accessibilityLabel="Goal weight"
              onPress={() => setGoalOpen(true)}
              value={(
                <ProfileValuePill
                  label={goalWeight === null ? 'Set a goal' : `${formatWeight(goalWeight)} ${weightUnit}`}
                />
              )}
            />
            {/* The pace sits under the goal it belongs to, and only under a goal
                that exists. `services/onboarding.ts` writes `weekly_pace` only
                beside a goal weight, because a pace with nothing to apply it to
                is a slider position and not a plan, and a row offering one would
                take an answer Poke then throws away. Setting a goal on the row
                above brings this row back with it. */}
            {goalWeight === null ? null : (
              <ProfileRow
                testID="profile-pace-row"
                icon={<Gauge size={22} strokeWidth={1.8} color={colors.inkMuted} />}
                label="Weekly pace"
                accessibilityLabel={weeklyPace === null
                  ? 'Weekly pace. Poke holds no pace for you'
                  : `Weekly pace, ${formatPaceRate(weeklyPace, weightUnit)}`}
                onPress={() => setPaceOpen(true)}
                value={(
                  <ProfileValuePill
                    label={weeklyPace === null ? 'Set a pace' : formatPace(weeklyPace, weightUnit)}
                  />
                )}
              />
            )}
            {/* This card is where a weight is read, so the place it can be read
                from belongs on it. It is a row and a sheet rather than a switch:
                a switch promises that flipping it back undoes the permission, and
                only the user can do that, in the Health app. */}
            {isHealthSupported() ? (
              <ProfileRow
                testID="profile-health-row"
                icon={<HeartPulse size={22} strokeWidth={1.8} color={colors.inkMuted} />}
                label="Apple Health"
                accessibilityLabel="Apple Health"
                onPress={() => setHealthOpen(true)}
                value={<ProfileValuePill label={healthOn ? 'On' : 'Connect'} quiet={!healthOn} />}
              />
            ) : null}
          </ProfileCard>
        </TodayRise>

        <TodayRise show={loaded} delay={arrivalBeats.list} distance={rise.card}>
          <ProfileCard>
            <ProfileRow
              testID="profile-export-row"
              divided={false}
              icon={<Share size={22} strokeWidth={1.8} color={colors.inkMuted} />}
              label="Export history"
              accessibilityLabel={pro ? 'Export history as CSV' : 'Export history as CSV. See Poke Pro'}
              onPress={runExport}
              value={<ProfileExportValue state={exporting ? 'busy' : pro ? 'idle' : 'locked'} />}
            />
            {/* Hidden only when Poke cannot sell a subscription at all. A slot
                that offers a tier the store has never heard of is a dead tap. */}
            {paywallEnabled ? (
              <ProfileProSlot
                testID="profile-pro-slot"
                state={proSlot.state}
                accessibilityLabel={proSlot.label}
                onPress={proSlot.onPress}
                icon={<Sparkles size={22} strokeWidth={1.8} color={colors.successDeep} />}
              />
            ) : null}
          </ProfileCard>
        </TodayRise>

        <TodayRise show={loaded} delay={arrivalBeats.track} distance={rise.line}>
          <View style={styles.links}>
            {/* Medications is a link rather than a row: it is the only way into
                the screen that edits a dose or a schedule, and Today only reaches
                `medications/new`. Cutting it from Profile would strand the
                editor. */}
            <ProfileLink
              testID="profile-link-medications"
              label="Medications"
              onPress={() => router.push('/medications')}
            />
            <ProfileLink
              testID="profile-link-about"
              label="About Poke"
              onPress={() => setAboutOpen(true)}
            />
            {paywallEnabled ? (
              <ProfileLink
                testID="profile-link-restore"
                label={restoring ? 'Restoring' : 'Restore purchases'}
                onPress={runRestore}
              />
            ) : null}
            {/* Opens the App Store review composer. Never StoreReview.requestReview():
                StoreKit can show nothing, and a button that does nothing is a dead tap. */}
            <ProfileLink
              testID="profile-link-rate"
              label="Rate Poke"
              onPress={() => { openWriteReview().catch(() => {}); }}
            />
            {/* The only way into /redeem. The paywall never links here: a buyer
                reading a price must not be shown a way around it. */}
            <ProfileLink
              testID="profile-link-tester"
              label="Tester code"
              value={testerProAt === null ? undefined : 'Tester access is on'}
              onPress={() => router.push('/redeem')}
            />
            {version === null ? null : (
              <Text testID="profile-version" variant="caption" color={colors.inkSubtle} style={styles.version}>
                Poke {version}
              </Text>
            )}
          </View>
        </TodayRise>

        {__DEV__ ? (
          <Card padding="md" style={styles.devCard}>
            <Text variant="smallStrong">Entitlement</Text>
            <TimeRangeToggle
              options={['real', 'free', 'pro'] as const}
              value={devOverride ?? 'real'}
              onChange={(next) => setDevOverride(next === 'real' ? null : (next as DevOverride))}
              size="sm"
            />
            <Text variant="caption" color={colors.inkSubtle}>
              Debug builds only. &quot;real&quot; follows the App Store.
            </Text>
          </Card>
        ) : null}
      </ScrollView>

      <BottomSheet visible={timeOpen} title="Reminder time" onClose={() => setTimeOpen(false)}>
        <View style={styles.sheet}>
          {/* Five minute rows, the same grid the onboarding screen uses.
              A time already saved off the grid keeps its own row. */}
          <InlineTimePicker
            value={preferences?.reminder_time ?? '09:00'}
            onChange={setReminderTime}
            minuteStep={5}
          />
          {/* The wheel saves each turn, so this closes the sheet and nothing
              else. A label that said "Save" would name work already done. */}
          <Button onPress={() => setTimeOpen(false)}>Done</Button>
        </View>
      </BottomSheet>

      <BottomSheet visible={delayOpen} title="Check-in delay" onClose={() => setDelayOpen(false)}>
        <View style={styles.sheet}>
          {/* Hours after a logged shot. Poke moves the banner to the nearest
              hour between 10 in the morning and 8 at night, so a check-in owed
              at 3 in the morning waits for the morning. */}
          <TimeRangeToggle
            options={CHECKIN_DELAY_CHOICES}
            value={String(checkinDelay)}
            onChange={setCheckinDelay}
            getLabel={(option) => `${option} h`}
          />
          <Button onPress={() => setDelayOpen(false)}>Done</Button>
        </View>
      </BottomSheet>

      <BottomSheet visible={goalOpen} title="Goal weight" onClose={() => setGoalOpen(false)}>
        <View style={styles.sheet}>
          <Input
            value={goalDraft}
            onChangeText={setGoalDraft}
            keyboardType="decimal-pad"
            inputMode="decimal"
            placeholder="Enter a number"
            accessibilityLabel="Goal weight"
          />
          <Text variant="small" color={colors.inkMuted}>{weightUnit}</Text>
          <Button disabled={savingGoal} onPress={saveGoal}>{savingGoal ? 'Saving' : 'Save goal'}</Button>
        </View>
      </BottomSheet>

      {/* The setup slider, in a sheet. The sheet is a Modal and not a
          ScrollView, so the drag belongs to the slider the whole way across.
          Nothing here names a date: the pace is a number the user owns, and the
          one screen that draws a projection from it is the setup plan. */}
      <BottomSheet visible={paceOpen} title="Weekly pace" onClose={() => setPaceOpen(false)}>
        <View style={styles.sheet}>
          <Text variant="display">{formatPaceRate(paceDraft, weightUnit)}</Text>
          <Slider
            value={paceDraft}
            min={paceRange.min}
            max={paceRange.max}
            step={paceStep}
            onChange={setPaceDraft}
            accessibilityLabel="Weekly pace"
            format={(value) => formatPace(value, weightUnit)}
          />
          <Text variant="small" color={colors.inkMuted}>
            Speak to your clinician about the pace that suits you. Poke gives no medical
            advice and recommends no rate of change.
          </Text>
          <Button disabled={savingPace} onPress={savePace}>{savingPace ? 'Saving' : 'Save pace'}</Button>
        </View>
      </BottomSheet>

      <BottomSheet visible={healthOpen} title="Apple Health" onClose={() => setHealthOpen(false)}>
        <View style={styles.sheet}>
          {/* Every sentence here is checkable in `services/health.ts`: the query
              names one type, the permission asks to read and never to write, and
              nothing on this path reaches the network. */}
          <Text color={colors.inkMuted}>
            Poke reads your weight from Apple Health and adds it to your log. Poke reads nothing else. Poke writes nothing back and sends nothing anywhere.
          </Text>
          {healthOn && healthReadAt !== null ? (
            <Text variant="small" color={colors.inkMuted}>
              {`Poke last read Apple Health on ${fmtDateTime(healthReadAt)}.`}
            </Text>
          ) : null}
          {healthNote === null ? null : (
            <Text variant="small" color={colors.inkMuted}>{healthNote}</Text>
          )}
          {/* The first press is the one that raises the HealthKit prompt, and
              guideline 5.1.1(iv) reserves that button for a plain "Continue":
              the sentence above is the explanation, and the button only moves
              on to Apple's own sheet. Once the permission is granted no prompt
              follows, so the connected label names the read instead. */}
          <Button disabled={healthBusy} onPress={() => { void readHealth(); }}>
            {healthBusy ? 'Reading Apple Health' : healthOn ? 'Read Apple Health now' : 'Continue'}
          </Button>
          {healthOn ? (
            <>
              {/* Stopping is Poke's own switch and not the permission, and it
                  keeps the weigh-ins Poke has already read. The row would be a
                  lie if it did not say which of the two it does. */}
              <Button variant="ghost" disabled={healthBusy} onPress={() => { void stopHealth(); }}>
                Stop reading Apple Health
              </Button>
              <Text variant="caption" color={colors.inkSubtle}>
                Stopping keeps the weigh-ins Poke already read. Take the permission back in the Health app under Sharing.
              </Text>
            </>
          ) : null}
        </View>
      </BottomSheet>

      <BottomSheet visible={aboutOpen} title="About Poke" onClose={() => setAboutOpen(false)}>
        <View style={styles.aboutSheet}>
          <View style={styles.aboutHead}>
            <View style={styles.aboutIcon}><Info size={22} color={colors.accent} /></View>
            <View style={styles.aboutTitle}>
              <Text variant="h2">Poke</Text>
              <Text variant="small" color={colors.inkMuted}>A private log for your routine.</Text>
            </View>
          </View>
          {/* The link that opens this sheet is one word now, so both halves have
              to be here. Privacy is the reason a lot of people install Poke.
              Every line is checkable: the package list holds no analytics SDK,
              `src/` and `app/` make no network call, and the only dependency that
              reaches a server is RevenueCat, which carries a purchase receipt and
              never the log. */}
          <View style={styles.disclaimer}>
            <Text variant="bodyStrong">Privacy</Text>
            <Text color={colors.inkMuted}>
              Your log stays on this device. Poke has no account and no sign-in. Poke sends no health data anywhere.
            </Text>
            {/* The one door into the app from outside it. The paragraph above
                promises nothing leaves, and this says what may come in, so a
                reader meets both halves in the same place. */}
            {isHealthSupported() ? (
              <Text variant="small" color={colors.inkMuted}>
                Poke reads your weight from Apple Health only after you ask. Poke reads nothing else and writes nothing back.
              </Text>
            ) : null}
            <Text variant="small" color={colors.inkMuted}>
              Poke keeps no copy on a server, so export your history before you remove the app.
            </Text>
          </View>
          <View style={styles.disclaimer}>
            <Text variant="bodyStrong">Medical disclaimer</Text>
            <Text color={colors.inkMuted}>
              Poke is for personal record keeping only. Poke does not provide medical advice, diagnosis, treatment guidance, dosage recommendations, administration instructions, or emergency support.
            </Text>
            <Text variant="small" color={colors.inkMuted}>For medical questions, contact a licensed clinician.</Text>
          </View>
        </View>
      </BottomSheet>
    </View>
  );
}

/** The same state Progress shows when the database does not answer. */
function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.state}>
      <Text color={colors.inkMuted} style={styles.stateCopy}>
        Your profile did not load.
      </Text>
      <Button size="sm" onPress={onRetry}>Try again</Button>
    </View>
  );
}

/** Monday of the week that started `RECORD_WEEKS - 1` weeks ago. */
function recordWindowStart(now = Date.now()): number {
  return startOfWeek(subWeeks(now, RECORD_WEEKS - 1), { weekStartsOn: 1 }).getTime();
}

/**
 * Shots per ISO week, and the first one inside the window.
 *
 * The count and the date are read from the same rows the bars are, so the line
 * over the strip can never disagree with it. A user who started before the
 * window reads a true sentence about the window rather than about their whole
 * history, which is what the thirteen bars show.
 */
function recordFrom(rows: readonly InjectionRow[], now = Date.now()): ProfileRecord {
  const start = recordWindowStart(now);
  const weeks = new Array<number>(RECORD_WEEKS).fill(0);
  let total = 0;
  let since: number | null = null;
  for (const row of rows) {
    const index = differenceInCalendarWeeks(row.taken_at, start, { weekStartsOn: 1 });
    if (index < 0 || index >= RECORD_WEEKS) continue;
    weeks[index] = (weeks[index] ?? 0) + 1;
    total += 1;
    if (since === null || row.taken_at < since) since = row.taken_at;
  }
  return { weeks, total, since };
}

/** `195 lb`, not `195.0 lb`. A goal is rarely a tenth. */
function formatWeight(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function convertWeight(value: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return value;
  return from === 'kg' ? kgToLb(value) : lbToKg(value);
}

/**
 * Where the pace slider rests for a user who has none saved.
 *
 * The same resting position the setup slider opens on, in whichever unit the
 * user reads. It is a position and not a proposal: the row above it says "Set a
 * pace" rather than a number, and nothing reaches the database until the user
 * presses the button.
 */
function restingPace(unit: WeightUnit): number {
  return convertPace(PACE_DEFAULT_LB, 'lb', unit);
}

/**
 * What the sheet says a read did.
 *
 * `empty` is the honest end of a refused permission as well as of an empty Health
 * store, because iOS reports the two the same way, so the line names both the
 * thing Poke saw and the place the user can check.
 */
function healthNoteFor(result: HealthImport, unit: WeightUnit): string {
  if (result.kind === 'unsupported') return 'Apple Health is not available on this device.';
  if (result.kind === 'failed') return `Poke could not read Apple Health. ${result.message}`;
  if (result.kind === 'empty') {
    return 'Poke found no weight in Apple Health. Check that Poke has access to weight in the Health app.';
  }

  const newest = `${formatWeight(convertWeight(result.latestKg, 'kg', unit))} ${unit}`;
  if (result.added === 0) return `Poke is up to date. The newest weigh-in is ${newest}.`;
  if (result.added === 1) return `Poke added 1 weigh-in. The newest is ${newest}.`;
  return `Poke added ${result.added} weigh-ins. The newest is ${newest}.`;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.screen,
    paddingBottom: 112,
  },
  links: {
    paddingHorizontal: spacing.xs,
  },
  state: {
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  stateCopy: {
    textAlign: 'center',
  },
  version: {
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.xs,
    fontVariant: ['tabular-nums'],
  },
  devCard: {
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  aboutSheet: {
    gap: spacing.xl,
    paddingBottom: spacing.lg,
  },
  aboutHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  aboutIcon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 23,
    backgroundColor: colors.accentSoft,
  },
  aboutTitle: {
    flex: 1,
    gap: 2,
  },
  disclaimer: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
  },
  sheet: {
    gap: spacing.md,
  },
});
