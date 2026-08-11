import { ReactNode, useState } from 'react';
import { Platform, Pressable, View, StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Text } from './Text';
import { colors, fonts, radius, spacing } from '../theme';

interface ButtonProps {
  onPress?: () => void;
  children: string;
  accessibilityLabel?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  size?: 'md' | 'sm';
  trailingChevron?: boolean;
  leadingIcon?: ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
}

export function Button({
  onPress, children, variant = 'primary', size = 'md',
  trailingChevron = false, leadingIcon, disabled = false, style, fullWidth = true,
  accessibilityLabel = children,
}: ButtonProps) {
  const [pressed, setPressed] = useState(false);
  const palette = paletteFor(variant, disabled);
  const padV = size === 'sm' ? 8 : 14;
  const padH = size === 'sm' ? spacing.lg : spacing.xl;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      onPress={onPress}
      onPressIn={() => {
        setPressed(true);
        if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
      }}
      onPressOut={() => setPressed(false)}
      disabled={disabled}
      style={[
        styles.btn,
        {
          backgroundColor: pressed ? palette.bgPressed : palette.bg,
          borderColor: palette.border,
          minHeight: size === 'sm' ? 44 : 56,
          paddingVertical: padV,
          paddingHorizontal: padH,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          opacity: disabled ? 0.5 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      <View style={styles.row}>
        {leadingIcon}
        <Text
          variant={size === 'sm' ? 'smallStrong' : 'bodyStrong'}
          color={palette.fg}
          style={size === 'sm' ? undefined : styles.label}
        >
          {children}
        </Text>
        {trailingChevron && <ChevronRight size={18} color={palette.fg} />}
      </View>
    </Pressable>
  );
}

function paletteFor(variant: ButtonProps['variant'], disabled: boolean) {
  if (disabled) {
    return { bg: colors.accentSoft, bgPressed: colors.accentSoft, fg: colors.inkMuted, border: 'transparent' };
  }
  if (variant === 'secondary') {
    return { bg: colors.surface, bgPressed: colors.surfaceMuted, fg: colors.ink, border: colors.border };
  }
  if (variant === 'ghost') {
    return { bg: 'transparent', bgPressed: colors.divider, fg: colors.ink, border: 'transparent' };
  }
  if (variant === 'outline') {
    return { bg: colors.surface, bgPressed: colors.accentSoft, fg: colors.accent, border: colors.accent };
  }
  return { bg: colors.accent, bgPressed: colors.accent, fg: colors.inkInverse, border: colors.accent };
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 17,
    lineHeight: 22,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
