import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Info } from 'lucide-react-native';

import { BlendCompositionFields } from '@/components/BlendCompositionFields';
import { BottomSheet } from '@/components/BottomSheet';
import { Input } from '@/components/Input';
import { ChoicePill } from '@/components/OnboardingScreen';
import { SetupMissing, SetupStep, useSetupMedication } from '@/components/SetupStep';
import { Text } from '@/components/Text';
import { blendParts, isBlend } from '@/domain/peptides';
import {
  scheduleCompositionSettled,
  scheduleHasVial,
  VIAL_MG_OPTIONS,
  useOnboardingStore,
} from '@/stores/onboarding';
import { colors, spacing } from '@/theme';

/** The row that opens the source, and the sheet's own title. */
const SOURCE_TITLE = 'Half-life and source';

/**
 * Whether the typed box should already be open when the screen mounts.
 *
 * The user who typed a size and then pressed back has to find their own number
 * where they left it, so the box opens on a size that no chip carries. Read
 * once, from the store, because the answer only matters at mount.
 */
function opensOnTypedSize(index: number): boolean {
  const state = useOnboardingStore.getState();
  const id = state.medicationIds[index];
  const draft = id ? state.schedules[id] : undefined;
  if (!draft || draft.vialForm !== 'vial' || draft.vialMgText === '') return false;
  return !VIAL_MG_OPTIONS.some((mg) => String(mg) === draft.vialMgText);
}

/**
 * The first question about one medication: what is in the vial.
 *
 * A vial size is a packaging fact printed on the label, so reading it back is
 * not Poke proposing anything, and chips are safe here where dose chips would
 * not be. A pen carries no vial size at all, so "It is a pen" is an answer on
 * this screen rather than a screen Poke skips on a guess: the catalog names no
 * packaging form, and asking is safer than skipping the wrong medication.
 *
 * A blend answers the same question with its label instead, one milligram box
 * per part, because for a blend the split is the number that matters.
 */
export default function VialScreen() {
  const params = useLocalSearchParams<{ index: string }>();
  const parsed = Number.parseInt(params.index ?? '0', 10);
  const index = Number.isFinite(parsed) ? parsed : 0;

  const setVialMg = useOnboardingStore((state) => state.setVialMg);
  const setVialForm = useOnboardingStore((state) => state.setVialForm);
  const deferVial = useOnboardingStore((state) => state.deferVial);
  const setScheduleCompositionMg = useOnboardingStore((state) => state.setScheduleCompositionMg);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [typedOpen, setTypedOpen] = useState(() => opensOnTypedSize(index));

  const setup = useSetupMedication(index);
  if (!setup) return <SetupMissing index={index} question="vial" />;

  const { medicationId, schedule, name, count, preset } = setup;
  const parts = preset && isBlend(preset) ? blendParts(preset) : [];
  const isBlendVial = parts.length > 0;
  const canContinue = isBlendVial
    ? scheduleCompositionSettled(schedule)
    : scheduleHasVial(schedule);

  // Where the level curve comes from, or why there will not be one. The vial is
  // the first screen of this medication's run and the blend sentence is about
  // the vial label, so the source sits here.
  const sourceLine = preset
    ? (isBlend(preset)
        ? `${preset.source} With the milligrams from your vial label Poke draws the level curve as the sum of the parts.`
        : preset.evidence === 'unsourced'
          ? `${preset.source} Poke shows your shots for ${name} without a level curve.`
          : `Level curve source: ${preset.source}`)
    : 'Poke has no half-life for a custom medication. Poke shows your shots without a level curve. You can add a half-life later in Medications.';

  return (
    <SetupStep
      index={index}
      count={count}
      question="vial"
      name={name}
      title={isBlendVial ? `What is on your ${name} label?` : `What size is your ${name} vial?`}
      canContinue={canContinue}
      onDefer={() => deferVial(medicationId)}
    >
      {isBlendVial ? (
        <BlendCompositionFields
          parts={parts}
          values={schedule.compositionMg}
          onChange={(partId, text) => setScheduleCompositionMg(medicationId, partId, text)}
        />
      ) : (
        <View style={styles.section}>
          <View style={styles.wrapRow}>
            {VIAL_MG_OPTIONS.map((mg) => (
              <ChoicePill
                key={mg}
                label={`${mg} mg`}
                selected={!typedOpen
                  && schedule.vialForm === 'vial'
                  && schedule.vialMgText === String(mg)}
                onPress={() => {
                  setTypedOpen(false);
                  setVialMg(medicationId, String(mg));
                }}
              />
            ))}
            <ChoicePill
              label="It is a pen"
              selected={schedule.vialForm === 'pen'}
              onPress={() => {
                setTypedOpen(false);
                setVialForm(medicationId, 'pen');
              }}
            />
            <ChoicePill
              label="Another size"
              selected={typedOpen}
              onPress={() => {
                setTypedOpen(true);
                setVialMg(medicationId, '');
              }}
            />
          </View>

          {/* The box opens empty and stays empty until the user copies the
              number off their own label. */}
          {typedOpen ? (
            <View style={styles.typed}>
              <View style={styles.inlineRow}>
                <View style={styles.inputBox}>
                  <Input
                    value={schedule.vialMgText}
                    onChangeText={(text) => setVialMg(medicationId, text)}
                    keyboardType="decimal-pad"
                    style={styles.inputText}
                    accessibilityLabel={`Milligrams in the ${name} vial`}
                  />
                </View>
                <Text variant="small" color={colors.inkMuted}>mg in the whole vial</Text>
              </View>
              <Text variant="small" color={colors.inkMuted}>{vialNote(schedule.vialMgText)}</Text>
            </View>
          ) : (
            <Text variant="small" color={colors.inkMuted}>{pickNote(schedule.vialForm)}</Text>
          )}
        </View>
      )}

      {/* Legal copy does not move, so the (i) takes no entrance and no stagger. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={SOURCE_TITLE}
        onPress={() => setSourceOpen(true)}
        hitSlop={8}
        style={styles.infoRow}
      >
        <Info size={18} color={colors.inkSubtle} />
        <Text variant="small" color={colors.inkMuted}>{SOURCE_TITLE}</Text>
      </Pressable>

      <BottomSheet visible={sourceOpen} title={SOURCE_TITLE} onClose={() => setSourceOpen(false)}>
        <Text color={colors.inkMuted}>{sourceLine}</Text>
      </BottomSheet>
    </SetupStep>
  );
}

/** The typed size read back, or the line that says the box is empty. */
function vialNote(text: string): string {
  const mg = Number.parseFloat(text);
  if (!Number.isFinite(mg) || mg <= 0) return 'Copy the milligrams from your vial label.';
  return `Poke records a ${mg} mg vial.`;
}

/** The state of the chips, in a sentence. Never a size the user did not press. */
function pickNote(form: 'vial' | 'pen' | null): string {
  if (form === 'pen') return 'A pen comes filled, so there is no vial size to enter.';
  return 'The size is printed on your vial label.';
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  typed: {
    gap: spacing.sm,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  inputBox: {
    width: 112,
  },
  inputText: {
    textAlign: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
  },
});
