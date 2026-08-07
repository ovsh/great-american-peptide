import { useEffect, useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Archive, Pause, Pencil, Play, Plus } from 'lucide-react-native';

import { Header } from '@/components/Header';
import { Section } from '@/components/Section';
import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { Pill } from '@/components/Pill';
import { MedVialIcon } from '@/components/MedVialIcon';
import { openPaywall } from '@/components/ProLock';
import { FREE_MEDICATION_LIMIT, listMedications } from '@/repositories/medications';
import { setMedicationStatusAndRefresh } from '@/services/medicationMutations';
import type { MedicationRow } from '@/db/types';
import { useAppStore } from '@/stores/app';
import { useIsPro } from '@/stores/entitlement';
import { formatDose } from '@/domain/units';
import { colors, spacing } from '@/theme';

const FREQ_LABEL: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  twice_weekly: 'Twice weekly',
  every_n_days: 'Every N days',
  custom: 'Custom',
};

export default function MedicationsScreen() {
  const insets = useSafeAreaInsets();
  const dataVersion = useAppStore((s) => s.dataVersion);
  const bumpVersion = useAppStore((s) => s.bumpVersion);
  const [meds, setMeds] = useState<MedicationRow[]>([]);
  const pro = useIsPro();

  // Send a free user to the paywall from here rather than let them fill in a
  // form that will not save.
  const atFreeLimit = !pro && meds.filter((m) => m.status !== 'archived').length >= FREE_MEDICATION_LIMIT;
  const addMedication = () => (atFreeLimit ? openPaywall() : router.push('/medications/new'));

  const load = useCallback(async () => {
    const rows = await listMedications(true);
    setMeds(rows);
  }, []);

  useEffect(() => { load(); }, [load, dataVersion]);

  const togglePause = async (m: MedicationRow) => {
    const next = m.status === 'paused' ? 'active' : 'paused';
    await setMedicationStatusAndRefresh(m.id, next);
    bumpVersion();
  };

  const archive = (m: MedicationRow) => {
    Alert.alert(
      'Archive medication?',
      `${m.name} will stop appearing in active lists. History stays.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Archive', style: 'destructive', onPress: async () => { await setMedicationStatusAndRefresh(m.id, 'archived'); bumpVersion(); } },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <Header title="Medications" showBack trailing={
        <Pressable accessibilityRole="button" accessibilityLabel="Add medication" onPress={addMedication} hitSlop={10}>
          <Plus size={22} color={colors.ink} />
        </Pressable>
      } />

      <ScrollView contentContainerStyle={{ paddingBottom: spacing.hero }}>
        {meds.length === 0 ? (
          <View style={{ paddingHorizontal: spacing.screen, paddingTop: spacing.lg }}>
            <Card padding="lg">
              <Text variant="h2">No medications yet.</Text>
              <Text variant="small" color={colors.inkMuted} style={{ marginTop: 4 }}>
                Pick a preset or add your own.
              </Text>
              <View style={{ height: spacing.md }} />
              <Button onPress={addMedication} trailingChevron>Add Medication</Button>
            </Card>
          </View>
        ) : (
          <Section gap="sm">
            {meds.map((m) => (
              <Card key={m.id} padding="md" style={styles.card}>
                <View style={styles.row}>
                  <MedVialIcon size={48} colorIndex={m.color_index} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={styles.titleRow}>
                      <Text variant="h3" style={{ flex: 1 }}>{m.name}</Text>
                      {m.status === 'paused' && <Pill tone="warning">Paused</Pill>}
                      {m.status === 'archived' && <Pill tone="neutral">Archived</Pill>}
                    </View>
                    <Text variant="small" color={colors.inkMuted}>
                      {formatDose(m.default_dose, m.default_unit)} · {m.default_route.toUpperCase()}
                    </Text>
                    <Text variant="caption" color={colors.inkSubtle}>
                      {FREQ_LABEL[m.frequency_kind] ?? m.frequency_kind}
                      {m.half_life_hours ? ` · t½ ${m.half_life_hours}h` : ''}
                    </Text>
                  </View>
                </View>
                {m.status !== 'archived' && (
                  <View style={styles.actions}>
                    <Pressable
                      onPress={() => router.push({ pathname: '/medications/new', params: { medicationId: m.id } })}
                      hitSlop={6}
                      style={styles.action}
                    >
                      <Pencil size={16} color={colors.ink} />
                      <Text variant="caption" color={colors.ink}>Edit</Text>
                    </Pressable>
                    <Pressable onPress={() => togglePause(m)} hitSlop={6} style={styles.action}>
                      {m.status === 'paused'
                        ? <Play size={16} color={colors.ink} />
                        : <Pause size={16} color={colors.ink} />}
                      <Text variant="caption" color={colors.ink}>
                        {m.status === 'paused' ? 'Resume' : 'Pause'}
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => archive(m)} hitSlop={6} style={styles.action}>
                      <Archive size={16} color={colors.inkMuted} />
                      <Text variant="caption" color={colors.inkMuted}>Archive</Text>
                    </Pressable>
                  </View>
                )}
              </Card>
            ))}
          </Section>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
