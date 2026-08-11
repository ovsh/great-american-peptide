import { StyleSheet, View } from 'react-native';
import { Database, Download, WifiOff } from 'lucide-react-native';

import { OnboardingStep } from '@/components/OnboardingStep';
import { Text } from '@/components/Text';
import { colors, radius, spacing } from '@/theme';

const POINTS = [
  {
    id: 'local',
    icon: <Database size={20} color={colors.accent} />,
    label: 'Your shots, weights and side effects sit in one database.',
  },
  {
    id: 'offline',
    icon: <WifiOff size={20} color={colors.accent} />,
    label: 'Poke works with the network off. There is nothing to sync and nothing to lose.',
  },
  {
    id: 'export',
    icon: <Download size={20} color={colors.accent} />,
    label: 'Poke Pro exports the lot as a CSV file, for the appointment where you need it.',
  },
];

// This is the slot where the recording asks to connect Apple Health. Poke reads
// no health store and writes to none, so the honest screen in this position says
// what Poke does instead of asking for a permission it does not use.
export default function OnDeviceScreen() {
  return (
    <OnboardingStep
      step="on-device"
      title="Everything stays on this phone"
      subtitle="Poke asks for no health data from another app and sends none to one."
    >
      <View style={styles.list}>
        {POINTS.map((point) => (
          <View key={point.id} style={styles.row}>
            <View style={styles.badge}>{point.icon}</View>
            <Text style={styles.rowLabel}>{point.label}</Text>
          </View>
        ))}
      </View>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
  },
});
