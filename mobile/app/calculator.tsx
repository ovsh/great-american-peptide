import { useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable, TextInput, useWindowDimensions } from 'react-native';
import { X, AlertTriangle } from 'lucide-react-native';

import { Header } from '@/components/Header';
import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { Eyebrow } from '@/components/Eyebrow';
import { Field } from '@/components/Field';
import { TimeRangeToggle } from '@/components/TimeRangeToggle';
import { SyringeViz } from '@/components/SyringeViz';

import { reconstitution, formatUnits } from '@/domain/reconstitution';
import { safeBack } from '@/utils/nav';
import { colors, spacing } from '@/theme';

export default function CalculatorScreen() {
  const { width } = useWindowDimensions();

  const [peptideMg, setPeptideMg] = useState('5');
  const [waterMl, setWaterMl] = useState('2');
  const [doseMcg, setDoseMcg] = useState('250');
  const [syringe, setSyringe] = useState<100 | 40>(100);

  const result = useMemo(
    () => reconstitution({
      peptideAmountMg: parseFloat(peptideMg) || 0,
      waterMl: parseFloat(waterMl) || 0,
      desiredDoseMcg: parseFloat(doseMcg) || 0,
      syringeUnits: syringe,
    }),
    [peptideMg, waterMl, doseMcg, syringe],
  );

  const vizWidth = Math.min(width - spacing.screen * 2 - spacing.lg * 2, 380);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header
        title="Reconstitution"
        leading={
          <Pressable onPress={() => safeBack('/profile')} hitSlop={10} style={styles.iconBtn}>
            <X size={22} color={colors.ink} />
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={{ paddingBottom: spacing.hero }}>
        <View style={{ paddingHorizontal: spacing.screen }}>
          <View style={styles.titleRow}>
            <Text variant="hero">Calc</Text>
            <Text variant="caption" color={colors.inkMuted}>RECONSTITUTION</Text>
          </View>
          <Text variant="small" color={colors.inkMuted} style={{ marginTop: spacing.xs }}>
            BAC water to add and units to draw on a U-100 or U-40 insulin syringe.
          </Text>
        </View>

        <View style={{ height: spacing.lg }} />

        <View style={{ paddingHorizontal: spacing.screen }}>
          <Card padding="lg">
            <Field label="Peptide in vial">
              <View style={styles.inputRow}>
                <TextInput
                  value={peptideMg}
                  onChangeText={setPeptideMg}
                  keyboardType="decimal-pad"
                  placeholder="5"
                  placeholderTextColor={colors.inkSubtle}
                  style={styles.numInput}
                />
                <Text variant="bodyStrong" color={colors.inkMuted}>mg</Text>
              </View>
            </Field>

            <Field label="BAC water added">
              <View style={styles.inputRow}>
                <TextInput
                  value={waterMl}
                  onChangeText={setWaterMl}
                  keyboardType="decimal-pad"
                  placeholder="2"
                  placeholderTextColor={colors.inkSubtle}
                  style={styles.numInput}
                />
                <Text variant="bodyStrong" color={colors.inkMuted}>mL</Text>
              </View>
            </Field>

            <Field label="Desired dose per shot">
              <View style={styles.inputRow}>
                <TextInput
                  value={doseMcg}
                  onChangeText={setDoseMcg}
                  keyboardType="decimal-pad"
                  placeholder="250"
                  placeholderTextColor={colors.inkSubtle}
                  style={styles.numInput}
                />
                <Text variant="bodyStrong" color={colors.inkMuted}>mcg</Text>
              </View>
            </Field>

            <Field label="Syringe" divider={false}>
              <TimeRangeToggle
                options={['100', '40'] as const}
                value={String(syringe) as '100' | '40'}
                onChange={(v) => setSyringe(parseInt(v, 10) as 100 | 40)}
              />
              <Text variant="caption" color={colors.inkSubtle} style={{ marginTop: 4 }}>
                U-100 is the standard insulin syringe (1 mL = 100 units). U-40 is older / vet supplies.
              </Text>
            </Field>
          </Card>

          <View style={{ height: spacing.lg }} />

          {result.valid ? (
            <Card padding="lg" variant="muted">
              <Eyebrow tone="accent">Draw to</Eyebrow>
              <View style={styles.resultRow}>
                <Text variant="display" color={colors.red}>{formatUnits(result.syringeMarkUnits)}</Text>
                <Text variant="h3" color={colors.inkMuted}>units</Text>
              </View>
              <View style={{ alignItems: 'center', marginTop: spacing.md }}>
                <SyringeViz
                  units={result.syringeMarkUnits}
                  capacity={syringe}
                  width={vizWidth}
                  height={88}
                />
              </View>

              <View style={styles.summaryGrid}>
                <SummaryItem
                  label="CONCENTRATION"
                  value={`${result.concentrationMcgPerMl.toFixed(0)} mcg/mL`}
                />
                <SummaryItem
                  label="VOLUME / DOSE"
                  value={`${result.volumePerDoseMl.toFixed(3)} mL`}
                />
              </View>

              {result.warnings.length > 0 && (
                <View style={styles.warnings}>
                  {result.warnings.map((w, i) => (
                    <View key={i} style={styles.warnRow}>
                      <AlertTriangle size={14} color={colors.warning} />
                      <Text variant="small" color={colors.ink} style={{ flex: 1 }}>{w}</Text>
                    </View>
                  ))}
                </View>
              )}
            </Card>
          ) : (
            <Card padding="lg" variant="muted">
              <Text variant="small" color={colors.inkMuted}>
                Fill in peptide, water, and dose to compute.
              </Text>
            </Card>
          )}
        </View>

        <View style={{ paddingHorizontal: spacing.screen, paddingTop: spacing.xl }}>
          <Eyebrow>How To Use</Eyebrow>
          <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
            <Step n={1} text="Inject the bacteriostatic water slowly down the side of the vial." />
            <Step n={2} text="Swirl gently — never shake. Let it sit a minute until clear." />
            <Step n={3} text={`Draw to the ${formatUnits(result.syringeMarkUnits)} mark on a U-${syringe} syringe.`} />
            <Step n={4} text="Wipe the rubber stopper with alcohol between draws. Refrigerate the vial." />
          </View>
        </View>

        <View style={{ paddingHorizontal: spacing.screen, paddingTop: spacing.xl }}>
          <Text variant="caption" color={colors.inkSubtle}>
            For information only. Not medical advice. Confirm with a clinician before use.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Eyebrow>{label}</Eyebrow>
      <Text variant="bodyStrong">{value}</Text>
    </View>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepNum}>
        <Text variant="caption" color={colors.inkInverse}>{n}</Text>
      </View>
      <Text variant="small" color={colors.ink} style={{ flex: 1 }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  numInput: {
    flex: 1,
    fontFamily: 'Inter_500Medium',
    fontSize: 24,
    color: colors.ink,
    paddingVertical: spacing.xs,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  warnings: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    gap: spacing.xs,
  },
  warnRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.surfaceInverse,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
});
