import { useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable, Alert, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, X } from 'lucide-react-native';

import { Header } from '@/components/Header';
import { Section } from '@/components/Section';
import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Input } from '@/components/Input';
import { TimeRangeToggle } from '@/components/TimeRangeToggle';
import { Pill } from '@/components/Pill';
import { MedVialIcon } from '@/components/MedVialIcon';

import { peptidePresets, type PeptidePreset, type FrequencyKind, type Route, type Unit } from '@/domain/peptides';
import { createMedication, nextColorIndex } from '@/repositories/medications';
import { useAppStore } from '@/stores/app';
import { safeBack } from '@/utils/nav';
import { colors, spacing, radius } from '@/theme';

const FREQS: { id: FrequencyKind; label: string }[] = [
  { id: 'daily', label: 'Daily' },
  { id: 'twice_weekly', label: '2× / week' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'every_n_days', label: 'Every N days' },
];

export default function AddMedicationScreen() {
  const insets = useSafeAreaInsets();
  const bumpVersion = useAppStore((s) => s.bumpVersion);

  const [step, setStep] = useState<'pick' | 'config'>('pick');
  const [presetId, setPresetId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [unit, setUnit] = useState<Unit>('mg');
  const [route, setRoute] = useState<Route>('sc');
  const [freq, setFreq] = useState<FrequencyKind>('weekly');
  const [freqValue, setFreqValue] = useState('');
  const [halfLife, setHalfLife] = useState('');
  const [tmax, setTmax] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const pickPreset = (p: PeptidePreset) => {
    setPresetId(p.id);
    setName(p.name);
    setDose(String(p.defaultDose));
    setUnit(p.unit);
    setRoute(p.defaultRoute);
    setFreq(p.defaultFrequency.kind);
    setFreqValue(p.defaultFrequency.value ? String(p.defaultFrequency.value) : '');
    setHalfLife(String(p.halfLifeHours));
    setTmax(String(p.tmaxHours));
    setStep('config');
  };

  const pickCustom = () => {
    setPresetId(null);
    setName('');
    setDose('');
    setUnit('mg');
    setRoute('sc');
    setFreq('weekly');
    setFreqValue('');
    setHalfLife('');
    setTmax('');
    setStep('config');
  };

  const onSave = async () => {
    if (!name.trim()) { Alert.alert('Name is required'); return; }
    const d = parseFloat(dose);
    if (!Number.isFinite(d) || d <= 0) { Alert.alert('Enter a valid dose'); return; }
    setSubmitting(true);
    try {
      const colorIndex = await nextColorIndex();
      await createMedication({
        name: name.trim(),
        presetId,
        defaultDose: d,
        defaultUnit: unit,
        defaultRoute: route,
        frequencyKind: freq,
        frequencyValue: freq === 'every_n_days' ? parseInt(freqValue, 10) || 1 : null,
        halfLifeHours: halfLife ? parseFloat(halfLife) : null,
        tmaxHours: tmax ? parseFloat(tmax) : null,
        colorIndex,
      });
      bumpVersion();
      safeBack('/medications');
    } catch (err: any) {
      Alert.alert('Could not save', String(err?.message ?? err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <Header
        title={step === 'pick' ? 'Add Medication' : 'Configure'}
        leading={
          <Pressable
            onPress={() => {
              if (step === 'config') setStep('pick');
              else safeBack('/medications');
            }}
            hitSlop={10}
            style={styles.iconBtn}
          >
            <X size={22} color={colors.ink} />
          </Pressable>
        }
        trailing={step === 'config' ? (
          <Pressable onPress={onSave} hitSlop={10} disabled={submitting}>
            <Check size={22} color={colors.red} />
          </Pressable>
        ) : null}
      />

      {step === 'pick' ? (
        <ScrollView contentContainerStyle={{ paddingBottom: spacing.hero }}>
          <Section eyebrow="Preset Library" gap="sm">
            {peptidePresets.map((p, idx) => (
              <Pressable key={p.id} onPress={() => pickPreset(p)}>
                <Card padding="md" style={styles.presetCard}>
                  <MedVialIcon size={36} colorIndex={idx} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="bodyStrong">{p.name}</Text>
                    <Text variant="caption" color={colors.inkMuted}>
                      {p.defaultDose} {p.unit} · {p.defaultRoute.toUpperCase()} · t½ {p.halfLifeHours}h
                    </Text>
                  </View>
                  <Pill tone="neutral">{p.category}</Pill>
                </Card>
              </Pressable>
            ))}
          </Section>

          <View style={{ height: spacing.xl }} />

          <Section eyebrow="Custom">
            <Pressable onPress={pickCustom}>
              <Card padding="md">
                <Text variant="bodyStrong">Add custom peptide</Text>
                <Text variant="small" color={colors.inkMuted} style={{ marginTop: 2 }}>
                  Set name, dose, route, and schedule yourself.
                </Text>
              </Card>
            </Pressable>
          </Section>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: spacing.hero, paddingHorizontal: spacing.screen }}>
          <Field label="Name">
            <Input value={name} onChangeText={setName} placeholder="e.g. Tirzepatide" size="lg" />
          </Field>

          <Field label="Default dose">
            <View style={styles.doseRow}>
              <TextInput
                value={dose}
                onChangeText={setDose}
                keyboardType="decimal-pad"
                placeholder="0.0"
                placeholderTextColor={colors.inkSubtle}
                style={styles.doseInput}
              />
              <View style={{ width: spacing.md }} />
              <TimeRangeToggle
                options={['mg', 'mcg', 'iu'] as const}
                value={unit}
                onChange={(v) => setUnit(v as Unit)}
              />
            </View>
          </Field>

          <Field label="Route">
            <TimeRangeToggle
              options={['sc', 'im'] as const}
              value={route}
              onChange={(v) => setRoute(v as Route)}
            />
          </Field>

          <Field label="Frequency">
            <View style={styles.freqRow}>
              {FREQS.map((f) => {
                const active = f.id === freq;
                return (
                  <Pressable key={f.id} onPress={() => setFreq(f.id)} style={[styles.freqChip, active && styles.freqChipActive]}>
                    <Text variant="caption" color={active ? colors.inkInverse : colors.ink}>{f.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {freq === 'every_n_days' && (
              <View style={{ marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Text variant="small" color={colors.inkMuted}>Every</Text>
                <TextInput
                  value={freqValue}
                  onChangeText={setFreqValue}
                  keyboardType="number-pad"
                  placeholder="3"
                  placeholderTextColor={colors.inkSubtle}
                  style={styles.smallInput}
                />
                <Text variant="small" color={colors.inkMuted}>days</Text>
              </View>
            )}
          </Field>

          <Field label="Half-life (hours, optional)">
            <TextInput
              value={halfLife}
              onChangeText={setHalfLife}
              keyboardType="decimal-pad"
              placeholder="48"
              placeholderTextColor={colors.inkSubtle}
              style={styles.doseInput}
            />
            <Text variant="caption" color={colors.inkSubtle} style={{ marginTop: 4 }}>
              Drives the elimination tail of the level chart.
            </Text>
          </Field>

          <Field label="Time to peak (Tmax hours, optional)" divider={false}>
            <TextInput
              value={tmax}
              onChangeText={setTmax}
              keyboardType="decimal-pad"
              placeholder="1"
              placeholderTextColor={colors.inkSubtle}
              style={styles.doseInput}
            />
            <Text variant="caption" color={colors.inkSubtle} style={{ marginTop: 4 }}>
              How long after the shot the level peaks. SC peptides usually 0.5–2 h; weekly GLP-1s 24–48 h.
            </Text>
          </Field>

          <View style={{ height: spacing.xl }} />
          <Button onPress={onSave} disabled={submitting} trailingChevron>
            {submitting ? 'Saving…' : 'Save'}
          </Button>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  presetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  doseRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  doseInput: {
    flex: 1,
    fontFamily: 'Inter_500Medium',
    fontSize: 18,
    color: colors.ink,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  smallInput: {
    width: 60,
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    color: colors.ink,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
    textAlign: 'center',
  },
  freqRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  freqChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  freqChipActive: {
    backgroundColor: colors.surfaceInverse,
    borderColor: colors.surfaceInverse,
  },
});
