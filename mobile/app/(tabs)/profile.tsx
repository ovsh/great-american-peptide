import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { Bell, ChevronRight, Info, Pill, Scale, Target } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { InlineTimePicker } from '@/components/InlineTimePicker';
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
import { ensureNotificationPermission, refreshScheduledReminders } from '@/services/notifications';
import { useAppStore } from '@/stores/app';
import { colors, spacing } from '@/theme';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const dataVersion = useAppStore((state) => state.dataVersion);
  const bumpVersion = useAppStore((state) => state.bumpVersion);
  const [preferences, setPreferences] = useState<PreferencesRow | null>(null);
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalDraft, setGoalDraft] = useState('');
  const [savingGoal, setSavingGoal] = useState(false);

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
      Alert.alert('Could not save preference', error instanceof Error ? error.message : 'Try again.');
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
      Alert.alert('Could not save goal', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setSavingGoal(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}> 
        <Text variant="display">Profile</Text>

        <SettingsSection label="My medications">
          <SettingsRow
            icon={<Pill size={20} color={colors.accent} />}
            label="Medications"
            detail="Dose, schedule, and status"
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
            {preferences?.notifications_enabled === 1 ? (
              <View style={styles.pickerRow}>
                <Text variant="smallStrong">Reminder time</Text>
                <InlineTimePicker value={preferences.reminder_time} onChange={setReminderTime} />
              </View>
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

        <SettingsSection label="About">
          <Card style={styles.aboutCard}>
            <View style={styles.aboutHead}>
              <Info size={20} color={colors.inkMuted} />
              <Text variant="bodyStrong">Poke</Text>
            </View>
            <Text variant="small" color={colors.inkMuted}>
              Poke is a private logging tool. It does not provide clinical guidance, dosing advice, or administration instructions.
            </Text>
          </Card>
        </SettingsSection>
      </ScrollView>

      <BottomSheet visible={goalOpen} title="Goal weight" onClose={() => setGoalOpen(false)}>
        <View style={styles.goalSheet}>
          <Input
            value={goalDraft}
            onChangeText={setGoalDraft}
            keyboardType="decimal-pad"
            inputMode="decimal"
            placeholder="175"
            accessibilityLabel="Goal weight"
          />
          <Text variant="small" color={colors.inkMuted}>{preferences?.weight_unit ?? 'lb'}</Text>
          <Button disabled={savingGoal} onPress={saveGoal}>{savingGoal ? 'Saving' : 'Save goal'}</Button>
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
  aboutCard: {
    gap: spacing.md,
  },
  aboutHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  goalSheet: {
    gap: spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },
});
