import { useEffect, useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Header } from '@/components/Header';
import { TitleBlock } from '@/components/TitleBlock';
import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { Eyebrow } from '@/components/Eyebrow';
import { LineChart } from '@/components/LineChart';
import { TimeRangeToggle } from '@/components/TimeRangeToggle';

import { listMeasurements } from '@/repositories/measurements';
import { getPreferences } from '@/repositories/preferences';
import type { MeasurementRow, PreferencesRow } from '@/db/types';
import { kgToLb, lbToKg } from '@/domain/units';
import { useAppStore } from '@/stores/app';
import { colors, spacing } from '@/theme';

const RANGES = ['30D', '90D', '1Y', 'All'] as const;
type Range = typeof RANGES[number];
const DAY = 24 * 60 * 60 * 1000;

function rangeMs(r: Range): number | null {
  if (r === '30D') return 30 * DAY;
  if (r === '90D') return 90 * DAY;
  if (r === '1Y') return 365 * DAY;
  return null;
}

export default function ProgressReportScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const dataVersion = useAppStore((s) => s.dataVersion);
  const [range, setRange] = useState<Range>('90D');
  const [weights, setWeights] = useState<MeasurementRow[]>([]);
  const [prefs, setPrefs] = useState<PreferencesRow | null>(null);

  useEffect(() => {
    (async () => {
      const [w, p] = await Promise.all([
        listMeasurements('weight', { limit: 365 }),
        getPreferences(),
      ]);
      setWeights(w.slice().reverse());
      setPrefs(p);
    })();
  }, [dataVersion]);

  const wUnit = prefs?.weight_unit ?? 'lb';
  const data = useMemo(() => {
    const since = rangeMs(range);
    const filtered = since ? weights.filter((w) => w.taken_at >= Date.now() - since) : weights;
    return filtered.map((m) => ({
      t: m.taken_at,
      v: m.unit === 'kg' && wUnit === 'lb' ? kgToLb(m.value)
       : m.unit === 'lb' && wUnit === 'kg' ? lbToKg(m.value)
       : m.value,
    }));
  }, [weights, range, wUnit]);

  const first = data[0];
  const last = data[data.length - 1];
  const delta = first && last ? last.v - first.v : 0;
  const goalWeight = prefs?.goal_weight ?? null;
  const remainingToGoal = last && goalWeight != null ? last.v - goalWeight : null;

  const chartW = width - spacing.screen * 2 - spacing.lg * 2;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <Header title="Progress" showBack />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.hero }}>
        <TitleBlock title="Progress" rightLabel="WEIGHT" />

        <View style={{ paddingHorizontal: spacing.screen }}>
          <View style={{ marginBottom: spacing.md }}>
            <TimeRangeToggle options={RANGES} value={range} onChange={setRange} size="sm" />
          </View>

          <View style={styles.summaryRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <Eyebrow>CURRENT</Eyebrow>
              <Text variant="hero">{last ? last.v.toFixed(1) : '—'}</Text>
              <Text variant="caption" color={colors.inkMuted}>{wUnit}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Eyebrow>CHANGE</Eyebrow>
              <Text variant="hero" color={delta < 0 ? colors.successDeep : delta > 0 ? colors.redDeep : colors.ink}>
                {delta >= 0 ? '+' : ''}{delta.toFixed(1)}
              </Text>
              <Text variant="caption" color={colors.inkMuted}>over window</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Eyebrow>GOAL</Eyebrow>
              <Text variant="hero">{goalWeight != null ? goalWeight.toFixed(1) : '—'}</Text>
              <Text variant="caption" color={colors.inkMuted}>
                {remainingToGoal != null ? `${Math.abs(remainingToGoal).toFixed(1)} ${remainingToGoal >= 0 ? 'left' : 'past'}` : wUnit}
              </Text>
            </View>
          </View>

          <View style={{ height: spacing.lg }} />

          <Card padding="md">
            {data.length >= 2 ? (
              <LineChart
                data={data}
                width={chartW}
                height={200}
                yLabel={(v) => v.toFixed(0)}
                xLabel={(t) => {
                  const d = new Date(t);
                  return `${d.getMonth() + 1}/${d.getDate()}`;
                }}
              />
            ) : (
              <Text variant="small" color={colors.inkMuted}>Log at least two weights to see the chart.</Text>
            )}
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
});
