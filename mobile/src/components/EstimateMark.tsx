import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/Text';
import type { EvidenceTier } from '@/domain/peptides';
import { colors, radius } from '@/theme';

/**
 * The one thing a preset row says about its evidence, or nothing.
 *
 * Naming the tier on every row is the boilerplate subtitle both pickers
 * deliberately dropped: "from the drug label" under nine rows out of ten is
 * noise, and the tier belongs in the estimate sheet on Today. The estimate tier
 * is the exception. It is the only tier whose number is not a published
 * measurement, and a reader who is choosing what to track has to know that
 * before the pick rather than after it.
 */
export function estimateMark(evidence: EvidenceTier): string | undefined {
  return evidence === 'estimate' ? 'Estimate' : undefined;
}

/**
 * A wash rather than a fill. `surfaceMuted` is the page behind the card, so a
 * chip painted with it disappears on a white row, and it fights the green of a
 * selected onboarding card. Ink at 6 % reads on both.
 */
const WASH = 'rgba(17,20,24,0.06)';

/** The quiet mark itself: no border, no green. Green means a dose. */
export function MarkChip({ label }: { label: string }) {
  return (
    <View style={styles.chip}>
      <Text variant="caption" color={colors.inkMuted}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 1,
    borderRadius: radius.pill,
    backgroundColor: WASH,
  },
});
