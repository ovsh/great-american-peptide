import { useEffect, useMemo, useRef, useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable, Alert, TextInput, Platform, KeyboardAvoidingView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Check, X, ChevronDown, ChevronUp } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { Header } from '@/components/Header';
import { Section } from '@/components/Section';
import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { Stepper } from '@/components/Stepper';
import { Field } from '@/components/Field';
import { BodyDiagram } from '@/components/BodyDiagram';
import { TimeRangeToggle } from '@/components/TimeRangeToggle';

import { listMedications, createMedication, nextColorIndex } from '@/repositories/medications';
import { createInjection } from '@/repositories/injections';
import type { MedicationRow } from '@/db/types';
import { getBodySite, type View as BodyView } from '@/domain/bodySites';
import { peptidePresets, getPreset } from '@/domain/peptides';
import { useAppStore } from '@/stores/app';
import { safeBack } from '@/utils/nav';
import { colors, spacing, radius, text as typo } from '@/theme';

const haptic = (kind: 'select' | 'success' = 'select') => {
  if (Platform.OS === 'web') return;
  if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else Haptics.selectionAsync();
};

const splitTime = (ts: number) => {
  const d = new Date(ts);
  let h = d.getHours();
  const m = d.getMinutes();
  const meridiem: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return { hour: String(h), minute: String(m).padStart(2, '0'), meridiem };
};

const splitDate = (ts: number) => {
  const d = new Date(ts);
  return {
    month: String(d.getMonth() + 1).padStart(2, '0'),
    day: String(d.getDate()).padStart(2, '0'),
    year: String(d.getFullYear()),
  };
};

const composeDate = (base: number, month: string, day: string, year: string): number => {
  const mo = parseInt(month, 10);
  const da = parseInt(day, 10);
  const yr = parseInt(year, 10);
  if (isNaN(mo) || isNaN(da) || isNaN(yr) || mo < 1 || mo > 12 || da < 1 || yr < 1900 || yr > 2100) {
    return base;
  }
  const d = new Date(base);
  d.setFullYear(yr, mo - 1, da);
  if (d.getFullYear() !== yr || d.getMonth() !== mo - 1 || d.getDate() !== da) return base;
  return d.getTime();
};

const composeTime = (base: number, hour: string, minute: string, meridiem: 'AM' | 'PM'): number => {
  let h = parseInt(hour, 10);
  const m = parseInt(minute, 10);
  if (isNaN(h) || isNaN(m) || h < 1 || h > 12 || m < 0 || m > 59) return base;
  if (meridiem === 'PM' && h < 12) h += 12;
  if (meridiem === 'AM' && h === 12) h = 0;
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d.getTime();
};

const presetCategoryLabel: Record<string, string> = {
  glp1: 'GLP-1',
  recovery: 'Recovery',
  longevity: 'Longevity',
  growth: 'Growth',
  other: 'Other',
};

