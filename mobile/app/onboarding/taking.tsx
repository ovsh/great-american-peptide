import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { OnboardingScreen, SelectionCard } from '@/components/OnboardingScreen';
import { Text } from '@/components/Text';
import { getPreset } from '@/domain/peptides';
import {
  ONBOARDING_PRESET_IDS,
  useOnboardingStore,
} from '@/stores/onboarding';
import { spacing } from '@/theme';

const PRESETS = ONBOARDING_PRESET_IDS.flatMap((id) => {
  const preset = getPreset(id);
  return preset ? [{ id, preset }] : [];
});

export default function TakingScreen() {
  const medicationIds = useOnboardingStore((state) => state.medicationIds);
  const customMedicationName = useOnboardingStore((state) => state.customMedicationName);
  const toggleMedication = useOnboardingStore((state) => state.toggleMedication);
  const setCustomMedicationName = useOnboardingStore((state) => state.setCustomMedicationName);
  const prepareSchedule = useOnboardingStore((state) => state.prepareSchedule);
  const customSelected = medicationIds.includes('custom');
  const canContinue = medicationIds.length > 0 && (!customSelected || customMedicationName.trim().length > 0);

  return (
    <OnboardingScreen
      step={1}
      backHref="./"
      title="What are you taking?"
      subtitle="Choose everything you want to track. You can change this later."
      footer={(
        <Button
          disabled={!canContinue}
          onPress={() => {
            prepareSchedule();
            router.push('/onboarding/schedule');
          }}
        >
          Continue
        </Button>
      )}
    >
      <View style={styles.grid}>
        {PRESETS.map(({ id, preset }) => (
          <View key={id} style={styles.gridItem}>
            <SelectionCard
              compact
              title={preset.name}
              description={`${preset.defaultDose} ${preset.unit}`}
              selected={medicationIds.includes(id)}
              onPress={() => toggleMedication(id)}
            />
          </View>
        ))}
        <View style={styles.gridItem}>
          <SelectionCard
            compact
            title="Custom"
            description="Add your own"
            selected={customSelected}
            onPress={() => toggleMedication('custom')}
          />
        </View>
      </View>

      {customSelected ? (
        <View style={styles.customField}>
          <Text variant="smallStrong">What do you call it?</Text>
          <Input
            autoFocus
            value={customMedicationName}
            onChangeText={setCustomMedicationName}
            placeholder="Medication name"
            returnKeyType="done"
          />
        </View>
      ) : null}
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  gridItem: {
    flexBasis: '46%',
    flexGrow: 1,
    minWidth: 145,
  },
  customField: {
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
});
