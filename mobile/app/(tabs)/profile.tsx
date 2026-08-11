import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { differenceInCalendarWeeks, startOfWeek, subWeeks } from 'date-fns';
import { Bell, Info, Scale, Share, Sparkles, Target } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { clockLabel, InlineTimePicker } from '@/components/InlineTimePicker';
import { Input } from '@/components/Input';
import { ProfileRecordStrip, RECORD_WEEKS, type ProfileRecord } from '@/components/profile-record-strip';
import {
  ProfileCard,
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
import { kgToLb, lbToKg, type WeightUnit } from '@/domain/units';
import { listInjections } from '@/repositories/injections';
import {
  getPreferences,
  updateGoalWeight,
  updatePreferences,
  type PreferencesPatch,
} from '@/repositories/preferences';
import { exportHistory } from '@/services/export';
import { ensureNotificationPermission, refreshScheduledReminders } from '@/services/notifications';
import { openManageSubscriptions } from '@/services/purchases';
import { maybePromptForReview, openWriteReview } from '@/services/review';
import { useAppStore } from '@/stores/app';
import {
  useEntitlementStore,
  useIsPro,
  usePaywallEnabled,
  useTesterProAt,
  type DevOverride,
} from '@/stores/entitlement';
import { openPaywall } from '@/components/ProLock';
import { arrivalBeats, colors, rise, spacing } from '@/theme';

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
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalDraft, setGoalDraft] = useState('');
  const [savingGoal, setSavingGoal] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
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

  const runExport = async () => {
    if (!pro) {
      openPaywall();
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
        onPress: openPaywall,
      };

  const goalWeight = preferences?.goal_weight ?? null;
  const weightUnit = preferences?.weight_unit ?? 'lb';
  const remindersOn = preferences?.notifications_enabled === 1;
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
              label="Shot reminders"
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
                      accessibilityLabel="Shot reminders"
                      value={remindersOn}
                      onValueChange={toggleReminders}
                      trackColor={{ true: colors.accent, false: colors.borderStrong }}
                      thumbColor={colors.surface}
                    />
                  </View>
                </>
              )}
            />
            <ProfileRow
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
              label="Tester access"
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
