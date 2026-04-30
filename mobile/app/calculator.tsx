import { useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable, TextInput, useWindowDimensions } from 'react-native';
import { X, AlertTriangle } from 'lucide-react-native';

import { Header } from '@/components/Header';
import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { Eyebrow } from '@/components/Eyebrow';
import { Field } from '@/components/Field';
import { SyringeViz } from '@/components/SyringeViz';

import { reconstitution, formatMcg, formatMl } from '@/domain/reconstitution';
import { safeBack } from '@/utils/nav';
import { colors, spacing } from '@/theme';

export default function CalculatorScreen() {
  const { width } = useWindowDimensions();
  const [materialMg, setMaterialMg] = useState('5');
  const [diluentMl, setDiluentMl] = useState('2');
  const [aliquotMcg, setAliquotMcg] = useState('250');

  const result = useMemo(
    () => reconstitution({
      materialMassMg: parseFloat(materialMg) || 0,
      diluentMl: parseFloat(diluentMl) || 0,
      aliquotAmountMcg: parseFloat(aliquotMcg) || 0,
    }),
    [materialMg, diluentMl, aliquotMcg],
  );
  const vizWidth = Math.min(width - spacing.screen * 2 - spacing.lg * 2, 380);
  const vizCapacityMl = Math.max(1, Math.ceil(result.aliquotVolumeMl ?? 1));

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
            <Text variant="hero">Lab Calc</Text>
            <Text variant="caption" color={colors.inkMuted}>RECONSTITUTION MATH</Text>
          </View>
          <Text variant="small" color={colors.inkMuted} style={{ marginTop: spacing.xs }}>
            For laboratory researchers and scientists. Convert vial mass and diluent volume into concentration values.
          </Text>
        </View>

        <View style={{ height: spacing.lg }} />

        <View style={{ paddingHorizontal: spacing.screen }}>
          <Card padding="lg">
            <Field label="Vial material">
              <View style={styles.inputRow}>
                <TextInput
                  value={materialMg}
                  onChangeText={setMaterialMg}
                  keyboardType="decimal-pad"
                  placeholder="5"
                  placeholderTextColor={colors.inkSubtle}
                  style={styles.numInput}
                />
                <Text variant="bodyStrong" color={colors.inkMuted}>mg</Text>
              </View>
            </Field>

            <Field label="Diluent volume">
              <View style={styles.inputRow}>
                <TextInput
                  value={diluentMl}
                  onChangeText={setDiluentMl}
                  keyboardType="decimal-pad"
                  placeholder="2"
                  placeholderTextColor={colors.inkSubtle}
                  style={styles.numInput}
                />
                <Text variant="bodyStrong" color={colors.inkMuted}>mL</Text>
              </View>
            </Field>

            <Field label="Optional aliquot amount" divider={false}>
              <View style={styles.inputRow}>
                <TextInput
                  value={aliquotMcg}
                  onChangeText={setAliquotMcg}
                  keyboardType="decimal-pad"
                  placeholder="Optional"
                  placeholderTextColor={colors.inkSubtle}
                  style={styles.numInput}
                />
                <Text variant="bodyStrong" color={colors.inkMuted}>mcg</Text>
              </View>
              <Text variant="caption" color={colors.inkSubtle} style={{ marginTop: 4 }}>
                Optional research sample amount for mL conversion.
              </Text>
            </Field>
          </Card>

          <View style={{ height: spacing.lg }} />

          {result.valid ? (
            <Card padding="lg" variant="muted">
              <Eyebrow tone="accent">Calculated concentration</Eyebrow>
              <View style={styles.resultRow}>
                <Text variant="display" color={colors.red}>{formatMcg(result.concentrationMcgPerMl)}</Text>
                <Text variant="h3" color={colors.inkMuted}>mcg/mL</Text>
              </View>

              <View style={styles.summaryGrid}>
                <SummaryItem
                  label="MG / ML"
                  value={`${result.concentrationMgPerMl.toFixed(3)} mg/mL`}
                />
                <SummaryItem
                  label="VIAL TOTAL"
                  value={`${formatMcg(result.totalMaterialMcg)} mcg`}
                />
              </View>

              {result.aliquotVolumeMl !== null && (
                <>
                  <View style={styles.volumeViz}>
                    <SyringeViz
                      volumeMl={result.aliquotVolumeMl}
                      capacityMl={vizCapacityMl}
                      width={vizWidth}
                      height={88}
                    />
                  </View>
                  <View style={styles.summaryGrid}>
                    <SummaryItem
                      label="ALIQUOT VOLUME"
                      value={`${formatMl(result.aliquotVolumeMl)} mL`}
                    />
                    <SummaryItem
                      label="DILUENT"
                      value={`${formatMl(parseFloat(diluentMl) || 0)} mL`}
                    />
                  </View>
                </>
              )}

              <View style={styles.noteBox}>
                <Text variant="small" color={colors.inkMuted}>
                  Research calculation only. The app does not provide administration instructions, clinical guidance, or use recommendations.
                </Text>
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
                Enter vial material and diluent volume to calculate concentration.
              </Text>
            </Card>
          )}
        </View>

        <View style={{ paddingHorizontal: spacing.screen, paddingTop: spacing.xl }}>
          <Card padding="md" variant="muted">
            <Eyebrow>Research Use</Eyebrow>
            <Text variant="small" color={colors.inkMuted} style={{ marginTop: spacing.xs }}>
              For laboratory research and educational calculations only. Not for clinical, patient, medical, injection, or dosing use.
            </Text>
          </Card>
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

const styles = StyleSheet.create({
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
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
  volumeViz: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  noteBox: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
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
});
