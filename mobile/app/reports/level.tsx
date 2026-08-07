import { useEffect, useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet, useWindowDimensions, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';

import { Header } from '@/components/Header';
import { Section } from '@/components/Section';
import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { Pill } from '@/components/Pill';
import { LineChart } from '@/components/LineChart';
import { TimeRangeToggle } from '@/components/TimeRangeToggle';

import { ProLock } from '@/components/ProLock';

import { listMedications } from '@/repositories/medications';
import { listInjections } from '@/repositories/injections';
import type { MedicationRow } from '@/db/types';
import { levelTrajectory, peakTroughAvg, trendLabel, tmaxOrDefault } from '@/domain/pk';
import { formatDose } from '@/domain/units';
import { fmtTime } from '@/utils/date';
import { useAppStore } from '@/stores/app';
import { useIsPro } from '@/stores/entitlement';
import { colors, spacing } from '@/theme';

const RANGES = ['7d', '14d', '30d'] as const;
type Range = typeof RANGES[number];
const DAY = 24 * 60 * 60 * 1000;

function rangeMs(r: Range): number {
  if (r === '7d') return 7 * DAY;
  if (r === '14d') return 14 * DAY;
  return 30 * DAY;
}

export default function LevelReportScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ medicationId?: string }>();
  const dataVersion = useAppStore((s) => s.dataVersion);
  const pro = useIsPro();
  const [meds, setMeds] = useState<MedicationRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [range, setRange] = useState<Range>('14d');
  const [doses, setDoses] = useState<{ takenAt: number; dose: number }[]>([]);

  useEffect(() => {
    (async () => {
      const all = await listMedications();
      const withHalfLife = all.filter((m) => m.status === 'active' && m.half_life_hours);
      setMeds(withHalfLife);
      if (withHalfLife.length > 0) {
        setSelected((cur) => {
          const requested = params.medicationId && withHalfLife.find((m) => m.id === params.medicationId);
          if (requested) return requested.id;
          return cur && withHalfLife.find((m) => m.id === cur) ? cur : withHalfLife[0].id;
        });
      }
    })();
  }, [dataVersion, params.medicationId]);

  useEffect(() => {
    if (!selected) return;
    (async () => {
      const list = await listInjections({ medicationId: selected, fromMs: Date.now() - 60 * DAY });
      setDoses(list.map((i) => ({ takenAt: i.taken_at, dose: i.dose })));
    })();
  }, [selected, dataVersion]);

  const med = meds.find((m) => m.id === selected) ?? null;

  const tmax = med?.half_life_hours
    ? tmaxOrDefault(med.half_life_hours, med.tmax_hours)
    : 0;
  // Extend forward to show the elimination tail of what's already been logged.
  // No future doses are projected — peaks reflect only actual injections.
  const forecastEndMs = med?.half_life_hours
    ? Date.now() + Math.max(2 * DAY, med.half_life_hours * 60 * 60 * 1000 * 2)
    : Date.now();

  const trajectory = useMemo(() => {
    if (!med?.half_life_hours) return [];
    const from = Date.now() - rangeMs(range);
    return levelTrajectory(doses, med.half_life_hours, tmax, from, forecastEndMs, 100);
  }, [doses, med, tmax, range, forecastEndMs]);

  const data = trajectory.filter((p) => p.t <= Date.now()).map((p) => ({ t: p.t, v: p.level }));
  const proj = trajectory.filter((p) => p.t >= Date.now()).map((p) => ({ t: p.t, v: p.level }));
  const stats = peakTroughAvg(trajectory);
  const trend = med?.half_life_hours ? trendLabel(doses, med.half_life_hours, tmax, Date.now()) : 'steady';

  const chartW = Math.min(width, 600) - spacing.screen * 2;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <Header title="Medication level" showBack />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.hero }}>
        {!pro ? (
          <View style={{ paddingHorizontal: spacing.screen }}>
            <ProLock
              title="Your level, day by day"
              body="See the estimated amount in your body between shots — peak, trough and average across the window."
            />
          </View>
        ) : meds.length === 0 ? (
          <View style={{ paddingHorizontal: spacing.screen }}>
            <Card padding="lg">
              <Text variant="h3">No active medications with a half-life set.</Text>
              <Text variant="small" color={colors.inkMuted} style={{ marginTop: 4 }}>
                Add half-life when configuring a medication to see the estimated-level chart.
              </Text>
            </Card>
          </View>
        ) : (
          <>
            <Section gap="sm">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {meds.map((m) => {
                  const active = m.id === selected;
                  return (
                    <Pressable key={m.id} onPress={() => setSelected(m.id)} style={[styles.chip, active && styles.chipActive]}>
                      <Text variant="smallStrong" color={active ? colors.inkInverse : colors.ink}>{m.name}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </Section>

            <View style={{ paddingHorizontal: spacing.screen, paddingTop: spacing.md }}>
              <View style={styles.headRow}>
                <View>
                  <Text variant="smallStrong" color={colors.inkMuted}>{med?.name}</Text>
                  <Text variant="hero" style={{ marginTop: 4 }}>
                    {med ? formatDose(stats.peak.level, med.default_unit) : '—'}
                  </Text>
                  <Text variant="caption" color={colors.inkMuted}>peak this window</Text>
                </View>
                <Pill tone={trend === 'rising' ? 'success' : trend === 'falling' ? 'warning' : 'neutral'}>
                  {trend}
                </Pill>
              </View>

              <View style={{ height: spacing.md }}>
                <TimeRangeToggle options={RANGES} value={range} onChange={setRange} size="sm" />
              </View>
              <View style={{ height: spacing.md }} />

              <Card padding="md">
                {data.length >= 2 ? (
                  <LineChart
                    data={data}
                    projection={proj.length >= 2 ? proj : undefined}
                    width={chartW - spacing.lg * 2}
                    height={200}
                    yLabel={(v) => v < 1 ? v.toFixed(2) : v.toFixed(1)}
                    xLabel={(t) => {
                      const d = new Date(t);
                      return `${d.getMonth() + 1}/${d.getDate()}`;
                    }}
                  />
                ) : (
                  <Text variant="small" color={colors.inkMuted}>Log a few shots to see the level chart.</Text>
                )}
              </Card>

              <View style={{ height: spacing.lg }} />

              <View style={styles.statRow}>
                <Stat label="Peak" value={med ? formatDose(stats.peak.level, med.default_unit) : '—'} hint={fmtTime(stats.peak.t)} />
                <Stat label="Trough" value={med ? formatDose(stats.trough.level, med.default_unit) : '—'} hint={fmtTime(stats.trough.t)} />
                <Stat label="Average" value={med ? formatDose(stats.avg, med.default_unit) : '—'} hint="window" />
              </View>

              <View style={{ height: spacing.xl }} />

              <Text variant="caption" color={colors.inkSubtle}>
                Half-life load estimate from logged shots only. This trend is not for dosing.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text variant="smallStrong" color={colors.inkMuted}>{label}</Text>
      <Text variant="bodyStrong">{value}</Text>
      {hint ? <Text variant="caption" color={colors.inkSubtle}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: { paddingHorizontal: spacing.screen, gap: spacing.sm, paddingBottom: spacing.xs },
  chip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  headRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  statRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
});
