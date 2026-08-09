import { StyleSheet, View } from 'react-native';
import { Lock, ServerOff, UserX } from 'lucide-react-native';

import { Button } from '@/components/Button';
import { OnboardingScreen } from '@/components/OnboardingScreen';
import { Text } from '@/components/Text';
import { useOnboardingTransition } from '@/components/onboardingTransition';
import { onboardingTotalSteps } from '@/stores/onboarding';
import { colors, radius, spacing } from '@/theme';

const PROMISES = [
  {
    id: 'account',
    icon: <UserX size={20} color={colors.accent} />,
    label: 'Poke asks for no account and no sign-in.',
  },
  {
    id: 'server',
    icon: <ServerOff size={20} color={colors.accent} />,
    label: 'Poke sends what you log nowhere.',
  },
  {
    id: 'local',
    icon: <Lock size={20} color={colors.accent} />,
    label: 'Your log lives on this phone.',
  },
];

// Step 0. The recording opens its counted run on a promise about the answers,
// before it asks for a single one, and the order is the point: you are told what
// happens to the answers first, and then you are asked.
export default function PrivacyScreen() {
  const transition = useOnboardingTransition();

  return (
    <OnboardingScreen
      step={0}
      totalSteps={onboardingTotalSteps()}
      backHref="/onboarding"
      transition={transition}
      title="Before Poke asks you anything"
      subtitle="The next few minutes are questions about you. Here is where the answers go."
      footer={<Button onPress={() => transition.go('/onboarding/journey')}>Continue</Button>}
    >
      <View style={styles.list}>
        {PROMISES.map((promise) => (
          <View key={promise.id} style={styles.row}>
            <View style={styles.badge}>{promise.icon}</View>
            <Text style={styles.rowLabel}>{promise.label}</Text>
          </View>
        ))}
      </View>

      <Text variant="small" color={colors.inkMuted}>
        Where a question is optional, Poke puts a skip under the button.
      </Text>
    </OnboardingScreen>
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
