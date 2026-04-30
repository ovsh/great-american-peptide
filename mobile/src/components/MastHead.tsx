import { View, Pressable, StyleSheet } from 'react-native';
import { Bell } from 'lucide-react-native';
import { Text } from './Text';
import { BrandSeal } from './BrandSeal';
import { colors, spacing } from '../theme';

interface MastHeadProps {
  onBellPress?: () => void;
}

export function MastHead({ onBellPress }: MastHeadProps = {}) {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <BrandSeal size={28} />
        <Text variant="caption" color={colors.inkMuted} style={styles.cap} numberOfLines={1}>
          THE GREAT AMERICAN PEPTIDE CO.
        </Text>
      </View>
      <View style={styles.right}>
        <Pressable onPress={onBellPress} hitSlop={10} style={styles.iconBtn}>
          <Bell size={20} color={colors.ink} strokeWidth={1.5} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.md,
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 0,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cap: {
    fontSize: 10,
    letterSpacing: 0.6,
    flexShrink: 1,
  },
});
