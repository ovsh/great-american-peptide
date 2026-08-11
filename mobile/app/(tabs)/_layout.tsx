import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Tabs } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { ChartLine, Clock3, House, Plus, UserRound } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LogActionSheet } from '@/components/LogActionSheet';
import { Text } from '@/components/Text';
import { usePressScale } from '@/components/today-motion';
import { colors, elevation, fonts, spacing } from '@/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const TAB_ITEMS: readonly { name: string; label: string; icon: LucideIcon }[] = [
  { name: 'index', label: 'Today', icon: House },
  { name: 'progress', label: 'Progress', icon: ChartLine },
  { name: 'history', label: 'History', icon: Clock3 },
  { name: 'profile', label: 'Profile', icon: UserRound },
];

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <PokeTabBar {...props} />}
      >
        <Tabs.Screen name="index" options={{ title: 'Today' }} />
        <Tabs.Screen name="progress" options={{ title: 'Progress' }} />
        <Tabs.Screen name="history" options={{ title: 'History' }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      </Tabs>
      {/* Every tab scrolls its own title, so there is no bar to hide behind and a
          scrolled card runs into the clock. One band of the page colour across the
          inset holds the card back. It takes no touches, so the list under it keeps
          the full height of the screen to scroll in. */}
      <View pointerEvents="none" style={[styles.statusScrim, { height: insets.top }]} />
    </View>
  );
}

function PokeTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [sheetOpen, setSheetOpen] = useState(false);
  // The one control on the screen that presses further than the rest: it is the
  // largest target and it opens a sheet, so .92 rather than .97.
  const fab = usePressScale(0.92);

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
                <AnimatedPressable
                  accessibilityRole="button"
                  accessibilityLabel="Open the action menu"
                  onPress={() => setSheetOpen(true)}
                  onPressIn={fab.onPressIn}
                  onPressOut={fab.onPressOut}
                  style={[styles.addButton, fab.style]}
                >
                  <Plus size={28} strokeWidth={2.4} color={colors.inkInverse} />
                </AnimatedPressable>
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
                <Icon size={24} strokeWidth={1.8} color={active ? colors.successDeep : colors.inkMuted} />
                <Text
                  color={active ? colors.successDeep : colors.inkMuted}
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
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  statusScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
  },
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
