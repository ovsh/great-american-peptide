import { useEffect, useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Archive, ArchiveRestore, Pause, Pencil, Play, Plus, Trash2 } from 'lucide-react-native';

import { Header } from '@/components/Header';
import { Section } from '@/components/Section';
import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { Pill } from '@/components/Pill';
import { MedVialIcon } from '@/components/MedVialIcon';
import { openPaywall } from '@/components/ProLock';
import {
  countInjectionsByMedication,
  deleteMedicationIfUnused,
  FREE_MEDICATION_LIMIT,
  listMedications,
} from '@/repositories/medications';
import { setMedicationStatusAndRefresh } from '@/services/medicationMutations';
import { refreshScheduledReminders } from '@/services/notifications';
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
  // How many shots name each medication. It decides which of the two removals
  // the card offers, so it loads with the list rather than after a tap.
  const [shotCounts, setShotCounts] = useState<Record<string, number>>({});
  const pro = useIsPro();

  // Send a free user to the paywall from here rather than let them fill in a
  // form that will not save.
  const atFreeLimit = !pro && meds.filter((m) => m.status !== 'archived').length >= FREE_MEDICATION_LIMIT;
  const addMedication = () => (atFreeLimit ? openPaywall() : router.push('/medications/new'));

  const load = useCallback(async () => {
    const [rows, counts] = await Promise.all([listMedications(true), countInjectionsByMedication()]);
    setMeds(rows);
    setShotCounts(counts);
  }, []);

  useEffect(() => { load(); }, [load, dataVersion]);

  const togglePause = async (m: MedicationRow) => {
    const next = m.status === 'paused' ? 'active' : 'paused';
    await setMedicationStatusAndRefresh(m.id, next);
    bumpVersion();
  };

  // Setup archives every medication past the free limit rather than drop it, so
  // this is the way back after someone subscribes. It goes through the same
  // paywall as adding one, because a restore lands on the active list too.
  const restore = async (m: MedicationRow) => {
    if (atFreeLimit) {
      openPaywall();
      return;
    }
    await setMedicationStatusAndRefresh(m.id, 'active');
    bumpVersion();
  };

  // Archive keeps a medication that has history. Delete is offered only when no
  // injection row names the medication, because `injections.medication_id` has
  // no foreign key and no cascade, so a shot outlives the medication and then
  // renders with no name on it. A medication added by mistake has no shots, and
  // that is the whole case this covers.
  const canDelete = (m: MedicationRow) => (shotCounts[m.id] ?? 0) === 0;

  const archive = (m: MedicationRow) => {
    const body = `Poke removes ${m.name} from your active lists. Your history stays, and Poke can restore ${m.name} later.`;
    Alert.alert(
      'Archive medication?',
      // Say why archive is the only removal on offer, on the card where the
      // shots are the reason.
      canDelete(m) ? body : `${body} Poke cannot delete a medication that has shots logged to it.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Archive', style: 'destructive', onPress: async () => { await setMedicationStatusAndRefresh(m.id, 'archived'); bumpVersion(); } },
      ],
    );
  };

  const remove = (m: MedicationRow) => {
    Alert.alert(
      `Delete ${m.name}?`,
      `Poke removes ${m.name} and its schedule. ${m.name} has no shots logged so no history goes. Poke cannot restore a deleted medication.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const deleted = await deleteMedicationIfUnused(m.id);
              if (!deleted) {
                Alert.alert(
                  'Poke kept this medication',
                  `${m.name} has shots logged to it. Archive ${m.name} instead.`,
                );
              }
              await refreshScheduledReminders().catch(() => {});
              bumpVersion();
            } catch (error: unknown) {
              Alert.alert(
                'Poke could not delete your medication',
                error instanceof Error ? error.message : String(error),
              );
            }
          },
        },
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
                Choose a preset or add your own.
              </Text>
              <View style={{ height: spacing.md }} />
              <Button onPress={addMedication} trailingChevron>Add medication</Button>
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
                {/* An archived medication keeps two actions: Restore, and
                    Delete when no shot names it. */}
                <View style={styles.actions}>
                  {m.status === 'archived' ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Restore ${m.name}`}
                      onPress={() => restore(m)}
                      hitSlop={6}
                      style={styles.action}
                    >
                      <ArchiveRestore size={16} color={colors.ink} />
                      <Text variant="caption" color={colors.ink}>Restore</Text>
                    </Pressable>
                  ) : (
                    <>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Edit ${m.name}`}
                        onPress={() => router.push({ pathname: '/medications/new', params: { medicationId: m.id } })}
                        hitSlop={6}
                        style={styles.action}
                      >
                        <Pencil size={16} color={colors.ink} />
                        <Text variant="caption" color={colors.ink}>Edit</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={m.status === 'paused' ? `Resume ${m.name}` : `Pause ${m.name}`}
                        onPress={() => togglePause(m)}
                        hitSlop={6}
                        style={styles.action}
                      >
                        {m.status === 'paused'
                          ? <Play size={16} color={colors.ink} />
                          : <Pause size={16} color={colors.ink} />}
                        <Text variant="caption" color={colors.ink}>
                          {m.status === 'paused' ? 'Resume' : 'Pause'}
                        </Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Archive ${m.name}`}
                        onPress={() => archive(m)}
                        hitSlop={6}
                        style={styles.action}
                      >
                        <Archive size={16} color={colors.inkMuted} />
                        <Text variant="caption" color={colors.inkMuted}>Archive</Text>
                      </Pressable>
                    </>
                  )}
                  {canDelete(m) ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${m.name}`}
                      onPress={() => remove(m)}
                      hitSlop={6}
                      style={styles.action}
                    >
                      <Trash2 size={16} color={colors.danger} />
                      <Text variant="caption" color={colors.danger}>Delete</Text>
                    </Pressable>
                  ) : null}
                </View>
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
    // Four actions fit one row on a phone. Wrap keeps the fourth reachable when
    // a long name or a large type size takes the width.
    flexWrap: 'wrap',
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
