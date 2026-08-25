import { useEffect, type ReactNode } from 'react';
import { router } from 'expo-router';

import { Button } from './Button';
import { OnboardingScreen } from './OnboardingScreen';
import { Text } from './Text';
import { useOnboardingTransition } from './onboardingTransition';
import { getPreset, type PeptidePreset } from '../domain/peptides';
import {
  isCustomMedicationId,
  medicationDisplayName,
  mixCandidateIndex,
  onboardingTotalSteps,
  setupBackHref,
  setupNextHref,
  setupStepIndex,
  useOnboardingStore,
  type MedicationScheduleDraft,
  type OnboardingMedicationId,
  type SetupQuestion,
} from '../stores/onboarding';
import { colors } from '../theme';

/** The one hatch wording, so the three screens cannot drift apart. */
export const DEFER_LABEL = 'Not sure yet. Set it up later.';

interface SetupMedication {
  medicationId: OnboardingMedicationId;
  schedule: MedicationScheduleDraft;
  /** The brand or custom name, as every later screen prints it. */
  name: string;
  index: number;
  count: number;
  /** Undefined for a custom medication, which has no catalog row. */
  preset: PeptidePreset | undefined;
  isCustom: boolean;
}

/**
 * The medication one setup screen is about.
 *
 * Null when the index names nothing, which happens on a reload or a deep link
 * into a run whose picker answers are gone. Every screen in the run reads this
 * and none of them resolves an index for itself.
 */
export function useSetupMedication(index: number): SetupMedication | null {
  const medicationIds = useOnboardingStore((state) => state.medicationIds);
  const schedules = useOnboardingStore((state) => state.schedules);
  const customNames = useOnboardingStore((state) => state.customNames);
  const prepareSchedules = useOnboardingStore((state) => state.prepareSchedules);

  // A draft for every selected medication, whichever screen the user landed on
  // first. `prepareSchedules` writes nothing over an answer already given.
  useEffect(() => {
    prepareSchedules();
  }, [prepareSchedules]);

  const valid = Number.isInteger(index) && index >= 0;
  const medicationId = valid ? medicationIds[index] : undefined;
  const schedule = medicationId ? schedules[medicationId] : undefined;
  if (!medicationId || !schedule) return null;

  const isCustom = isCustomMedicationId(medicationId);
  return {
    medicationId,
    schedule,
    name: medicationDisplayName(medicationId, customNames),
    index,
    count: medicationIds.length,
    preset: isCustom ? undefined : getPreset(medicationId),
    isCustom,
  };
}

interface SetupStepProps {
  index: number;
  count: number;
  question: SetupQuestion;
  title: string;
  /** The medication this screen is about, for the run counter under the title. */
  name: string;
  children?: ReactNode;
  canContinue?: boolean;
  continueLabel?: string;
  /** Runs instead of the plain advance. Call `advance()` to leave. */
  onContinue?: (advance: () => void) => void;
  /**
   * The hatch. It defers the answer this screen asks for and then advances, so
   * every screen passes the one store action that records its own pass.
   */
  onDefer: () => void;
}

/**
 * One question of the per-medication setup run.
 *
 * The whole run is a single counted step however many medications the user
 * picked, so the shape lives here once: read the fraction off `setupStepIndex`,
 * read both targets off the store, and give every screen the same hatch in the
 * same place. No screen names a neighbour route and no screen counts anything.
 */
export function SetupStep({
  index,
  count,
  question,
  title,
  name,
  children,
  canContinue = true,
  continueLabel = 'Continue',
  onContinue,
  onDefer,
}: SetupStepProps) {
  const stage = useOnboardingStore((state) => state.journeyStage);
  const experience = useOnboardingStore((state) => state.experienceLevel);
  // Whether the run ends in the mix beat, read off the store and handed to the
  // store's own router. This screen still names no neighbour route: it carries
  // the answer across and `setupNextHref` decides what to do with it.
  const mixIndex = useOnboardingStore(mixCandidateIndex);
  const transition = useOnboardingTransition();
  const advance = () => transition.go(
    setupNextHref(index, question, count, stage, experience, mixIndex),
  );

  return (
    <OnboardingScreen
      step={setupStepIndex(index, question, count)}
      totalSteps={onboardingTotalSteps(stage, experience)}
      backHref={setupBackHref(index, question, count)}
      transition={transition}
      title={title}
      // The run counter is the only place the run says how far along it is, and
      // it names the medication because the title does not always do so. One
      // medication has no count to give, so it gets no line at all.
      subtitle={count > 1 ? `${name}, medication ${index + 1} of ${count}.` : undefined}
      footer={(
        <>
          <Button
            disabled={!canContinue}
            onPress={() => (onContinue ? onContinue(advance) : advance())}
          >
            {continueLabel}
          </Button>
          <Button
            variant="ghost"
            onPress={() => {
              onDefer();
              advance();
            }}
          >
            {DEFER_LABEL}
          </Button>
        </>
      )}
    >
      {children}
    </OnboardingScreen>
  );
}

/**
 * The setup run with nothing to set up.
 *
 * A reload drops the picker answers, and an index with no medication behind it
 * has no question to ask. It says so and sends the user back to the picker
 * rather than drawing an empty form.
 */
export function SetupMissing({ index, question }: { index: number; question: SetupQuestion }) {
  const stage = useOnboardingStore((state) => state.journeyStage);
  const experience = useOnboardingStore((state) => state.experienceLevel);
  const transition = useOnboardingTransition();

  return (
    <OnboardingScreen
      step={setupStepIndex(index, question, 0)}
      totalSteps={onboardingTotalSteps(stage, experience)}
      backHref="/onboarding/taking"
      transition={transition}
      title="Choose a medication first"
      footer={(
        <Button onPress={() => router.replace('/onboarding/taking')}>Choose a medication</Button>
      )}
    >
      <Text color={colors.inkMuted}>
        Poke has no medication to set up yet. Go back and choose one.
      </Text>
    </OnboardingScreen>
  );
}
