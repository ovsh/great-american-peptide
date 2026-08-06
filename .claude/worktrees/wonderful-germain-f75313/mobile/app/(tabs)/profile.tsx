import { useEffect, useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Switch, Pressable, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronRight, Calculator, BarChart3, Pill as PillIcon, Info, Activity } from 'lucide-react-native';

import { MastHead } from '@/components/MastHead';
import { TitleBlock } from '@/components/TitleBlock';
import { Section } from '@/components/Section';
import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { Eyebrow } from '@/components/Eyebrow';
import { TimeRangeToggle } from '@/components/TimeRangeToggle';

import { getPreferences, updatePreferences } from '@/repositories/preferences';
import type { PreferencesRow } from '@/db/types';
import { ensureNotificationPermission, refreshScheduledReminders } from '@/services/notifications';
import { useAppStore } from '@/stores/app';
import { colors, spacing } from '@/theme';

const TIMES = ['07:00', '09:00', '12:00', '18:00', '21:00'] as const;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const dataVersion = useAppStore((s) => s.dataVersion);
  const bumpVersion = useAppStore((s) => s.bumpVersion);
  const [prefs, setPrefs] = useState<PreferencesRow | null>(null);

  const load = useCallback(async () => {
    setPrefs(await getPreferences());
  }, []);
  useEffect(() => { load(); }, [load, dataVersion]);

  const togglePrefBool = async (key: 'notifications_enabled') => {
    if (!prefs) return;
    const next = prefs[key] ? 0 : 1;
    if (key === 'notifications_enabled' && next === 1) {
      const ok = await ensureNotificationPermission();
      if (!ok) {
        Alert.alert('Notifications denied', 'Enable them in Settings to receive shot reminders.');
        return;
      }
    }
    await updatePreferences({ [key]: next as 0 | 1 } as any);
    bumpVersion();
    refreshScheduledReminders().catch(() => {});
  };

  const setReminderTime = async (t: string) => {
    await updatePreferences({ reminder_time: t });
    bumpVersion();
    refreshScheduledReminders().catch(() => {});
  };

  const setWeightUnit = async (u: 'lb' | 'kg') => {
    await updatePreferences({ weight_unit: u });
    bumpVersion();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.hero + 80 }}>
        <MastHead />
        <TitleBlock title="Profile" />

        <Section eyebrow="Reports" gap="sm">
          <NavRow
            icon={<BarChart3 size={18} color={colors.ink} />}
            label="Medication Levels"
            onPress={() => router.push('/reports/level')}
          />
          <NavRow
            icon={<Activity size={18} color={colors.ink} />}
            label="Weight Progress"
            onPress={() => router.push('/reports/progress')}
          />
        </Section>

        <View style={{ height: spacing.lg }} />

        <Section eyebrow="Manage" gap="sm">
          <NavRow
            icon={<PillIcon size={18} color={colors.ink} />}
            label="Medications"
            onPress={() => router.push('/medications')}
          />
          <NavRow
            icon={<Calculator size={18} color={colors.ink} />}
            label="Reconstitution Calculator"
            onPress={() => router.push('/calculator')}
          />
        </Section>

        <View style={{ height: spacing.lg }} />

        <Section eyebrow="Preferences" gap="sm">
          <Card padding="md">
            <View style={styles.prefRow}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyStrong">Reminders</Text>
                <Text variant="caption" color={colors.inkMuted}>Local notifications for due shots</Text>
              </View>
              <Switch
                value={prefs?.notifications_enabled === 1}
                onValueChange={() => togglePrefBool('notifications_enabled')}
                trackColor={{ true: colors.red, false: colors.borderStrong }}
                thumbColor={colors.surface}
              />
            </View>
          </Card>

          {prefs?.notifications_enabled === 1 && (
            <Card padding="md">
              <Eyebrow>REMINDER TIME</Eyebrow>
              <View style={{ marginTop: spacing.sm }}>
                <TimeRangeToggle
                  options={TIMES}
                  value={(TIMES.find((t) => t === prefs.reminder_time) ?? '09:00') as typeof TIMES[number]}
                  onChange={setReminderTime}
                  size="sm"
                />
              </View>
            </Card>
          )}

          <Card padding="md">
            <Eyebrow>WEIGHT UNIT</Eyebrow>
            <View style={{ marginTop: spacing.sm }}>
              <TimeRangeToggle
                options={['lb', 'kg'] as const}
                value={(prefs?.weight_unit ?? 'lb') as 'lb' | 'kg'}
                onChange={(v) => setWeightUnit(v as 'lb' | 'kg')}
              />
            </View>
          </Card>
        </Section>

        <View style={{ height: spacing.lg }} />

        <Section eyebrow="About" gap="sm">
          <Card padding="md" variant="muted">
            <View style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Info size={16} color={colors.inkMuted} />
                <Text variant="smallStrong">For information only.</Text>
              </View>
              <Text variant="caption" color={colors.inkMuted}>
                A logging tool, not medical advice. Confirm doses with a clinician.
              </Text>
            </View>
          </Card>
        </Section>
      </ScrollView>
    </View>
  );
}

function NavRow({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.6 }}>
      <Card padding="md">
        <View style={styles.navRow}>
          <View style={styles.navIcon}>{icon}</View>
          <Text variant="bodyStrong" style={{ flex: 1 }}>{label}</Text>
          <ChevronRight size={18} color={colors.inkSubtle} />
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  navIcon: {
    width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
    borderRadius: 8, backgroundColor: colors.surfaceMuted,
    borderWidth: 1, borderColor: colors.border,
  },
});
