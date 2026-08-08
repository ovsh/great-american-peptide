import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { ChartLine, Clock3, House, Plus, UserRound } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LogActionSheet } from '@/components/LogActionSheet';
import { Text } from '@/components/Text';
import { colors, elevation, fonts, spacing } from '@/theme';

const TAB_ITEMS: readonly { name: string; label: string; icon: LucideIcon }[] = [
  { name: 'index', label: 'Today', icon: House },
  { name: 'progress', label: 'Progress', icon: ChartLine },
  { name: 'history', label: 'History', icon: Clock3 },
  { name: 'profile', label: 'Profile', icon: UserRound },
];

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <PokeTabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress' }} />
      <Tabs.Screen name="history" options={{ title: 'History' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}

function PokeTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}> 
        {TAB_ITEMS.map((item, index) => {
          const route = state.routes.find((candidate) => candidate.name === item.name);
          if (!route) return null;
          const routeIndex = state.routes.indexOf(route);
          const active = state.index === routeIndex;
          const Icon = item.icon;
          return (
            <View key={item.name} style={styles.slot}>
              {index === 2 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open the action menu"
                  onPress={() => setSheetOpen(true)}
                  style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
                >
                  <Plus size={28} strokeWidth={2.4} color={colors.inkInverse} />
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="tab"
                accessibilityLabel={item.label}
                accessibilityState={{ selected: active }}
                onPress={() => {
                  const event = navigation.emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!active && !event.defaultPrevented) navigation.navigate(route.name);
                }}
                style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
              >
                <Icon size={24} strokeWidth={1.8} color={active ? colors.accent : colors.inkSubtle} />
                <Text
                  color={active ? colors.accent : colors.inkSubtle}
                  style={styles.label}
                >
                  {item.label}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
      <LogActionSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  slot: {
    flex: 1,
    alignItems: 'center',
  },
  tab: {
    minWidth: 56,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    lineHeight: 14,
  },
  addButton: {
    ...elevation.raised,
    position: 'absolute',
    zIndex: 2,
    top: -36,
    left: -28,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  pressed: {
    opacity: 0.72,
  },
});
