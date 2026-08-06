import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Calculator, Scale, ShieldPlus, Syringe } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { BottomSheet } from './BottomSheet';
import { Text } from './Text';
import { colors, radius, spacing } from '../theme';

interface LogActionSheetProps {
  visible: boolean;
  onClose: () => void;
}

const ACTIONS: readonly { label: string; href: '/log-shot' | '/log-weight' | '/log-side-effect' | '/calculator'; icon: LucideIcon }[] = [
  { label: 'Log shot', href: '/log-shot', icon: Syringe },
  { label: 'Log weight', href: '/log-weight', icon: Scale },
  { label: 'Log side effect', href: '/log-side-effect', icon: ShieldPlus },
  { label: 'Calculator', href: '/calculator', icon: Calculator },
];

export function LogActionSheet({ visible, onClose }: LogActionSheetProps) {
  return (
    <BottomSheet visible={visible} title="Add a log" onClose={onClose}>
      <View style={styles.actions}>
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Pressable
              key={action.href}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              onPress={() => {
                onClose();
                router.push(action.href);
              }}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.icon}>
                <Icon size={22} strokeWidth={1.8} color={colors.accent} />
              </View>
              <Text variant="bodyStrong">{action.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  row: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  pressed: {
    opacity: 0.7,
  },
});
