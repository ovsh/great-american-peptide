import { useEffect, useState } from 'react';
import { View, Pressable, StyleSheet, Platform } from 'react-native';
import { router, usePathname } from 'expo-router';
import { CalendarDays, Clock3, House, UserRound } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { BrandSeal } from '@/components/BrandSeal';
import { Text } from '@/components/Text';
import { colors, fonts, spacing } from '@/theme';

import TodayScreen from './index';
import CalendarScreen from './calendar';
import HistoryScreen from './history';
import ProfileScreen from './profile';

const ICON_SIZE = 22;

type TabId = 'index' | 'calendar' | 'history' | 'profile';

const TABS: {
  id: TabId;
  href: string;
  title: string;
  icon: (color: string) => React.ReactNode;
  render: () => React.ReactNode;
}[] = [
  {
    id: 'index',
    href: '/',
    title: 'Home',
    icon: (color) => <House size={ICON_SIZE} color={color} strokeWidth={1.5} />,
    render: () => <TodayScreen />,
  },
  {
    id: 'calendar',
    href: '/calendar',
    title: 'Calendar',
    icon: (color) => <CalendarDays size={ICON_SIZE} color={color} strokeWidth={1.5} />,
    render: () => <CalendarScreen />,
  },
  {
    id: 'history',
    href: '/history',
    title: 'History',
    icon: (color) => <Clock3 size={ICON_SIZE} color={color} strokeWidth={1.5} />,
    render: () => <HistoryScreen />,
  },
  {
    id: 'profile',
    href: '/profile',
    title: 'Profile',
    icon: (color) => <UserRound size={ICON_SIZE} color={color} strokeWidth={1.5} />,
    render: () => <ProfileScreen />,
  },
];

function tabForPath(pathname: string): TabId {
  if (pathname.startsWith('/calendar')) return 'calendar';
  if (pathname.startsWith('/history')) return 'history';
  if (pathname.startsWith('/profile')) return 'profile';
  return 'index';
}

function tap() {
  if (Platform.OS !== 'web') {
    Haptics.selectionAsync().catch(() => {});
  }
}

export default function TabLayout() {
  const pathname = usePathname();
  const [active, setActive] = useState<TabId>(() => tabForPath(pathname));

  useEffect(() => {
    setActive(tabForPath(pathname));
  }, [pathname]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onPopState = () => setActive(tabForPath(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const switchTab = (id: TabId, href: string) => {
    tap();
    setActive(id);
    if (Platform.OS === 'web') {
      window.history.pushState(null, '', href);
      return;
    }
    router.replace(href as any);
  };

  return (
    <View style={styles.root}>
      <View style={styles.sceneWrap}>
        {TABS.map((tab) => (
          <View key={tab.id} style={[styles.scene, active !== tab.id && styles.hiddenScene]}>
            {tab.render()}
          </View>
        ))}
      </View>

      <View style={styles.bar}>
        <TabButton
          title="Home"
          active={active === 'index'}
          icon={TABS[0]!.icon}
          onPress={() => switchTab('index', '/')}
        />
        <TabButton
          title="Calendar"
          active={active === 'calendar'}
          icon={TABS[1]!.icon}
          onPress={() => switchTab('calendar', '/calendar')}
        />
        <SealButton />
        <TabButton
          title="History"
          active={active === 'history'}
          icon={TABS[2]!.icon}
          onPress={() => switchTab('history', '/history')}
        />
        <TabButton
          title="Profile"
          active={active === 'profile'}
          icon={TABS[3]!.icon}
          onPress={() => switchTab('profile', '/profile')}
        />
      </View>
    </View>
  );
}

function TabButton({
  title,
  active,
  icon,
  onPress,
}: {
  title: string;
  active: boolean;
  icon: (color: string) => React.ReactNode;
  onPress: () => void;
}) {
  const color = active ? colors.red : colors.inkSubtle;
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={title}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={styles.item}
    >
      {icon(color)}
      <Text variant="caption" color={color} style={styles.label}>{title}</Text>
    </Pressable>
  );
}

function SealButton() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Log shot"
      onPress={() => {
        tap();
        router.push('/log-shot');
      }}
      style={styles.sealBtn}
      hitSlop={8}
    >
      <View style={styles.sealCircle}>
        <BrandSeal size={52} variant="cream" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  sceneWrap: {
    flex: 1,
  },
  scene: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
  },
  hiddenScene: {
    display: 'none',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderStrong,
    height: 92,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
  },
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 0.4,
    marginTop: 2,
  },
  sealBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -28,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
});
