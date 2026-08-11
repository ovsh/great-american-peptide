import { ReactNode } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import type { Href } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Text } from './Text';
import { safeBack } from '../utils/nav';
import { colors, spacing } from '../theme';

interface HeaderProps {
  title?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onBack?: () => void;
  showBack?: boolean;
  backFallback?: Href;
  variant?: 'default' | 'inline';
}

export function Header({ title, leading, trailing, onBack, showBack = false, backFallback = '/', variant = 'default' }: HeaderProps) {
  const back = () => (onBack ? onBack() : safeBack(backFallback));
  return (
    <View style={[styles.row, variant === 'inline' && styles.inline]}>
      <View style={styles.side}>
        {showBack ? (
          <Pressable onPress={back} hitSlop={10} style={styles.backBtn}>
            <ChevronLeft size={24} color={colors.ink} />
          </Pressable>
        ) : leading}
      </View>
      <View style={styles.center}>
        {title && <Text variant="h3" align="center">{title}</Text>}
      </View>
      <View style={styles.side}>
        <View style={styles.trailing}>{trailing}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.md,
    minHeight: 52,
  },
  inline: {
    paddingVertical: spacing.sm,
  },
  side: {
    minWidth: 40,
    flexDirection: 'row',
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  trailing: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
  },
});
