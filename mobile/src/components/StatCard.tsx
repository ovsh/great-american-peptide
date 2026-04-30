import { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from './Text';
import { Eyebrow } from './Eyebrow';
import { Card } from './Card';
import { colors } from '../theme';

interface StatCardProps {
  label: string;
  value: string;
  unit?: string;
  delta?: string;
  deltaTone?: 'success' | 'danger' | 'neutral';
  trailing?: ReactNode;
}

export function StatCard({ label, value, unit, delta, deltaTone = 'neutral', trailing }: StatCardProps) {
  const deltaColor =
    deltaTone === 'success' ? colors.successDeep :
    deltaTone === 'danger' ? colors.redDeep :
    colors.inkMuted;
  return (
    <Card padding="md" style={styles.card}>
      <View style={{ gap: 6, flex: 1 }}>
        <Eyebrow>{label}</Eyebrow>
        <View style={styles.valueRow}>
          <Text variant="hero" color={colors.ink}>{value}</Text>
          {unit ? <Text variant="caption" color={colors.inkMuted}>{unit}</Text> : null}
        </View>
        {delta ? <Text variant="small" color={deltaColor}>{delta}</Text> : null}
        {trailing}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, minHeight: 110 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
});
