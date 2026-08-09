import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { Button } from './Button';
import { OnboardingScreen } from './OnboardingScreen';
import { Text } from './Text';
import { useOnboardingTransition } from './onboardingTransition';
import {
  nextHref,
  onboardingTotalSteps,
  postScheduleStepIndex,
  previousHref,
  useOnboardingStore,
  type PostScheduleStep,
} from '../stores/onboarding';
import { colors, radius, spacing } from '../theme';

interface OnboardingStepProps {
  /** The step's name in `POST_SCHEDULE_ORDER`. Index, back and next come from it. */
  step: PostScheduleStep;
  title: string;
  subtitle?: string;
  children?: ReactNode;
  canContinue?: boolean;
  continueLabel?: string;
  /**
   * Runs instead of the plain advance. Call `advance()` when you are ready to
   * leave: it starts the fade and navigates when the fade is over.
   */
  onContinue?: (advance: () => void) => void;
  secondary?: { label: string; onPress: (advance: () => void) => void };
  /** Sits under the buttons, outside the fading body. Use it for a caveat. */
  footerNote?: ReactNode;
  bodyStyle?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * One counted question in the run after the schedule screens.
 *
 * Every screen in that run is the same shape, so the shape lives here once: read
 * the step index off `POST_SCHEDULE_ORDER`, own the measured fade, put the
 * primary button in the same place, and never let a screen invent its own
 * forward or back target.
 */
export function OnboardingStep({
  step,
  title,
  subtitle,
  children,
  canContinue = true,
  continueLabel = 'Continue',
  onContinue,
  secondary,
  footerNote,
  bodyStyle,
  contentStyle,
}: OnboardingStepProps) {
  const medicationIds = useOnboardingStore((state) => state.medicationIds);
  // The run is shorter for a user who has not started, so the index, the total
  // and both targets read the order for that stage rather than the flat one.
  const stage = useOnboardingStore((state) => state.journeyStage);
  const transition = useOnboardingTransition();
  const count = medicationIds.length;
  const advance = () => transition.go(nextHref(stage, step));

  return (
    <OnboardingScreen
      step={postScheduleStepIndex(stage, step)}
      totalSteps={onboardingTotalSteps(stage)}
      backHref={previousHref(stage, count, step)}
      transition={transition}
      title={title}
      subtitle={subtitle}
      bodyStyle={bodyStyle}
      contentStyle={contentStyle}
      footer={(
        <>
          {footerNote}
          <Button
            disabled={!canContinue}
            onPress={() => (onContinue ? onContinue(advance) : advance())}
          >
            {continueLabel}
          </Button>
          {secondary ? (
            <Button variant="ghost" onPress={() => secondary.onPress(advance)}>
              {secondary.label}
            </Button>
          ) : null}
        </>
      )}
    >
      {children}
    </OnboardingScreen>
  );
}

interface InterstitialProps {
  step: PostScheduleStep;
  icon: ReactNode;
  title: string;
  body: string;
  /** The source, or the limit. An interstitial that claims must say who says so. */
  note?: string;
  continueLabel?: string;
}

/**
 * A claim screen between questions. MeAgain puts four of these in the run and
 * they carry the whole argument; Poke keeps the position and the count, and
 * every claim on one names either a source or a thing the app actually does.
 */
export function Interstitial({
  step,
  icon,
  title,
  body,
  note,
  continueLabel = 'Continue',
}: InterstitialProps) {
  return (
    <OnboardingStep step={step} title="" continueLabel={continueLabel} contentStyle={styles.claim}>
      <View style={styles.medallion}>{icon}</View>
      <Text variant="display" align="center">{title}</Text>
      <Text color={colors.inkMuted} align="center" style={styles.claimBody}>{body}</Text>
      {note ? (
        <Text variant="small" color={colors.inkSubtle} align="center" style={styles.claimBody}>
          {note}
        </Text>
      ) : null}
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  claim: {
    flex: 1,
    justifyContent: 'center',
  },
  medallion: {
    width: 88,
    height: 88,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.xl,
  },
  claimBody: {
    maxWidth: 320,
    alignSelf: 'center',
  },
});
