import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { OnboardingScreen, SelectionCard } from '@/components/OnboardingScreen';
import { Text } from '@/components/Text';
import { EVIDENCE_LABELS, searchPresets, type PeptidePreset } from '@/domain/peptides';
import {
  CUSTOM_MEDICATION_ID,
  onboardingTotalSteps,
  useOnboardingStore,
} from '@/stores/onboarding';
import { colors, spacing } from '@/theme';

export default function TakingScreen() {
  const medicationIds = useOnboardingStore((state) => state.medicationIds);
  const customMedicationName = useOnboardingStore((state) => state.customMedicationName);
  const toggleMedication = useOnboardingStore((state) => state.toggleMedication);
  const setCustomMedicationName = useOnboardingStore((state) => state.setCustomMedicationName);
  const prepareSchedules = useOnboardingStore((state) => state.prepareSchedules);
  const [query, setQuery] = useState('');

  const customSelected = medicationIds.includes(CUSTOM_MEDICATION_ID);
  const canContinue = medicationIds.length > 0
    && (!customSelected || customMedicationName.trim().length > 0);

  // Anything already chosen stays at the top, even when the search text no
  // longer matches it. A selection must never scroll out of reach.
  const results = useMemo(() => {
    const matches = searchPresets(query);
    const matched = new Set(matches.map((preset) => preset.id));
    const pinned = searchPresets('')
      .filter((preset) => medicationIds.includes(preset.id) && !matched.has(preset.id));
    return [...pinned, ...matches];
  }, [query, medicationIds]);

  return (
    <OnboardingScreen
      step={1}
      totalSteps={onboardingTotalSteps(medicationIds.length)}
      backHref="/onboarding"
      title="What are you taking?"
      subtitle="Search the list, or add your own. You can change this list later."
      footer={(
        <Button
          disabled={!canContinue}
          onPress={() => {
            prepareSchedules();
            router.push({ pathname: '/onboarding/schedule/[index]', params: { index: '0' } });
          }}
        >
          {medicationIds.length > 1 ? `Set ${medicationIds.length} schedules` : 'Set the schedule'}
        </Button>
      )}
    >
      <Input
        value={query}
        onChangeText={setQuery}
        placeholder="Search a peptide or a brand name"
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        accessibilityLabel="Search peptides"
      />

      <View style={styles.list}>
        {results.map((preset) => (
          <PresetCard
            key={preset.id}
            preset={preset}
            selected={medicationIds.includes(preset.id)}
            onPress={() => toggleMedication(preset.id)}
          />
        ))}

        {results.length === 0 ? (
          <Text color={colors.inkMuted}>
            No match for “{query.trim()}”. Add it as a custom medication.
          </Text>
        ) : null}

        <SelectionCard
          compact
          title="Custom"
          description="Not on this list"
          selected={customSelected}
          onPress={() => toggleMedication(CUSTOM_MEDICATION_ID)}
        />
      </View>

      {customSelected ? (
        <View style={styles.customField}>
          <Text variant="smallStrong">Medication name</Text>
          <Input
            value={customMedicationName}
            onChangeText={setCustomMedicationName}
            placeholder="Type the name"
            returnKeyType="done"
          />
        </View>
      ) : null}
    </OnboardingScreen>
  );
}

function PresetCard({
  preset,
  selected,
  onPress,
}: {
  preset: PeptidePreset;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <SelectionCard
      compact
      title={preset.name}
      // The evidence tier, not the dose. A dose on a picker card reads like a
      // recommendation. The dose belongs on the schedule screen, where the user
      // confirms it.
      description={EVIDENCE_LABELS[preset.evidence]}
      selected={selected}
      onPress={onPress}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  customField: {
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
});
