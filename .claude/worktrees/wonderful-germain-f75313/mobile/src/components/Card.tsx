import { ReactNode } from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import { colors, radius, spacing, elevation } from '../theme';

interface CardProps {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
  padding?: keyof typeof spacing;
  variant?: 'default' | 'muted' | 'inverse';
  raised?: boolean;
}

export function Card({ children, style, padding = 'lg', variant = 'default', raised = false }: CardProps) {
  const bg =
    variant === 'inverse' ? colors.surfaceInverse :
    variant === 'muted' ? colors.surfaceMuted :
    colors.surface;
  return (
    <View
      style={[
        styles.card,
        raised && elevation.card,
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
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
