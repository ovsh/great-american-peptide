import { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { format, isSameDay } from 'date-fns';
import {
  Check,
  ChevronRight,
  Lock,
  Scale,
  Smile,
  Syringe,
} from 'lucide-react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { LineChart } from '@/components/LineChart';
import { MedVialIcon } from '@/components/MedVialIcon';
import { Sparkline } from '@/components/Sparkline';
import { Text } from '@/components/Text';
import type { InjectionRow, MeasurementRow, MedicationRow } from '@/db/types';
import { getBodySite } from '@/domain/bodySites';
import { sideEffectLabel } from '@/domain/sideEffects';
import { kgToLb, lbToKg, type WeightUnit } from '@/domain/units';
import type { SideEffectLog } from '@/repositories/sideEffects';
import { colors, elevation, radius, spacing } from '@/theme';
import { fmtTime, startOfDay } from '@/utils/date';

const DAY_MS = 24 * 60 * 60 * 1000;
const RAIL_ITEM_WIDTH = 88;
const RAIL_GAP = spacing.sm;

export type LevelEstimate =
  | { kind: 'unsupported' }
  | { kind: 'empty' }
  | { kind: 'ready'; current: number; points: readonly { t: number; v: number }[] };

export type DoseState =
  | { kind: 'due'; medicationId: string; scheduledAt: number }
  | { kind: 'upcoming'; scheduledAt: number }
  | { kind: 'loggedToday'; injection: InjectionRow; nextScheduledAt: number | null }
  | { kind: 'unscheduled'; medicationId: string };

export interface TodayMedicationSummary {
  medication: MedicationRow;
  injections: readonly InjectionRow[];
  latestInjection: InjectionRow | null;
  dose: DoseState;
  level: LevelEstimate;
}

interface TodayMedicationSectionProps {
  status: 'loading' | 'ready' | 'error';
  medications: readonly TodayMedicationSummary[];
  selectedMedicationId: string | null;
  onSelectMedication: (medicationId: string) => void;
  pro: boolean;
  contentWidth: number;
  weight: MeasurementRow | null;
  weightSeries: readonly number[];
  weightUnit: WeightUnit;
  sideEffect: SideEffectLog | null;
  onRetry: () => void;
}

export function TodayMedicationSection({
  status,
  medications,
  selectedMedicationId,
  onSelectMedication,
  pro,
  contentWidth,
  weight,
  weightSeries,
  weightUnit,
  sideEffect,
  onRetry,
}: TodayMedicationSectionProps) {
  const selected = medications.find(
    (summary) => summary.medication.id === selectedMedicationId,
  ) ?? medications[0] ?? null;

  if (status === 'loading') return <TodayLoading />;
  if (status === 'error') return <TodayLoadError onRetry={onRetry} />;

  return (
    <View style={styles.section}>
      {selected ? (
        <>
          <MedicationRail
            medications={medications}
            selectedMedicationId={selected.medication.id}
            onSelectMedication={onSelectMedication}
            contentWidth={contentWidth}
          />
          <SelectedMedicationCard summary={selected} />
          <EstimatedLevelCard
            summary={selected}
            pro={pro}
            chartWidth={Math.max(220, contentWidth - spacing.xl * 2)}
          />
        </>
      ) : (
        <EmptyMedication pro={pro} />
      )}

      <TrackTodayCard
        weight={weight}
        weightSeries={weightSeries}
        weightUnit={weightUnit}
        sideEffect={sideEffect}
      />
    </View>
  );
}

function MedicationRail({
  medications,
  selectedMedicationId,
  onSelectMedication,
  contentWidth,
}: {
  medications: readonly TodayMedicationSummary[];
  selectedMedicationId: string;
  onSelectMedication: (medicationId: string) => void;
  contentWidth: number;
}) {
  const railRef = useRef<ScrollView>(null);

  useEffect(() => {
    const selectedIndex = medications.findIndex(
      (summary) => summary.medication.id === selectedMedicationId,
    );
    if (selectedIndex < 0) return;

    const itemOffset = selectedIndex * (RAIL_ITEM_WIDTH + RAIL_GAP);
    const centeredOffset = itemOffset - (contentWidth - RAIL_ITEM_WIDTH) / 2;
    railRef.current?.scrollTo({ x: Math.max(0, centeredOffset), animated: true });
  }, [contentWidth, medications, selectedMedicationId]);

  return (
    <ScrollView
      ref={railRef}
      horizontal
      testID="today-medication-rail"
      accessibilityLabel="Medications"
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.railContent}
    >
      {medications.map((summary) => {
        const medication = summary.medication;
        const selected = medication.id === selectedMedicationId;
        const doseLabel = railDoseLabel(summary.dose);
        return (
          <Pressable
            key={medication.id}
            testID={`today-medication-item-${medication.id}`}
            accessibilityRole="tab"
            accessibilityLabel={`${medication.name}, ${doseLabel.accessibilityLabel}`}
            accessibilityState={{ selected }}
            onPress={() => onSelectMedication(medication.id)}
            style={({ pressed }) => [
              styles.railItem,
              selected && styles.railItemSelected,
              pressed && styles.pressed,
            ]}
          >
            <MedVialIcon size={28} colorIndex={medication.color_index} />
            <Text
              variant="caption"
              align="center"
              numberOfLines={1}
              color={selected ? colors.ink : colors.inkMuted}
              style={styles.railLabel}
            >
              {medication.name}
            </Text>
            <Text
              variant="caption"
              color={doseLabel.emphasis ? colors.successDeep : colors.inkMuted}
              style={styles.railStatus}
            >
              {doseLabel.shortLabel}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function SelectedMedicationCard({ summary }: { summary: TodayMedicationSummary }) {
  const { medication, latestInjection, dose } = summary;
  const presentation = dosePresentation(dose);
  const cadence = cadenceForDose(medication, dose);

  return (
    <View testID="today-selected-medication-card" style={styles.selectedCardShadow}>
      <View style={styles.selectedCardClip}>
        <View style={styles.selectedCardBody}>
          <View style={styles.selectedMedicationHeading}>
            <View style={styles.selectedMedicationCopy}>
              <Text variant="h2" numberOfLines={2}>{medication.name}</Text>
            </View>
            <View
              style={[
                styles.medicationColorMark,
                { backgroundColor: medicationColor(medication) },
              ]}
            />
          </View>

          <View style={styles.nextShotBlock}>
            <Text variant="caption" color={colors.inkMuted}>Next shot</Text>
            <Text style={[styles.nextShotValue, { color: presentation.color }]}>
              {presentation.status}
            </Text>
            <Text variant="small" color={colors.inkMuted}>{presentation.timing}</Text>
          </View>

          <Text variant="smallStrong">
            {medication.default_dose} {medication.default_unit}
            {cadence ? ` · ${cadence}` : ''}
          </Text>
          {dose.kind === 'loggedToday' ? null : (
            <Text variant="caption" color={colors.inkMuted}>
              {lastShotLabel(latestInjection)}
            </Text>
          )}
        </View>

        <DoseBand dose={dose} medicationName={medication.name} />
      </View>
    </View>
  );
}

function DoseBand({ dose, medicationName }: { dose: DoseState; medicationName: string }) {
  if (dose.kind === 'due') {
    return (
      <Pressable
        testID="today-log-shot-action"
        accessibilityRole="button"
        accessibilityLabel={`Log ${medicationName} shot`}
        onPress={() => router.push({
          pathname: '/log-shot',
          params: { medicationId: dose.medicationId },
        })}
        style={({ pressed }) => [
          styles.doseBand,
          styles.dueBand,
          pressed && styles.doseBandPressed,
        ]}
      >
        <Syringe size={21} color={colors.inkInverse} />
        <Text variant="bodyStrong" color={colors.inkInverse}>Log shot</Text>
      </Pressable>
    );
  }

  if (dose.kind === 'loggedToday') {
    const site = dose.injection.site_id ? getBodySite(dose.injection.site_id) : undefined;
    const details = site
      ? `${fmtTime(dose.injection.taken_at).toLocaleLowerCase()} · ${site.label.toLocaleLowerCase()}`
      : fmtTime(dose.injection.taken_at).toLocaleLowerCase();
    return (
      <View
        testID="today-shot-logged"
        accessible
        accessibilityLabel={`Shot logged ${details}`}
        style={[styles.doseBand, styles.loggedBand]}
      >
        <View style={styles.loggedIcon}>
          <Check size={17} strokeWidth={2.5} color={colors.successDeep} />
        </View>
        <Text variant="smallStrong" color={colors.successDeep}>Logged {details}</Text>
      </View>
    );
  }

  if (dose.kind === 'unscheduled') {
    return (
      <Pressable
        testID="today-log-shot-action"
        accessibilityRole="button"
        accessibilityLabel={`Log ${medicationName} shot`}
        onPress={() => router.push({
          pathname: '/log-shot',
          params: { medicationId: dose.medicationId },
        })}
        style={({ pressed }) => [
          styles.doseBand,
          styles.manualBand,
          pressed && styles.pressed,
        ]}
      >
        <Syringe size={20} color={colors.successDeep} />
        <Text variant="smallStrong" color={colors.successDeep}>Log shot</Text>
      </Pressable>
    );
  }

  return null;
}

function EstimatedLevelCard({
  summary,
  pro,
  chartWidth,
}: {
  summary: TodayMedicationSummary;
  pro: boolean;
  chartWidth: number;
}) {
  const { medication, level } = summary;

  return (
    <View testID="today-level-card">
      <Card style={styles.levelCard}>
        <View style={styles.levelHeader}>
          <View style={styles.levelTitleCopy}>
            <Text variant="h2">Estimated level</Text>
            <Text variant="caption" color={colors.inkMuted}>7-day trend</Text>
          </View>
          {pro && level.kind === 'ready' ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`View ${medication.name} level details`}
              onPress={() => router.push({
                pathname: '/reports/level',
                params: { medicationId: medication.id },
              })}
              style={({ pressed }) => [styles.detailsAction, pressed && styles.pressed]}
            >
              <Text variant="smallStrong" color={colors.successDeep}>Details</Text>
              <ChevronRight size={17} color={colors.successDeep} />
            </Pressable>
          ) : null}
        </View>

        {level.kind === 'unsupported' ? (
          <Text color={colors.inkMuted}>
            Poke has no supported half-life for {medication.name}, so it does not draw a curve.
          </Text>
        ) : level.kind === 'empty' ? (
          <Text color={colors.inkMuted}>
            Log a shot to see an estimated level.
          </Text>
        ) : (
          <>
            {pro ? (
              <View style={styles.currentEstimate}>
                <Text variant="caption" color={colors.inkMuted}>Current estimate</Text>
                <Text style={styles.currentEstimateValue}>
                  {formatLevel(level.current, medication.default_unit)} {medication.default_unit}
                </Text>
              </View>
            ) : null}

            <View
              testID={pro ? 'today-level-pro-chart' : undefined}
              accessible={pro}
              accessibilityLabel={pro
                ? `Current estimated level ${formatLevel(level.current, medication.default_unit)} ${medication.default_unit}. Seven-day trend.`
                : undefined}
              style={styles.chartFrame}
            >
              <View
                accessible={false}
                aria-hidden={!pro}
                accessibilityElementsHidden={!pro}
                importantForAccessibility={pro ? 'auto' : 'no-hide-descendants'}
              >
                <LineChart
                  data={[...level.points]}
                  width={chartWidth}
                  height={176}
                  color={medicationColor(medication)}
                  fillColor={`${medicationColor(medication)}18`}
                  xLabel={(timestamp) => format(timestamp, 'EEE')}
                  xTickCount={7}
                  yLabel={(value) => formatLevel(value, medication.default_unit)}
                  yTickCount={3}
                />
              </View>

              {!pro ? (
                <>
                  <BlurView
                    pointerEvents="none"
                    tint="extraLight"
                    intensity={55}
                    style={styles.chartBlur}
                  />
                  <Pressable
                    testID="today-level-free-lock"
                    accessibilityRole="button"
                    accessibilityLabel="Unlock estimated levels with Poke Pro"
                    onPress={() => router.push('/paywall')}
                    style={({ pressed }) => [styles.proAction, pressed && styles.proActionPressed]}
                  >
                    <Lock size={18} color={colors.successDeep} />
                    <View style={styles.proActionCopy}>
                      <Text variant="bodyStrong" align="center">Unlock with Poke Pro</Text>
                      <Text variant="caption" color={colors.inkMuted} align="center">
                        Unlock exact estimates and the 7-day trend.
                      </Text>
                    </View>
                  </Pressable>
                </>
              ) : null}
            </View>
          </>
        )}

        {level.kind === 'ready' ? (
          <Text variant="caption" color={colors.inkMuted}>
            Estimate only. Do not use it to make dosing decisions.
          </Text>
        ) : null}
      </Card>
    </View>
  );
}

function EmptyMedication({ pro }: { pro: boolean }) {
  return (
    <Card style={styles.emptyCard}>
      <Text variant="h2">Add your medication.</Text>
      <Text color={colors.inkMuted}>
        {pro
          ? 'Poke will show your next shot and estimated level here.'
          : 'Poke will show your next shot here.'}
      </Text>
      <Button onPress={() => router.push('/medications/new')}>Add medication</Button>
    </Card>
  );
}

function TodayLoading() {
  return (
    <Card style={styles.loadingCard}>
      <ActivityIndicator color={colors.accent} />
      <Text variant="small" color={colors.inkMuted}>Loading today…</Text>
    </Card>
  );
}

function TodayLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <Card style={styles.emptyCard}>
      <Text variant="h2">Today did not load.</Text>
      <Text color={colors.inkMuted}>Your saved data is still on this device.</Text>
      <Button onPress={onRetry}>Try again</Button>
    </Card>
  );
}

function TrackTodayCard({
  weight,
  weightSeries,
  weightUnit,
  sideEffect,
}: {
  weight: MeasurementRow | null;
  weightSeries: readonly number[];
  weightUnit: WeightUnit;
  sideEffect: SideEffectLog | null;
}) {
  const weightValue = weight
    ? `${convertWeight(weight.value, weight.unit, weightUnit).toFixed(1)} ${weightUnit}`
    : 'No weight logged';
  const sideEffectValue = sideEffect
    ? `${sideEffectLabel(sideEffect.effect)} · ${sideEffect.severity}/10`
    : 'None logged';

  return (
    <View style={[styles.trackCard, elevation.card]}>
      <Text variant="h2" style={styles.trackTitle}>Track today</Text>
      <Pressable
        testID="today-weight-row"
        accessibilityRole="button"
        accessibilityLabel={`Log weight. ${weightValue}`}
        onPress={() => router.push('/log-weight')}
        style={({ pressed }) => [styles.trackRow, pressed && styles.trackRowPressed]}
      >
        <View style={[styles.trackIcon, styles.weightIcon]}>
          <Scale size={19} color={colors.amber} />
        </View>
        <View style={styles.trackCopy}>
          <Text variant="smallStrong">Weight</Text>
          <Text variant="small" color={colors.inkMuted}>{weightValue}</Text>
        </View>
        {weightSeries.length >= 2 ? (
          <View
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.weightTrend}
          >
            <Sparkline data={[...weightSeries]} width={58} height={28} color={colors.amber} />
          </View>
        ) : null}
        <ChevronRight size={18} color={colors.inkMuted} />
      </Pressable>

      <View style={styles.trackDivider} />

      <Pressable
        testID="today-side-effect-row"
        accessibilityRole="button"
        accessibilityLabel={`Log side effect. ${sideEffectValue}`}
        onPress={() => router.push('/log-side-effect')}
        style={({ pressed }) => [styles.trackRow, pressed && styles.trackRowPressed]}
      >
        <View style={[styles.trackIcon, styles.sideEffectIcon]}>
          <Smile size={20} color={colors.violet} />
        </View>
        <View style={styles.trackCopy}>
          <Text variant="smallStrong">Side effects</Text>
          <Text variant="small" color={colors.inkMuted} numberOfLines={1}>
            {sideEffectValue}
          </Text>
        </View>
        <ChevronRight size={18} color={colors.inkMuted} />
      </Pressable>
    </View>
  );
}

function dosePresentation(dose: DoseState): { status: string; timing: string; color: string } {
  switch (dose.kind) {
    case 'due':
      return {
        status: 'Due today',
        timing: `Scheduled for ${fmtTime(dose.scheduledAt).toLocaleLowerCase()}`,
        color: colors.successDeep,
      };
    case 'upcoming':
      return {
        status: format(dose.scheduledAt, 'EEEE, MMMM d'),
        timing: `${countdownLabel(dose.scheduledAt)} · ${fmtTime(dose.scheduledAt).toLocaleLowerCase()}`,
        color: colors.ink,
      };
    case 'loggedToday':
      if (dose.nextScheduledAt) {
        return {
          status: format(dose.nextScheduledAt, 'EEEE, MMMM d'),
          timing: `${countdownLabel(dose.nextScheduledAt)} · ${fmtTime(dose.nextScheduledAt).toLocaleLowerCase()}`,
          color: colors.ink,
        };
      }
      return {
        status: 'No next shot',
        timing: 'No next shot is scheduled.',
        color: colors.ink,
      };
    case 'unscheduled':
      return {
        status: 'No schedule',
        timing: 'Manual logging is available.',
        color: colors.ink,
      };
    default: {
      const exhaustive: never = dose;
      return exhaustive;
    }
  }
}

function railDoseLabel(dose: DoseState): {
  shortLabel: string;
  accessibilityLabel: string;
  emphasis: boolean;
} {
  switch (dose.kind) {
    case 'due':
      return { shortLabel: 'Due', accessibilityLabel: 'due today', emphasis: true };
    case 'upcoming':
      return {
        shortLabel: format(dose.scheduledAt, 'EEE'),
        accessibilityLabel: `next shot ${format(dose.scheduledAt, 'EEEE, MMMM d')}`,
        emphasis: false,
      };
    case 'loggedToday':
      return { shortLabel: 'Done', accessibilityLabel: 'shot logged today', emphasis: true };
    case 'unscheduled':
      return { shortLabel: 'Manual', accessibilityLabel: 'no schedule', emphasis: false };
    default: {
      const exhaustive: never = dose;
      return exhaustive;
    }
  }
}

function cadenceForDose(medication: MedicationRow, dose: DoseState): string | null {
  switch (dose.kind) {
    case 'due':
    case 'upcoming':
      return cadenceLabel(medication, dose.scheduledAt);
    case 'loggedToday':
      return cadenceLabel(medication, dose.nextScheduledAt ?? dose.injection.taken_at);
    case 'unscheduled':
      return null;
    default: {
      const exhaustive: never = dose;
      return exhaustive;
    }
  }
}

function cadenceLabel(medication: MedicationRow, scheduledAt: number): string | null {
  switch (medication.frequency_kind) {
    case 'weekly':
      return `Every ${format(scheduledAt, 'EEEE')}`;
    case 'twice_weekly':
      return 'Twice a week';
    case 'daily':
      return 'Every day';
    case 'every_n_days':
      return medication.frequency_value !== null && medication.frequency_value > 1
        ? `Every ${medication.frequency_value} days`
        : 'Every day';
    case 'custom':
      return null;
    default: {
      const exhaustive: never = medication.frequency_kind;
      return exhaustive;
    }
  }
}

function countdownLabel(timestamp: number): string {
  const days = Math.round((startOfDay(timestamp) - startOfDay(Date.now())) / DAY_MS);
  if (days < -1) return `${Math.abs(days)} days overdue`;
  if (days === -1) return '1 day overdue';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

function lastShotLabel(injection: InjectionRow | null): string {
  if (!injection) return 'No shots logged yet.';
  const day = isSameDay(injection.taken_at, Date.now())
    ? 'Today'
    : format(injection.taken_at, 'EEEE, MMMM d');
  return `Last shot · ${day} at ${fmtTime(injection.taken_at).toLocaleLowerCase()}`;
}

function formatLevel(value: number, unit: MedicationRow['default_unit']): string {
  if (unit === 'mg') return value.toFixed(value < 1 ? 2 : 1);
  if (unit === 'mcg') return String(Math.round(value));
  return value.toFixed(value < 1 ? 2 : 1);
}

function convertWeight(value: number, fromUnit: string | null, toUnit: WeightUnit): number {
  if (fromUnit === 'kg' && toUnit === 'lb') return kgToLb(value);
  if (fromUnit === 'lb' && toUnit === 'kg') return lbToKg(value);
  return value;
}

function medicationColor(medication: MedicationRow): string {
  return colors.med[medication.color_index % colors.med.length] ?? colors.accent;
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  railContent: {
    gap: RAIL_GAP,
    paddingRight: spacing.xxl,
  },
  railItem: {
    width: RAIL_ITEM_WIDTH,
    minHeight: 94,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  railItemSelected: {
    borderColor: colors.successDeep,
    backgroundColor: colors.accentSoft,
  },
  railLabel: {
    width: '100%',
  },
  railStatus: {
    width: '100%',
    textAlign: 'center',
  },
  selectedCardShadow: {
    borderRadius: radius.xl,
    ...elevation.card,
  },
  selectedCardClip: {
    overflow: 'hidden',
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
  },
  selectedCardBody: {
    gap: spacing.md,
    padding: spacing.xl,
  },
  selectedMedicationHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  selectedMedicationCopy: {
    flex: 1,
  },
  medicationColorMark: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    marginTop: 7,
  },
  nextShotBlock: {
    gap: 2,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  nextShotValue: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '600',
  },
  doseBand: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  dueBand: {
    backgroundColor: colors.successDeep,
  },
  doseBandPressed: {
    backgroundColor: colors.successDeep,
    opacity: 0.9,
  },
  loggedBand: {
    justifyContent: 'flex-start',
    backgroundColor: colors.accentSoft,
  },
  manualBand: {
    backgroundColor: colors.surfaceMuted,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  loggedIcon: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  levelCard: {
    gap: spacing.lg,
  },
  levelHeader: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  levelTitleCopy: {
    flex: 1,
    gap: 2,
  },
  detailsAction: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingLeft: spacing.md,
  },
  currentEstimate: {
    gap: 2,
  },
  currentEstimateValue: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '600',
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  chartFrame: {
    position: 'relative',
    height: 176,
    overflow: 'hidden',
    borderRadius: radius.md,
  },
  chartBlur: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  proAction: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    top: 44,
    minHeight: 86,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.86)',
    ...elevation.raised,
  },
  proActionPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.99 }],
  },
  proActionCopy: {
    gap: 2,
  },
  emptyCard: {
    gap: spacing.lg,
  },
  loadingCard: {
    minHeight: 132,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  trackCard: {
    overflow: 'hidden',
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
  },
  trackTitle: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  trackRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  trackRowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  trackIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  weightIcon: {
    backgroundColor: colors.warningSoft,
  },
  sideEffectIcon: {
    backgroundColor: 'rgba(139,123,216,0.12)',
  },
  trackCopy: {
    flex: 1,
    gap: 2,
  },
  weightTrend: {
    width: 58,
  },
  trackDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing.xl + 38 + spacing.md,
    backgroundColor: colors.divider,
  },
  pressed: {
    opacity: 0.72,
  },
});
