import { ReactNode } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, spacing, elevation } from '../theme';

interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: keyof typeof spacing;
  variant?: 'default' | 'muted' | 'inverse';
  raised?: boolean;
}

const CARD_BACKGROUNDS = {
  default: colors.surface,
  muted: colors.surface,
  inverse: colors.surface,
} as const;

export function Card({ children, style, padding = 'xl', variant = 'default', raised = false }: CardProps) {
  const bg = CARD_BACKGROUNDS[variant];
  return (
    <View
      style={[
        styles.card,
        raised ? elevation.raised : elevation.card,
        { backgroundColor: bg, padding: spacing[padding] },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
  },
});
