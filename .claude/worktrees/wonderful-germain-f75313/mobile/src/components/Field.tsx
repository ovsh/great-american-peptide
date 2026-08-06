import { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { Eyebrow } from './Eyebrow';
import { colors, spacing } from '../theme';

interface FieldProps {
  label: string;
  trailing?: ReactNode;
  children: ReactNode;
  divider?: boolean;
}

export function Field({ label, trailing, children, divider = true }: FieldProps) {
  return (
    <View style={[styles.wrap, divider && styles.divider]}>
      <View style={styles.head}>
        <Eyebrow>{label}</Eyebrow>
        {trailing}
      </View>
      <View>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
