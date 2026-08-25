import { useMemo, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { TextInput } from 'react-native';
import { X } from 'lucide-react-native';

import { Card } from '@/components/Card';
import { MarkChip } from '@/components/EstimateMark';
import { Input } from '@/components/Input';
import { SelectionCard } from '@/components/OnboardingScreen';
import { OnboardingStep } from '@/components/OnboardingStep';
import { Text } from '@/components/Text';
import {
  AddActionCard,
  FilterRail,
  GhostAddRow,
  NO_CURVE_NOTE,
  NoMatchLine,
  presetMarker,
  SectionHead,
  sectionLabel,
  usePresetCatalog,
} from '@/components/preset-picker';
import {
  blendParts,
  EVIDENCE_LABELS,
  getPresetEntry,
  isBlend,
  type PresetEntry,
} from '@/domain/peptides';
import {
  isCustomMedicationId,
  medicationDisplayName,
  useOnboardingStore,
} from '@/stores/onboarding';
import { colors, spacing } from '@/theme';

export default function TakingScreen() {
  const medicationIds = useOnboardingStore((state) => state.medicationIds);
  const journeyStage = useOnboardingStore((state) => state.journeyStage);
  const customNames = useOnboardingStore((state) => state.customNames);
  const toggleMedication = useOnboardingStore((state) => state.toggleMedication);
  const addCustomMedication = useOnboardingStore((state) => state.addCustomMedication);
  const prepareSchedules = useOnboardingStore((state) => state.prepareSchedules);
  const catalog = usePresetCatalog();
  const searchRef = useRef<TextInput>(null);

  // A custom medication is named the moment it is added, so a pick is all the
  // button waits for.
  const canContinue = medicationIds.length > 0;

  // The Selected block holds only what the list below cannot show: a pick the
  // current filter or query hides, and every custom entry, which has no catalog
  // row at all. A pick that is on screen keeps its place and its check, so a
  // tap never makes a row jump to the top of the list.
  const hiddenSelected = useMemo(() => {
    const visible = new Set(catalog.entries.map((entry) => entry.id));
    return medicationIds.filter((id) => isCustomMedicationId(id) || !visible.has(id));
  }, [catalog.entries, medicationIds]);

  const customSelected = medicationIds.some(isCustomMedicationId);

  const addCustom = (name: string) => {
    addCustomMedication(name);
    // Cleared so the next search starts empty. The keyboard stays up, because
    // the person who just added one name may well have a second.
    catalog.clearQuery();
  };

  return (
    <OnboardingStep
      step="taking"
      // The wording follows the answer on the previous screen, the way the
      // recording's does. Asking someone who has not started yet what they are
      // "taking" is the small wrong note that makes a flow feel generic.
      title={journeyStage === 'starting' ? 'What do you plan to use?' : 'What are you taking?'}
      // The list is the longest in the run and it ends hard against the pinned
      // footer, so the last row reads as sliced by the button. The inset gives
      // the list the height of that bar to scroll clear into.
      contentStyle={styles.content}
      canContinue={canContinue}
      // The label counts the picks, because the button leads into one screen per
      // medication and the user should know that before the first one opens.
      continueLabel={
        medicationIds.length > 1 ? `Set ${medicationIds.length} schedules` : 'Set the schedule'
      }
      // The draft schedules have to exist before the first schedule screen
      // reads one. `onboardingNextHref` sends the run to schedule zero from
      // here, so this screen no longer names that route itself.
      onContinue={(advance) => {
        prepareSchedules();
        advance();
      }}
    >
      <Input
        ref={searchRef}
        value={catalog.query}
        onChangeText={catalog.changeQuery}
        placeholder="Search a peptide or a brand name"
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        accessibilityLabel="Search peptides"
      />

      <FilterRail activeFilter={catalog.railFilter} onPick={catalog.pickFilter} />

      {hiddenSelected.length > 0 ? (
        <>
          <SectionHead label="Selected" count={hiddenSelected.length} />
          <View style={styles.list}>
            {hiddenSelected.map((id) => {
              if (isCustomMedicationId(id)) {
                return (
                  <CustomCard
                    key={id}
                    name={medicationDisplayName(id, customNames)}
                    onRemove={() => toggleMedication(id)}
                  />
                );
              }
              const entry = getPresetEntry(id);
              if (!entry) return null;
              return (
                <PresetCard
                  key={id}
                  entry={entry}
                  selected
                  onPress={() => toggleMedication(id)}
                />
              );
            })}
          </View>
          {customSelected ? (
            <Text variant="small" color={colors.inkSubtle}>{NO_CURVE_NOTE}</Text>
          ) : null}
        </>
      ) : null}

      {/* The ghost row is a shortcut into the search field, where the name of
          a custom medication gets typed. It hides while a query is live so the
          action card below is the only open door. */}
      {!catalog.hasQuery ? <GhostAddRow onPress={() => searchRef.current?.focus()} /> : null}

      {catalog.entries.length > 0 ? (
        <>
          <SectionHead
            label={sectionLabel(catalog.hasQuery, catalog.filter)}
            count={catalog.entries.length}
          />
          <View style={styles.list}>
            {catalog.entries.map((entry) => (
              <PresetCard
                key={entry.id}
                entry={entry}
                selected={medicationIds.includes(entry.id)}
                onPress={() => toggleMedication(entry.id)}
              />
            ))}
            {catalog.hasQuery ? (
              <AddActionCard
                name={catalog.trimmed}
                description="Poke saves this name as a custom medication."
                onPress={() => addCustom(catalog.trimmed)}
              />
            ) : null}
          </View>
        </>
      ) : (
        <View style={styles.list}>
          <NoMatchLine query={catalog.trimmed} />
          <AddActionCard
            name={catalog.trimmed}
            description="Poke saves this name as a custom medication."
            onPress={() => addCustom(catalog.trimmed)}
          />
        </View>
      )}

      {catalog.filter === 'blend' && !catalog.hasQuery && !customSelected ? (
        <Text variant="small" color={colors.inkSubtle}>{NO_CURVE_NOTE}</Text>
      ) : null}
    </OnboardingStep>
  );
}

function PresetCard({
  entry,
  selected,
  onPress,
}: {
  entry: PresetEntry;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <SelectionCard
      compact
      title={entry.name}
      marker={presetMarker(entry.preset)}
      description={entryDescription(entry)}
      selected={selected}
      onPress={onPress}
    />
  );
}

/**
 * A custom entry in the Selected block. An X stands where the check stands on
 * a catalog row, because an unselected custom row means nothing: the row only
 * exists while it is picked, so the one act it offers is removal.
 */
function CustomCard({ name, onRemove }: { name: string; onRemove: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Remove ${name}`}
      onPress={onRemove}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <Card padding="md" style={styles.customCard}>
        <View style={styles.customCopy}>
          <View style={styles.customTitle}>
            <Text variant="smallStrong" style={styles.customName}>{name}</Text>
            <MarkChip label="Custom" />
          </View>
          <Text variant="small" color={colors.inkMuted}>No half-life yet</Text>
        </View>
        <View style={styles.remove}>
          <X size={12} strokeWidth={2.5} color={colors.inkMuted} />
        </View>
      </Card>
    </Pressable>
  );
}

/**
 * The line under the name, or nothing.
 *
 * A brand row names its molecule, which differs on every row and tells the
 * user what Wegovy is. A blend row names its parts there, because for a blend
 * the parts are what it is. The evidence tier read the same on almost every
 * card, so it moved to the estimate sheet on Today. Only the missing half-life
 * stays: it changes what the app can draw, so the user must see it before the
 * pick. The estimate tier is marked beside the name rather than here, so it is
 * a mark and not another line of prose.
 */
function entryDescription(entry: PresetEntry): string | undefined {
  if (isBlend(entry.preset)) {
    const parts = blendParts(entry.preset).map((part) => part.name).join(', ');
    return `${parts}. ${EVIDENCE_LABELS.unsourced}`;
  }
  const missing = entry.preset.evidence === 'unsourced' ? EVIDENCE_LABELS.unsourced : undefined;
  if (entry.moleculeName && missing) return `${entry.moleculeName}. ${missing}`;
  return entry.moleculeName ?? missing;
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.hero,
  },
  list: {
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.78,
  },
  customCard: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  customCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  customTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  customName: {
    flexShrink: 1,
  },
  remove: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
