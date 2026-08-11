import { useEffect, useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable, TextInput, useWindowDimensions, KeyboardAvoidingView, Platform } from 'react-native';
import { X, AlertTriangle } from 'lucide-react-native';

import { Header } from '@/components/Header';
import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { Field } from '@/components/Field';
import { SyringeViz } from '@/components/SyringeViz';

import { reconstitution, formatMcg, formatMl } from '@/domain/reconstitution';
import { maybePromptForReview } from '@/services/review';
import { safeBack } from '@/utils/nav';
import { colors, spacing } from '@/theme';

export default function CalculatorScreen() {
  const { width } = useWindowDimensions();
  // Every field starts empty and no field carries a number as a placeholder.
  // `review.notes` tells App Review that this screen "suggests nothing and it
  // fills nothing in for the user". A vial mass and a diluent volume on first
  // paint would read as Poke proposing a dilution.
  const [materialMg, setMaterialMg] = useState('');
  const [diluentMl, setDiluentMl] = useState('');
  const [aliquotMcg, setAliquotMcg] = useState('');

  const result = useMemo(
    () => reconstitution({
      materialMassMg: parseFloat(materialMg) || 0,
      diluentMl: parseFloat(diluentMl) || 0,
      aliquotAmountMcg: parseFloat(aliquotMcg) || 0,
    }),
    [materialMg, diluentMl, aliquotMcg],
  );
  // Reconstitution is why grey-market users install Poke, and it is free, so this is
  // the earliest honest ask. The timer restarts on every keystroke, so it fires only
  // when the user has stopped typing and is reading a valid answer.
  useEffect(() => {
    if (!result.valid) return;
    const timer = setTimeout(() => { maybePromptForReview('calculation').catch(() => {}); }, 4000);
    return () => clearTimeout(timer);
  }, [result]);

  const vizWidth = Math.min(width - spacing.screen * 2 - spacing.lg * 2, 380);
  const vizCapacityMl = Math.max(1, Math.ceil(result.aliquotVolumeMl ?? 1));

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Header
        title="Reconstitution"
        leading={
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => safeBack('/profile')} hitSlop={10} style={styles.iconBtn}>
            <X size={22} color={colors.ink} />
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.hero }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ paddingHorizontal: spacing.screen }}>
          <View style={styles.titleRow}>
            <Text variant="hero">Lab Calc</Text>
            <Text variant="caption" color={colors.inkMuted}>Reconstitution math</Text>
          </View>
          <Text variant="small" color={colors.inkMuted} style={{ marginTop: spacing.xs }}>
            For laboratory researchers and scientists. Poke converts a vial mass and a diluent volume into a concentration.
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
                  placeholder="Enter a number"
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
                  placeholder="Enter a number"
                  placeholderTextColor={colors.inkSubtle}
                  style={styles.numInput}
                />
                <Text variant="bodyStrong" color={colors.inkMuted}>mL</Text>
              </View>
            </Field>

            <Field label="Aliquot amount (optional)" divider={false}>
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
                Poke converts a research sample amount into a volume in mL.
              </Text>
            </Field>
          </Card>

          <View style={{ height: spacing.lg }} />

          {result.valid ? (
            <Card padding="lg" variant="muted">
              <Text variant="smallStrong" color={colors.accent}>Calculated concentration</Text>
              <View style={styles.resultRow}>
                <Text variant="display" color={colors.accent}>{formatMcg(result.concentrationMcgPerMl)}</Text>
                <Text variant="h3" color={colors.inkMuted}>mcg/mL</Text>
              </View>

              <View style={styles.summaryGrid}>
                <SummaryItem
                  label="Mg / mL"
                  value={`${result.concentrationMgPerMl.toFixed(3)} mg/mL`}
                />
                <SummaryItem
                  label="Vial total"
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
                      label="Aliquot volume"
                      value={`${formatMl(result.aliquotVolumeMl)} mL`}
                    />
                    <SummaryItem
                      label="Diluent"
                      value={`${formatMl(parseFloat(diluentMl) || 0)} mL`}
                    />
                  </View>
                </>
              )}

              <View style={styles.noteBox}>
                <Text variant="small" color={colors.inkMuted}>
                  Research calculation only. Poke does not provide administration instructions, clinical guidance, or use recommendations.
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
              <Text variant="smallStrong" color={colors.inkMuted}>No calculation yet</Text>
              <Text variant="small" color={colors.inkMuted} style={{ marginTop: spacing.xs }}>
                Enter the vial material in mg and the diluent volume in mL. Poke then shows the
                concentration. Add an aliquot amount and Poke also shows the volume in mL.
              </Text>
            </Card>
          )}
        </View>

        <View style={{ paddingHorizontal: spacing.screen, paddingTop: spacing.xl }}>
          <Card padding="md" variant="muted">
            <Text variant="smallStrong" color={colors.inkMuted}>Research use</Text>
            <Text variant="small" color={colors.inkMuted} style={{ marginTop: spacing.xs }}>
              For laboratory research and educational calculations only. Not for clinical, patient, medical, injection, or dosing use.
            </Text>
          </Card>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text variant="smallStrong" color={colors.inkMuted}>{label}</Text>
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
