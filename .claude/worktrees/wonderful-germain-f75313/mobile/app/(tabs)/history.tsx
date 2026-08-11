import { useEffect, useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Trash2 } from 'lucide-react-native';
import { format } from 'date-fns';

import { MastHead } from '@/components/MastHead';
import { TitleBlock } from '@/components/TitleBlock';
import { Section } from '@/components/Section';
import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { TimeRangeToggle } from '@/components/TimeRangeToggle';

import { listInjections, softDeleteInjection } from '@/repositories/injections';
import { listMeasurements } from '@/repositories/measurements';
import { listMedications } from '@/repositories/medications';
import type { InjectionRow, MeasurementRow, MedicationRow } from '@/db/types';
import { fmtTime } from '@/utils/date';
import { formatDose, kgToLb, lbToKg } from '@/domain/units';
import { getBodySite } from '@/domain/bodySites';
import { useAppStore } from '@/stores/app';
import { colors, spacing } from '@/theme';

const KINDS = ['Shots', 'Weight'] as const;
type Kind = typeof KINDS[number];

interface ShotEntry {
  type: 'shot';
  ts: number;
  inj: InjectionRow;
}
interface WeightEntry {
  type: 'weight';
  ts: number;
  m: MeasurementRow;
}
type Entry = ShotEntry | WeightEntry;

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const dataVersion = useAppStore((s) => s.dataVersion);
  const bumpVersion = useAppStore((s) => s.bumpVersion);
  const [kind, setKind] = useState<Kind>('Shots');
  const [meds, setMeds] = useState<Map<string, MedicationRow>>(new Map());
  const [shots, setShots] = useState<InjectionRow[]>([]);
  const [weights, setWeights] = useState<MeasurementRow[]>([]);
  const [unit] = useState<'lb' | 'kg'>('lb');

  const load = useCallback(async () => {
    const [inj, w, ms] = await Promise.all([
      listInjections({ limit: 200 }),
      listMeasurements('weight', { limit: 200 }),
      listMedications(true),
    ]);
    setShots(inj);
    setWeights(w);
    setMeds(new Map(ms.map((m) => [m.id, m])));
  }, []);

  useEffect(() => { load(); }, [load, dataVersion]);

  const entries: Entry[] = kind === 'Shots'
    ? shots.map((i) => ({ type: 'shot', ts: i.taken_at, inj: i } as ShotEntry))
    : weights.map((m) => ({ type: 'weight', ts: m.taken_at, m } as WeightEntry));

  const grouped = entries.reduce<Record<string, Entry[]>>((acc, e) => {
    const k = format(new Date(e.ts), 'MMMM yyyy').toUpperCase();
    if (!acc[k]) acc[k] = [];
    acc[k].push(e);
    return acc;
  }, {});

  const onDelete = (e: ShotEntry) => {
    Alert.alert('Delete shot?', 'This removes it from the level chart.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await softDeleteInjection(e.inj.id);
        bumpVersion();
      } },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.hero + 80 }}>
        <MastHead />
        <TitleBlock title="History" />

        <View style={{ paddingHorizontal: spacing.screen, marginBottom: spacing.md }}>
          <TimeRangeToggle options={KINDS} value={kind} onChange={setKind} size="sm" />
        </View>

        {entries.length === 0 ? (
          <View style={{ paddingHorizontal: spacing.screen }}>
            <Card padding="lg" variant="muted">
              <Text variant="small" color={colors.inkMuted}>
                Nothing logged yet. Tap the brand seal to log a shot, or use the home screen.
              </Text>
            </Card>
          </View>
        ) : (
          Object.entries(grouped).map(([month, items]) => (
            <Section key={month} eyebrow={month} gap="sm">
              {items.map((e) => (
                e.type === 'shot' ? (
                  <ShotRow key={e.inj.id} e={e} med={meds.get(e.inj.medication_id) ?? null} onDelete={() => onDelete(e)} />
                ) : (
                  <WeightRow key={e.m.id} e={e} unit={unit} />
                )
              ))}
              <View style={{ height: spacing.md }} />
            </Section>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function ShotRow({ e, med, onDelete }: { e: ShotEntry; med: MedicationRow | null; onDelete: () => void }) {
  const accent = med ? colors.med[med.color_index % colors.med.length] : colors.ink;
  return (
    <Card padding="md" style={styles.row}>
      <View style={[styles.dot, { backgroundColor: accent }]} />
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{med?.name ?? 'Unknown'}</Text>
        <Text variant="small" color={colors.inkMuted}>
          {formatDose(e.inj.dose, e.inj.unit)} · {e.inj.route.toUpperCase()}
          {e.inj.site_id ? ` · ${getBodySite(e.inj.site_id)?.label ?? ''}` : ''}
        </Text>
        <Text variant="caption" color={colors.inkSubtle}>
          {format(new Date(e.ts), 'EEE, MMM d')} · {fmtTime(e.ts)}
        </Text>
      </View>
      <Pressable onPress={onDelete} hitSlop={10} style={styles.iconBtn}>
        <Trash2 size={16} color={colors.inkSubtle} />
      </Pressable>
    </Card>
  );
}

function WeightRow({ e, unit }: { e: WeightEntry; unit: 'lb' | 'kg' }) {
  const v = e.m.unit === 'kg' && unit === 'lb' ? kgToLb(e.m.value)
         : e.m.unit === 'lb' && unit === 'kg' ? lbToKg(e.m.value)
         : e.m.value;
  return (
    <Card padding="md" style={styles.row}>
      <View style={[styles.dot, { backgroundColor: colors.gold }]} />
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{v.toFixed(1)} {e.m.unit ?? unit}</Text>
        <Text variant="caption" color={colors.inkSubtle}>
          {format(new Date(e.ts), 'EEE, MMM d · h:mm a')}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dot: { width: 10, height: 10, borderRadius: 5 },
  iconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
});
