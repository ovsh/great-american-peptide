import { ReactNode, useState } from 'react';
import { Pressable, View, StyleSheet, ViewStyle } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { Text } from './Text';
import { colors, radius, spacing } from '../theme';

interface ButtonProps {
  onPress?: () => void;
  children: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  size?: 'md' | 'sm';
  trailingChevron?: boolean;
  leadingIcon?: ReactNode;
  disabled?: boolean;
  style?: ViewStyle;
  fullWidth?: boolean;
}

export function Button({
  onPress, children, variant = 'primary', size = 'md',
  trailingChevron = false, leadingIcon, disabled = false, style, fullWidth = true,
}: ButtonProps) {
  const [pressed, setPressed] = useState(false);
  const palette = paletteFor(variant, disabled);
  const padV = size === 'sm' ? 10 : 14;
  const padH = size === 'sm' ? spacing.lg : spacing.xl;
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={disabled}
      style={[
        styles.btn,
        {
          backgroundColor: pressed ? palette.bgPressed : palette.bg,
          borderColor: palette.border,
          paddingVertical: padV,
          paddingHorizontal: padH,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      <View style={styles.row}>
        {leadingIcon}
        <Text variant={size === 'sm' ? 'smallStrong' : 'bodyStrong'} color={palette.fg}>
          {children}
        </Text>
        {trailingChevron && <ChevronRight size={18} color={palette.fg} />}
      </View>
    </Pressable>
  );
}

function paletteFor(variant: ButtonProps['variant'], disabled: boolean) {
  if (variant === 'secondary') {
    return { bg: colors.surfaceInverse, bgPressed: colors.navyDeep, fg: colors.inkInverse, border: colors.surfaceInverse };
  }
  if (variant === 'ghost') {
    return { bg: 'transparent', bgPressed: colors.divider, fg: colors.ink, border: 'transparent' };
  }
  if (variant === 'outline') {
    return { bg: 'transparent', bgPressed: colors.redSoft, fg: colors.red, border: colors.red };
  }
  return { bg: colors.red, bgPressed: colors.redDeep, fg: colors.inkInverse, border: colors.red };
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
