import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronDown, ChevronUp, MapPin, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { BodyDiagram } from '@/components/BodyDiagram';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { InlineTimePicker } from '@/components/InlineTimePicker';
import { Input } from '@/components/Input';
import { Stepper } from '@/components/Stepper';
import { Text } from '@/components/Text';
import { TimeRangeToggle } from '@/components/TimeRangeToggle';
import type { InjectionRow, MedicationRow } from '@/db/types';
import { getBodySite, type BodySite, type View as BodyView } from '@/domain/bodySites';
import { recommendNextSite } from '@/domain/rotation';
import { createInjection, listInjections } from '@/repositories/injections';
import { listMedications } from '@/repositories/medications';
import { maybePromptForReview, recordPositiveEvent } from '@/services/review';
import { refreshScheduledReminders } from '@/services/notifications';
import { useAppStore } from '@/stores/app';
import { colors, radius, spacing } from '@/theme';
import { fmtTime } from '@/utils/date';
import { safeBack } from '@/utils/nav';

interface LogShotDraft {
  medicationId: string | null;
  dose: number;
  suggestedSiteId: string | null;
  selectedSiteId: string | null;
  takenAt: number;
  notes: string;
  detailsOpen: boolean;
}

const INITIAL_DRAFT: LogShotDraft = {
  medicationId: null,
  dose: 0,
  suggestedSiteId: null,
  selectedSiteId: null,
  takenAt: Date.now(),
  notes: '',
  detailsOpen: false,
};

export default function LogShotScreen() {
  const params = useLocalSearchParams<{ medicationId?: string }>();
  const { width, height } = useWindowDimensions();
  const bumpVersion = useAppStore((state) => state.bumpVersion);
  const [medications, setMedications] = useState<MedicationRow[]>([]);
  const [injections, setInjections] = useState<InjectionRow[]>([]);
  const [draft, setDraft] = useState<LogShotDraft>(INITIAL_DRAFT);
  const [view, setView] = useState<BodyView>('front');
  const [saving, setSaving] = useState(false);

  const selectMedication = useCallback((medication: MedicationRow, history: InjectionRow[]) => {
    const rotationHistory = history.flatMap((injection) => (
      injection.site_id ? [{ siteId: injection.site_id, takenAt: injection.taken_at }] : []
    ));
    const suggested = recommendNextSite(rotationHistory, medication.default_route);
    setDraft((current) => ({
      ...current,
      medicationId: medication.id,
      dose: medication.default_dose,
      suggestedSiteId: suggested?.id ?? null,
      selectedSiteId: suggested?.id ?? null,
    }));
    if (suggested) setView(suggested.view);
    selectionHaptic();
  }, []);

  useEffect(() => {
    Promise.all([listMedications(), listInjections({ limit: 500 })])
      .then(([medicationRows, injectionRows]) => {
        const active = medicationRows.filter((medication) => medication.status === 'active');
        const requested = params.medicationId
          ? active.find((medication) => medication.id === params.medicationId)
          : undefined;
        const initial = requested ?? active[0];
        setMedications(active);
        setInjections(injectionRows);
        if (initial) selectMedication(initial, injectionRows);
      })
      .catch(() => {});
  }, [params.medicationId, selectMedication]);

  const selectedMedication = medications.find((medication) => medication.id === draft.medicationId) ?? null;
  const selectedSite = draft.selectedSiteId ? getBodySite(draft.selectedSiteId) : undefined;
  const recentSiteIds = useMemo(
    () => injections.flatMap((injection) => injection.site_id ? [injection.site_id] : []).slice(0, 4),
    [injections],
  );
  const siteCardMaxHeight = Math.min(390, Math.floor(height * 0.46));
  const diagramHeight = Math.max(170, siteCardMaxHeight - 152);
  const diagramWidth = Math.min(
    190,
    width - spacing.screen * 2 - spacing.xl * 2,
    diagramHeight / 2,
  );

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
        takenAt: draft.takenAt,
        notes: draft.notes.trim() || null,
      });
      bumpVersion();
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
                      onPress={() => selectMedication(medication, injections)}
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
                onChange={(dose) => setDraft((current) => ({ ...current, dose }))}
                step={selectedMedication?.default_unit === 'mcg' ? 25 : draft.dose < 1 ? 0.05 : 0.1}
                min={0}
                format={(value) => value < 1 ? value.toFixed(2) : value.toFixed(1)}
                unit={selectedMedication?.default_unit ?? ''}
              />
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
                <Text variant="caption" color={colors.inkMuted}>{fmtTime(draft.takenAt)} · notes</Text>
              </View>
              {draft.detailsOpen
                ? <ChevronUp size={20} color={colors.inkMuted} />
                : <ChevronDown size={20} color={colors.inkMuted} />}
            </Pressable>

            {draft.detailsOpen ? (
              <Card style={styles.details}>
                <View style={styles.section}>
                  <Text variant="smallStrong">Exact time</Text>
                  <InlineTimePicker
                    value={timeValue(draft.takenAt)}
                    onChange={(value) => setDraft((current) => ({ ...current, takenAt: withTime(current.takenAt, value) }))}
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

            <Button disabled={saving || !selectedMedication} onPress={save}>
              {saving ? 'Logging shot' : 'Log shot'}
            </Button>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function timeValue(timestamp: number): string {
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
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
