import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { Bell, ChevronRight, Info, KeyRound, Pill, Scale, Share2, Sparkles, Star, Target } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { clockLabel, InlineTimePicker } from '@/components/InlineTimePicker';
import { Input } from '@/components/Input';
import { Text } from '@/components/Text';
import { TimeRangeToggle } from '@/components/TimeRangeToggle';
import type { PreferencesRow } from '@/db/types';
import { kgToLb, lbToKg, type WeightUnit } from '@/domain/units';
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
import { colors, spacing } from '@/theme';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const dataVersion = useAppStore((state) => state.dataVersion);
  const bumpVersion = useAppStore((state) => state.bumpVersion);
  const [preferences, setPreferences] = useState<PreferencesRow | null>(null);
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalDraft, setGoalDraft] = useState('');
  const [savingGoal, setSavingGoal] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
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
    const row = await getPreferences();
    setPreferences(row);
    setGoalDraft(row.goal_weight === null ? '' : String(row.goal_weight));
  }, []);

  useEffect(() => {
    load().catch(() => {});
  }, [dataVersion, load]);

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
   * What this row may claim. `useIsPro` is true for three different reasons and
   * only one of them is a purchase, so a tester and a subscriber were both told
   * to manage a subscription in an Apple Account. The tester has none, and the
   * tap left them on an App Store page with nothing on it.
   *
   * The order matches `accessFromState`: a tester grant wins over the store, so
   * it is read first here too. The third case is a store Poke asked and could
   * not reach, which unlocks every feature without selling anything.
   */
  const subscription = testerProAt !== null
    ? {
      title: 'Poke Pro',
      detail: 'A tester code turned Poke Pro on',
      action: 'Open tester access',
      onPress: () => router.push('/redeem'),
    }
    : storeStatus === 'pro'
      ? {
        title: 'Poke Pro',
        detail: 'Active. Manage it in your Apple Account',
        action: 'Manage subscription',
        onPress: openManageSubscriptions,
      }
      : pro
        ? {
          title: 'Poke Pro',
          detail: 'Poke could not reach the App Store',
          action: 'See Poke Pro',
          onPress: openPaywall,
        }
        : {
          title: 'Get Poke Pro',
          detail: 'Levels, trends and export',
          action: 'See Poke Pro',
          onPress: openPaywall,
        };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}>
        <Text variant="display">Profile</Text>

        {paywallEnabled ? (
          <SettingsSection label="Subscription">
            <Card padding="xs" style={styles.groupCard}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={subscription.action}
                onPress={subscription.onPress}
                style={({ pressed }) => [styles.row, styles.divider, pressed && styles.pressed]}
              >
                <View style={styles.rowIcon}><Sparkles size={20} color={colors.accent} /></View>
                <View style={styles.rowCopy}>
                  <Text variant="bodyStrong">{subscription.title}</Text>
                  <Text variant="small" color={colors.inkMuted}>{subscription.detail}</Text>
                </View>
                <ChevronRight size={19} color={colors.inkSubtle} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Restore purchases"
                onPress={runRestore}
                disabled={restoring}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <View style={styles.rowIcon} />
                <View style={styles.rowCopy}>
                  <Text variant="bodyStrong">{restoring ? 'Restoring' : 'Restore purchases'}</Text>
                  <Text variant="small" color={colors.inkMuted}>If you paid on another device</Text>
                </View>
              </Pressable>
            </Card>
          </SettingsSection>
        ) : null}

        <SettingsSection label="My medications">
          <SettingsRow
            icon={<Pill size={20} color={colors.accent} />}
            label="Medications"
            detail="Dose, schedule and status"
            onPress={() => router.push('/medications')}
          />
        </SettingsSection>

        <SettingsSection label="Reminders">
          <Card padding="xs" style={styles.groupCard}>
            <View style={[styles.row, preferences?.notifications_enabled === 1 && styles.divider]}>
              <View style={styles.rowIcon}><Bell size={20} color={colors.accent} /></View>
              <View style={styles.rowCopy}>
                <Text variant="bodyStrong">Shot reminders</Text>
                <Text variant="small" color={colors.inkMuted}>At your usual shot time</Text>
              </View>
              <Switch
                accessibilityLabel="Shot reminders"
                value={preferences?.notifications_enabled === 1}
                onValueChange={toggleReminders}
                trackColor={{ true: colors.accent, false: colors.borderStrong }}
                thumbColor={colors.surface}
              />
            </View>
            {/* The wheels used to sit open on this page, inside its ScrollView.
                A wheel takes every vertical drag that starts on it, so scrolling
                past the Reminders card moved the saved time and said nothing.
                Behind a row it cannot catch a scroll, and it matches the two
                rows below it. */}
            {preferences?.notifications_enabled === 1 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit reminder time"
                onPress={() => setTimeOpen(true)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <View style={styles.rowIcon} />
                <View style={styles.rowCopy}>
                  <Text variant="bodyStrong">Reminder time</Text>
                  <Text variant="small" color={colors.inkMuted}>{clockLabel(preferences.reminder_time)}</Text>
                </View>
                <ChevronRight size={19} color={colors.inkSubtle} />
              </Pressable>
            ) : null}
          </Card>
        </SettingsSection>

        <SettingsSection label="Goals and units">
          <Card padding="xs" style={styles.groupCard}>
            <View style={[styles.row, styles.divider]}>
              <View style={styles.rowIcon}><Scale size={20} color={colors.amber} /></View>
              <View style={styles.rowCopy}>
                <Text variant="bodyStrong">Units</Text>
                <Text variant="small" color={colors.inkMuted}>Weight display</Text>
              </View>
              <TimeRangeToggle
                options={['lb', 'kg'] as const}
                value={preferences?.weight_unit ?? 'lb'}
                onChange={setWeightUnit}
                size="sm"
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit goal weight"
              onPress={() => setGoalOpen(true)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.rowIcon}><Target size={20} color={colors.amber} /></View>
              <View style={styles.rowCopy}>
                <Text variant="bodyStrong">Goal weight</Text>
                <Text variant="small" color={colors.inkMuted}>
                  {preferences?.goal_weight === null || preferences?.goal_weight === undefined
                    ? 'Not set'
                    : `${preferences.goal_weight.toFixed(1)} ${preferences.weight_unit}`}
                </Text>
              </View>
              <ChevronRight size={19} color={colors.inkSubtle} />
            </Pressable>
          </Card>
        </SettingsSection>

        <SettingsSection label="Your data">
          <SettingsRow
            icon={<Share2 size={20} color={colors.violet} />}
            label={exporting ? 'Preparing your file' : 'Export history'}
            detail={pro ? 'A CSV of every shot, weight and side effect' : 'Poke Pro'}
            onPress={runExport}
          />
        </SettingsSection>

        <SettingsSection label="About">
          <Card padding="xs" style={styles.groupCard}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="About Poke"
              onPress={() => setAboutOpen(true)}
              style={({ pressed }) => [styles.row, styles.divider, pressed && styles.pressed]}
            >
              <View style={styles.rowIcon}><Info size={20} color={colors.inkMuted} /></View>
              <View style={styles.rowCopy}>
                <Text variant="bodyStrong">About Poke</Text>
                <Text variant="small" color={colors.inkMuted}>Privacy and medical disclaimer</Text>
              </View>
              <ChevronRight size={19} color={colors.inkSubtle} />
            </Pressable>
            {/* Opens the App Store review composer. Never StoreReview.requestReview():
                StoreKit can show nothing, and a button that does nothing is a dead tap. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Rate Poke on the App Store"
              onPress={() => { openWriteReview().catch(() => {}); }}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.rowIcon}><Star size={20} color={colors.amber} /></View>
              <View style={styles.rowCopy}>
                <Text variant="bodyStrong">Rate Poke</Text>
                <Text variant="small" color={colors.inkMuted}>Opens the App Store</Text>
              </View>
              <ChevronRight size={19} color={colors.inkSubtle} />
            </Pressable>
          </Card>
        </SettingsSection>

        {/* The only way into /redeem. The paywall never links here: a buyer
            reading a price must not be shown a way around it. */}
        <SettingsSection label="Testers">
          <SettingsRow
            icon={<KeyRound size={20} color={colors.inkMuted} />}
            label="Tester access"
            detail={testerProAt === null ? 'Enter a code from Poke' : 'A code keeps Poke Pro on'}
            onPress={() => router.push('/redeem')}
          />
        </SettingsSection>

        {__DEV__ ? (
          <SettingsSection label="Developer">
            <Card padding="xs" style={styles.groupCard}>
              <View style={styles.pickerRow}>
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
              </View>
            </Card>
          </SettingsSection>
        ) : null}
      </ScrollView>

      <BottomSheet visible={timeOpen} title="Reminder time" onClose={() => setTimeOpen(false)}>
        <View style={styles.timeSheet}>
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
        <View style={styles.goalSheet}>
          <Input
            value={goalDraft}
            onChangeText={setGoalDraft}
            keyboardType="decimal-pad"
            inputMode="decimal"
            placeholder="Enter a number"
            accessibilityLabel="Goal weight"
          />
          <Text variant="small" color={colors.inkMuted}>{preferences?.weight_unit ?? 'lb'}</Text>
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
          {/* The row that opens this sheet says "Privacy and medical disclaimer",
              and until now the sheet carried only the second half. Privacy is the
              reason a lot of people install Poke, so the one place they go looking
              for it should say it. Every line here is checkable: the package list
              holds no analytics SDK, `src/` and `app/` make no network call, and
              the only dependency that reaches a server is RevenueCat, which
              carries a purchase receipt and never the log. */}
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

function SettingsSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="smallStrong" color={colors.inkMuted}>{label}</Text>
      {children}
    </View>
  );
}

function SettingsRow({
  icon,
  label,
  detail,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  detail: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <Card padding="xs">
        <View style={styles.row}>
          <View style={styles.rowIcon}>{icon}</View>
          <View style={styles.rowCopy}>
            <Text variant="bodyStrong">{label}</Text>
            <Text variant="small" color={colors.inkMuted}>{detail}</Text>
          </View>
          <ChevronRight size={19} color={colors.inkSubtle} />
        </View>
      </Card>
    </Pressable>
  );
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
    gap: spacing.xxxl,
    paddingHorizontal: spacing.screen,
    paddingBottom: 112,
  },
  section: {
    gap: spacing.sm,
  },
  groupCard: {
    overflow: 'hidden',
  },
  row: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  rowIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  pickerRow: {
    gap: spacing.md,
    padding: spacing.md,
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
  goalSheet: {
    gap: spacing.md,
  },
  timeSheet: {
    gap: spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },
});