export default function LogShotScreen() {
  const params = useLocalSearchParams<{ medicationId?: string }>();
  const bumpVersion = useAppStore((s) => s.bumpVersion);

  const [meds, setMeds] = useState<MedicationRow[]>([]);
  const [medicationId, setMedicationId] = useState<string | null>(null);
  const [medOpen, setMedOpen] = useState(false);
  const [creatingFromPreset, setCreatingFromPreset] = useState<string | null>(null);
  const [dose, setDose] = useState<number>(0.25);
  const [view, setView] = useState<BodyView>('front');
  const [siteId, setSiteId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [takenAt, setTakenAt] = useState<number>(() => Date.now());

  const timeParts = splitTime(takenAt);
  const dateParts = splitDate(takenAt);
  const [monthDraft, setMonthDraft] = useState<string | null>(null);
  const [dayDraft, setDayDraft] = useState<string | null>(null);
  const [yearDraft, setYearDraft] = useState<string | null>(null);
  const [hourDraft, setHourDraft] = useState<string | null>(null);
  const [minuteDraft, setMinuteDraft] = useState<string | null>(null);
  const monthRef = useRef<TextInput>(null);
  const dayRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);
  const hourRef = useRef<TextInput>(null);
  const minuteRef = useRef<TextInput>(null);

  const commitMonth = () => {
    if (monthDraft === null) return;
    const next = composeDate(takenAt, monthDraft, dateParts.day, dateParts.year);
    setTakenAt(next);
    setMonthDraft(null);
  };
  const commitDay = () => {
    if (dayDraft === null) return;
    const next = composeDate(takenAt, dateParts.month, dayDraft, dateParts.year);
    setTakenAt(next);
    setDayDraft(null);
  };
  const commitYear = () => {
    if (yearDraft === null) return;
    const next = composeDate(takenAt, dateParts.month, dateParts.day, yearDraft);
    setTakenAt(next);
    setYearDraft(null);
  };
  const commitHour = () => {
    if (hourDraft === null) return;
    const next = composeTime(takenAt, hourDraft, timeParts.minute, timeParts.meridiem);
    setTakenAt(next);
    setHourDraft(null);
  };
  const commitMinute = () => {
    if (minuteDraft === null) return;
    const next = composeTime(takenAt, timeParts.hour, minuteDraft, timeParts.meridiem);
    setTakenAt(next);
    setMinuteDraft(null);
  };
  const setMeridiem = (m: 'AM' | 'PM') => {
    if (m === timeParts.meridiem) return;
    haptic();
    setTakenAt(composeTime(takenAt, timeParts.hour, timeParts.minute, m));
  };

  useEffect(() => {
    (async () => {
      const all = await listMedications();
      const active = all.filter((m) => m.status !== 'archived');
      setMeds(active);
      const initial = params.medicationId ?? active[0]?.id ?? null;
      const initialMed = initial ? active.find((m) => m.id === initial) : null;
      if (initialMed) {
        setMedicationId(initialMed.id);
        setDose(initialMed.default_dose);
      }
    })();
  }, [params.medicationId]);

  const selectMed = (id: string) => {
    const m = meds.find((x) => x.id === id);
    if (!m) return;
    setMedicationId(id);
    setDose(m.default_dose);
  };

  const onPickSavedMed = (id: string) => {
    if (id !== medicationId) haptic();
    selectMed(id);
    setMedOpen(false);
  };

  const onPickPreset = async (presetId: string) => {
    const preset = getPreset(presetId);
    if (!preset) return;
    setCreatingFromPreset(presetId);
    haptic();
    try {
      const colorIdx = await nextColorIndex();
      const created = await createMedication({
        name: preset.name,
        presetId: preset.id,
        defaultDose: preset.defaultDose,
        defaultUnit: preset.unit,
        defaultRoute: preset.defaultRoute,
        frequencyKind: preset.defaultFrequency.kind,
        frequencyValue: preset.defaultFrequency.value ?? null,
        halfLifeHours: preset.halfLifeHours,
        tmaxHours: preset.tmaxHours,
        colorIndex: colorIdx,
      });
      const newMeds = [...meds, created].sort((a, b) => a.name.localeCompare(b.name));
      setMeds(newMeds);
      setMedicationId(created.id);
      setDose(created.default_dose);
      setMedOpen(false);
      bumpVersion();
    } catch (err: any) {
      Alert.alert('Could not add medication', String(err?.message ?? err));
    } finally {
      setCreatingFromPreset(null);
    }
  };

  const med = meds.find((m) => m.id === medicationId) ?? null;
  const selectedSite = siteId ? getBodySite(siteId) : null;

  const presetItems = useMemo(() => {
    const savedPresetIds = new Set(meds.map((m) => m.preset_id).filter(Boolean) as string[]);
    return peptidePresets.filter((p) => !savedPresetIds.has(p.id));
  }, [meds]);

  const onSubmit = async () => {
    if (!med) {
      Alert.alert('Pick a medication first.');
      return;
    }
    if (dose <= 0) {
      Alert.alert('Enter a dose greater than zero.');
      return;
    }
    setSubmitting(true);
    try {
      await createInjection({
        medicationId: med.id,
        dose,
        unit: med.default_unit,
        route: med.default_route,
        siteId,
        takenAt,
      });
      bumpVersion();
      haptic('success');
      safeBack('/');
    } catch (err: any) {
      Alert.alert('Could not save', String(err?.message ?? err));
    } finally {
      setSubmitting(false);
    }
  };

  const monthDisplay = monthDraft ?? dateParts.month;
  const dayDisplay = dayDraft ?? dateParts.day;
  const yearDisplay = yearDraft ?? dateParts.year;
  const hourDisplay = hourDraft ?? timeParts.hour;
  const minuteDisplay = minuteDraft ?? timeParts.minute;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Header
        title="Log Shot"
        leading={
          <Pressable onPress={() => safeBack('/')} hitSlop={10} style={styles.closeBtn}>
            <X size={22} color={colors.ink} />
          </Pressable>
        }
        trailing={
          <Pressable onPress={onSubmit} hitSlop={10} disabled={submitting || !med}>
            <Check size={22} color={!med ? colors.inkSubtle : colors.red} />
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.hero }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ paddingHorizontal: spacing.screen }}>
          <Field label="Medication">
            <Pressable
              onPress={() => {
                haptic();
                setMedOpen((v) => !v);
              }}
              style={styles.dropdownTrigger}
            >
              <Text variant="bodyStrong" color={med ? colors.ink : colors.inkMuted}>
                {med?.name ?? 'Choose a peptide'}
              </Text>
              {medOpen ? (
                <ChevronUp size={20} color={colors.inkMuted} />
              ) : (
                <ChevronDown size={20} color={colors.inkMuted} />
              )}
            </Pressable>
            {medOpen && (
              <View style={styles.dropdownPanel}>
                <ScrollView style={{ maxHeight: 360 }} nestedScrollEnabled>
                  {meds.length > 0 && (
                    <>
                      <Text variant="caption" color={colors.inkMuted} style={styles.dropdownGroupLabel}>
                        Your meds
                      </Text>
                      {meds.map((m) => {
                        const active = m.id === medicationId;
                        return (
                          <Pressable
                            key={m.id}
                            onPress={() => onPickSavedMed(m.id)}
                            style={[styles.dropdownRow, active && styles.dropdownRowActive]}
                          >
                            <View style={{ flex: 1 }}>
                              <Text variant="bodyStrong" color={active ? colors.red : colors.ink}>
                                {m.name}
                              </Text>
                              <Text variant="caption" color={colors.inkMuted}>
                                {m.default_dose} {m.default_unit} · {m.default_route === 'sc' ? 'Subcutaneous' : 'Intramuscular'}
                              </Text>
                            </View>
                            {active && <View style={styles.activeDot} />}
                          </Pressable>
                        );
                      })}
                    </>
                  )}
                  {presetItems.length > 0 && (
                    <>
                      <Text variant="caption" color={colors.inkMuted} style={styles.dropdownGroupLabel}>
                        Add from library
                      </Text>
                      {presetItems.map((p) => {
                        const isCreating = creatingFromPreset === p.id;
                        return (
                          <Pressable
                            key={p.id}
                            onPress={() => onPickPreset(p.id)}
                            disabled={isCreating}
                            style={[styles.dropdownRow, isCreating && { opacity: 0.5 }]}
                          >
                            <View style={{ flex: 1 }}>
                              <Text variant="bodyStrong" color={colors.ink}>
                                {p.name}
                              </Text>
                              <Text variant="caption" color={colors.inkMuted}>
                                {presetCategoryLabel[p.category]} · {p.defaultDose} {p.unit}
                              </Text>
                            </View>
                            <Text variant="caption" color={colors.red}>
                              {isCreating ? 'Adding…' : 'Add +'}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </>
                  )}
                </ScrollView>
              </View>
            )}
          </Field>

          <Field label="Dose">
            <Stepper
              value={dose}
              onChange={setDose}
              step={med?.default_unit === 'mcg' ? 25 : 0.1}
              min={0}
              format={(v) => (v < 1 ? v.toFixed(2) : v.toFixed(1))}
              unit={med?.default_unit ?? ''}
            />
          </Field>

          <Field label="Date & Time">
            <View style={styles.dateTimeControl}>
              <View style={styles.dateRow}>
                <TextInput
                  ref={monthRef}
                  value={monthDisplay}
                  onFocus={() => setMonthDraft(dateParts.month)}
                  onChangeText={setMonthDraft}
                  onBlur={commitMonth}
                  onSubmitEditing={() => dayRef.current?.focus()}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  maxLength={2}
                  selectTextOnFocus
                  style={styles.dateNumInput}
                />
                <Text variant="bodyStrong" color={colors.inkMuted}>/</Text>
                <TextInput
                  ref={dayRef}
                  value={dayDisplay}
                  onFocus={() => setDayDraft(dateParts.day)}
                  onChangeText={setDayDraft}
                  onBlur={commitDay}
                  onSubmitEditing={() => yearRef.current?.focus()}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  maxLength={2}
                  selectTextOnFocus
                  style={styles.dateNumInput}
                />
                <Text variant="bodyStrong" color={colors.inkMuted}>/</Text>
                <TextInput
                  ref={yearRef}
                  value={yearDisplay}
                  onFocus={() => setYearDraft(dateParts.year)}
                  onChangeText={setYearDraft}
                  onBlur={commitYear}
                  onSubmitEditing={() => yearRef.current?.blur()}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  maxLength={4}
                  selectTextOnFocus
                  style={styles.yearInput}
                />
              </View>
              <View style={styles.timeRow}>
                <TextInput
                  ref={hourRef}
                  value={hourDisplay}
                  onFocus={() => setHourDraft(timeParts.hour)}
                  onChangeText={setHourDraft}
                  onBlur={commitHour}
                  onSubmitEditing={() => minuteRef.current?.focus()}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  maxLength={2}
                  selectTextOnFocus
                  style={styles.timeNumInput}
                />
                <Text variant="h3" color={colors.inkMuted}>:</Text>
                <TextInput
                  ref={minuteRef}
                  value={minuteDisplay}
                  onFocus={() => setMinuteDraft(timeParts.minute)}
                  onChangeText={setMinuteDraft}
                  onBlur={commitMinute}
                  onSubmitEditing={() => minuteRef.current?.blur()}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  maxLength={2}
                  selectTextOnFocus
                  style={styles.timeNumInput}
                />
                <View style={styles.meridiemGroup}>
                  {(['AM', 'PM'] as const).map((m) => {
                    const active = m === timeParts.meridiem;
                    return (
                      <Pressable
                        key={m}
                        onPress={() => setMeridiem(m)}
                        style={[styles.meridiemBtn, active && styles.meridiemBtnActive]}
                      >
                        <Text variant="smallStrong" color={active ? colors.inkInverse : colors.inkMuted}>
                          {m}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          </Field>
        </View>

        <Section eyebrow="Site" gap="sm">
          <View style={styles.viewToggleWrap}>
            <TimeRangeToggle
              options={['front', 'back'] as const}
              value={view}
              onChange={(v) => {
                haptic();
                setView(v as BodyView);
              }}
              getLabel={(o) => (o === 'front' ? 'Front' : 'Back')}
            />
          </View>
          <Card padding="md" style={{ alignItems: 'center' }}>
            <BodyDiagram
              view={view}
              selectedId={siteId}
              onSelect={(s) => {
                haptic();
                setSiteId(s.id);
              }}
            />
            <View style={styles.siteLabelRow}>
              {selectedSite ? (
                <Text variant="bodyStrong">{selectedSite.label}</Text>
              ) : (
                <Text variant="small" color={colors.inkMuted}>Tap a site (optional)</Text>
              )}
            </View>
          </Card>
        </Section>

        <View style={{ paddingHorizontal: spacing.screen, paddingTop: spacing.lg }}>
          <Button onPress={onSubmit} disabled={submitting || !med} trailingChevron>
            {submitting ? 'Saving…' : 'Save shot'}
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    minHeight: 56,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  dropdownPanel: {
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  dropdownGroupLabel: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 56,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  dropdownRowActive: {
    backgroundColor: colors.surfaceMuted,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.red,
  },
  dateTimeControl: {
    width: '100%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    gap: 6,
  },
  dateNumInput: {
    ...typo.bodyStrong,
    color: colors.ink,
    textAlign: 'center',
    width: 42,
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderStrong,
  },
  yearInput: {
    ...typo.bodyStrong,
    color: colors.ink,
    textAlign: 'center',
    width: 62,
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderStrong,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    gap: 6,
  },
  timeNumInput: {
    ...typo.h3,
    color: colors.ink,
    textAlign: 'center',
    width: 44,
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderStrong,
  },
  meridiemGroup: {
    flexDirection: 'row',
    gap: 4,
    marginLeft: 6,
  },
  meridiemBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minHeight: 36,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meridiemBtnActive: {
    backgroundColor: colors.surfaceInverse,
    borderColor: colors.surfaceInverse,
  },
  viewToggleWrap: {
    alignItems: 'center',
  },
  siteLabelRow: {
    marginTop: spacing.sm,
    minHeight: 22,
    alignItems: 'center',
  },
});
