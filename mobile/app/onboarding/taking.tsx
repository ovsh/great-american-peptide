import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { OnboardingScreen, SelectionCard } from '@/components/OnboardingScreen';
import { Text } from '@/components/Text';
import { useOnboardingTransition } from '@/components/onboardingTransition';
import { EVIDENCE_LABELS, searchPresets, type PeptidePreset } from '@/domain/peptides';
import {
  CUSTOM_MEDICATION_ID,
  onboardingTotalSteps,
  useOnboardingStore,
} from '@/stores/onboarding';
import { colors, spacing } from '@/theme';

export default function TakingScreen() {
  const medicationIds = useOnboardingStore((state) => state.medicationIds);
  const journeyStage = useOnboardingStore((state) => state.journeyStage);
  const customMedicationName = useOnboardingStore((state) => state.customMedicationName);
  const toggleMedication = useOnboardingStore((state) => state.toggleMedication);
  const setCustomMedicationName = useOnboardingStore((state) => state.setCustomMedicationName);
  const prepareSchedules = useOnboardingStore((state) => state.prepareSchedules);
  const transition = useOnboardingTransition();
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
      step={2}
      totalSteps={onboardingTotalSteps(journeyStage)}
      backHref="/onboarding/journey"
      transition={transition}
      // The wording follows the answer on the previous screen, the way the
      // recording's does. Asking someone who has not started yet what they are
      // "taking" is the small wrong note that makes a flow feel generic.
      title={journeyStage === 'starting' ? 'What do you plan to use?' : 'What are you taking?'}
      subtitle="Search the list or add your own. You can change this list later."
      footer={(
        <Button
          disabled={!canContinue}
          onPress={() => {
            prepareSchedules();
            transition.go({ pathname: '/onboarding/schedule/[index]', params: { index: '0' } });
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
      // The name carries the row. The evidence tier read the same on almost
      // every card, so it moved to the estimate sheet on Today. Only the
      // missing half-life stays: it changes what the app can draw, so the user
      // must see it before the pick.
      description={preset.evidence === 'unsourced' ? EVIDENCE_LABELS.unsourced : undefined}
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
