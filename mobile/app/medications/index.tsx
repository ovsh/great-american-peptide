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
import { resumeMedicationAndRefresh, setMedicationStatusAndRefresh } from '@/services/medicationMutations';
import { refreshScheduledReminders } from '@/services/notifications';
import type { MedicationRow } from '@/db/types';
import { useAppStore } from '@/stores/app';
import { useIsPro } from '@/stores/entitlement';
import { formatDose } from '@/domain/units';
import { doseByDayLabel, parseDoseByDay } from '@/domain/doseByDay';
import { routeInLine } from '@/domain/peptides';
import { weekdayListLabel, weekdaysFromMask } from '@/domain/scheduling';
import { elapsedLabel } from '@/domain/cycle';
import { cycleStateOf } from '@/utils/cycle';
import { fmtDate } from '@/utils/date';
import { colors, spacing } from '@/theme';

const FREQ_LABEL: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  twice_weekly: 'Twice weekly',
  custom: 'Custom',
};

/**
 * How often this medication is taken, as the card says it.
 *
 * The two kinds that carry a number say the number, because "Every N days" and
 * "Same days each week" name the setting rather than the schedule, and the user
 * came to this row to read their own plan back. A day list is an enumerated
 * list, so it keeps its commas.
 */
function freqLine(medication: MedicationRow): string {
  if (medication.frequency_kind === 'every_n_days') {
    const days = medication.frequency_value;
    if (days === null || days < 1) return 'No schedule';
    return days === 1 ? 'Daily' : `Every ${days} days`;
  }
  if (medication.frequency_kind === 'weekdays') {
    const named = weekdayListLabel(weekdaysFromMask(medication.frequency_value));
    return named === '' ? 'No schedule' : `Every ${named}`;
  }
  return FREQ_LABEL[medication.frequency_kind] ?? medication.frequency_kind;
}

/**
 * The dose the card reads back: one number, or the whole plan when the user set
 * a dose per weekday.
 *
 * A day the plan skips takes the default dose, and the schedule line under this
 * one still names that day, so nothing goes missing from the row. The label is
 * an enumerated list, so it keeps its commas.
 */
function doseLine(medication: MedicationRow): string {
  const map = parseDoseByDay(medication.dose_by_day);
  return map === null
    ? formatDose(medication.default_dose, medication.default_unit)
    : doseByDayLabel(map, medication.default_unit);
}

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
  // form that will not save. Only a running medication holds a slot, which is
  // the rule `countActiveMedications` applies at the write.
  const atFreeLimit = !pro && meds.filter((m) => m.status === 'active').length >= FREE_MEDICATION_LIMIT;
  const addMedication = () => (atFreeLimit ? openPaywall() : router.push('/medications/new'));

  const load = useCallback(async () => {
    const [rows, counts] = await Promise.all([listMedications(true), countInjectionsByMedication()]);
    setMeds(rows);
    setShotCounts(counts);
  }, []);

  useEffect(() => { load(); }, [load, dataVersion]);

  // Pause is always free: a user who stopped a medication must be able to say
  // so. Resume puts a medication back among the running ones, so it goes through
  // the same door as adding one when the free slots are full.
  const togglePause = async (m: MedicationRow) => {
    if (m.status === 'paused' && atFreeLimit) {
      openPaywall();
      return;
    }
    if (m.status !== 'paused') {
      await setMedicationStatusAndRefresh(m.id, 'paused');
      bumpVersion();
      return;
    }
    // A resume on a medication with a cycle rewrites the anchor, so week 1 and
    // the shot days both move to today and the old dates cannot be recovered.
    // The sheet says that before the write, and it offers the edit screen for
    // the user who wants a different length this time.
    if (m.cycle_days_on === null) {
      await resumeMedicationAndRefresh(m.id);
      bumpVersion();
      return;
    }
    const ran = m.paused_at === null ? null : elapsedLabel(m.paused_at, Date.now());
    Alert.alert(
      `Resume ${m.name}?`,
      `${ran === null ? '' : `The break ran ${ran}. `}Resume starts a new cycle today. Shot days count from today again.`,
      [
        {
          text: 'Resume',
          onPress: async () => { await resumeMedicationAndRefresh(m.id); bumpVersion(); },
        },
        {
          text: 'Adjust the plan first',
          onPress: () => router.push({ pathname: '/medications/new', params: { medicationId: m.id } }),
        },
        { text: 'Not yet', style: 'cancel' },
      ],
    );
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
            {meds.map((m) => {
              const cycle = cycleStateOf(m);
              const onBreak = cycle.kind === 'onBreak';
              return (
              <Card key={m.id} padding="md" style={styles.card}>
                <View style={styles.row}>
                  <MedVialIcon size={48} colorIndex={m.color_index} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={styles.titleRow}>
                      <Text variant="h3" style={{ flex: 1 }}>{m.name}</Text>
                      {/* A break is a pause with a plan around it, so it says so.
                          A pause with no cycle keeps the plain word. */}
                      {m.status === 'paused' && (
                        onBreak
                          ? <Pill tone="neutral">On break</Pill>
                          : <Pill tone="warning">Paused</Pill>
                      )}
                      {m.status === 'archived' && <Pill tone="neutral">Archived</Pill>}
                    </View>
                    <Text variant="small" color={colors.inkMuted}>
                      {doseLine(m)} {routeInLine(m.default_route)}
                    </Text>
                    <Text variant="caption" color={colors.inkSubtle}>
                      {freqLine(m)}
                      {m.half_life_hours ? ` with a ${m.half_life_hours}h half-life` : ''}
                    </Text>
                    {/* The end date is the pause day plus the break the user
                        set. It appears only when they set one. */}
                    {cycle.kind === 'onBreak' && cycle.endsAt !== null ? (
                      <Text variant="caption" color={colors.inkSubtle}>
                        Break ends {fmtDate(cycle.endsAt)}
                      </Text>
                    ) : null}
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
              );
            })}
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
