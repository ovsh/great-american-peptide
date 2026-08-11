import { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { Eyebrow } from './Eyebrow';
import { spacing } from '../theme';

interface SectionProps {
  eyebrow?: string;
  eyebrowTone?: 'default' | 'accent';
  trailing?: ReactNode;
  children: ReactNode;
  gap?: keyof typeof spacing;
}

export function Section({ eyebrow, eyebrowTone, trailing, children, gap = 'md' }: SectionProps) {
  return (
    <View style={[styles.wrap, { gap: spacing[gap] }]}>
      {(eyebrow || trailing) && (
        <View style={styles.head}>
          {eyebrow ? <Eyebrow tone={eyebrowTone}>{eyebrow}</Eyebrow> : <View />}
          {trailing}
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.screen,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
