import { StyleSheet, TextInput, View } from 'react-native';

import { Text } from '@/components/Text';
import { compositionDraft } from '@/domain/blends';
import type { PeptidePreset } from '@/domain/peptides';
import { colors, spacing } from '@/theme';

/**
 * The vial label of a blend, copied in: one milligram box per part. Both entry
 * screens render this, so the boxes, the order and the sentences under them
 * cannot drift between setup and Medications.
 *
 * The section is skippable as a whole and only as a whole. `compositionDraft`
 * owns that rule; this component only reads the state back as a sentence. The
 * numbers come off the user's own label, so no box ever opens with a value.
 */
export function BlendCompositionFields({
  parts,
  values,
  onChange,
}: {
  parts: readonly PeptidePreset[];
  values: Readonly<Record<string, string>>;
  onChange: (partId: string, text: string) => void;
}) {
  const draft = compositionDraft(parts.map((part) => part.id), values);
  return (
    <View style={styles.wrap}>
      {parts.map((part) => (
        <View key={part.id} style={styles.row}>
          <Text variant="small" style={styles.partName} numberOfLines={1}>{part.name}</Text>
          <TextInput
            value={values[part.id] ?? ''}
            onChangeText={(text) => onChange(part.id, text)}
            keyboardType="decimal-pad"
            placeholderTextColor={colors.inkSubtle}
            style={styles.input}
            accessibilityLabel={`Milligrams of ${part.name} in the vial`}
          />
          <Text variant="small" color={colors.inkMuted}>mg</Text>
        </View>
      ))}
      <Text variant="small" color={draft.kind === 'partial' ? colors.ink : colors.inkMuted}>
        {compositionNote(draft.kind)}
      </Text>
    </View>
  );
}

/**
 * The state under the boxes. Empty explains what the boxes are for and that
 * the whole section can wait. Partial names the one rule that blocks the save.
 * Complete reads the outcome back without repeating any number.
 */
function compositionNote(kind: 'empty' | 'partial' | 'complete'): string {
  if (kind === 'partial') return 'Enter a number for every part or leave every box empty.';
  if (kind === 'complete') return 'Poke draws the level curve as the sum of the parts.';
  return 'Copy the milligrams of each part from your vial label. Poke then draws the level curve as the sum of the parts.';
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
  },
  partName: {
    flex: 1,
  },
  input: {
    width: 72,
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    color: colors.ink,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
    textAlign: 'center',
  },
});
