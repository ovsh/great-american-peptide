import { StyleSheet, View } from 'react-native';

import { Input } from '@/components/Input';
import { OnboardingStep } from '@/components/OnboardingStep';
import { Text } from '@/components/Text';
import { useOnboardingStore } from '@/stores/onboarding';
import { colors, spacing } from '@/theme';

// A four-digit year, not a date. The date adds nothing Poke uses and it is one
// more piece of you sitting in a database.
const FIRST_YEAR = 1900;
const CURRENT_YEAR = new Date().getFullYear();

export default function BirthdayScreen() {
  const birthYearText = useOnboardingStore((state) => state.birthYearText);
  const setBirthYearText = useOnboardingStore((state) => state.setBirthYearText);

  const year = Number.parseInt(birthYearText, 10);
  const valid = Number.isInteger(year) && year >= FIRST_YEAR && year <= CURRENT_YEAR;
  const showError = birthYearText.length === 4 && !valid;

  return (
    <OnboardingStep
      step="birthday"
      title="What year were you born?"
      subtitle="Poke asks for the year, not the date."
      canContinue={valid}
    >
      <View style={styles.field}>
        <Input
          size="lg"
          value={birthYearText}
          onChangeText={(value) => setBirthYearText(value.replace(/[^0-9]/g, '').slice(0, 4))}
          keyboardType="number-pad"
          inputMode="numeric"
          placeholder="Four digits"
          returnKeyType="done"
          accessibilityLabel="Birth year"
        />
        {showError ? (
          <Text variant="small" color={colors.danger}>
            Enter a year between {FIRST_YEAR} and {CURRENT_YEAR}.
          </Text>
        ) : null}
      </View>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.sm,
  },
});
