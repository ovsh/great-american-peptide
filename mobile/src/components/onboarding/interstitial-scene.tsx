import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { OnboardingStep } from '@/components/OnboardingStep';
import { Text } from '@/components/Text';
import { TodayRise } from '@/components/today-motion';
import type { PostScheduleStep } from '@/stores/onboarding';
import { colors, rise, spacing } from '@/theme';

/**
 * A claim screen whose claim is drawn rather than written.
 *
 * `Interstitial` in `OnboardingStep.tsx` puts a lucide glyph in an 88 pt
 * medallion and three stacked paragraphs under it, which is the shape
 * `principles.md` §2 calls a redesign trigger. This is the same slot with the
 * medallion replaced by a scene and the paragraphs cut to the one line the
 * scene cannot say.
 */
export function InterstitialScene({
  step,
  scene,
  title,
  line,
  lineDelay,
  note,
  continueLabel,
}: {
  step: PostScheduleStep;
  scene: ReactNode;
  title: string;
  /** The one sentence the drawing does not carry. Most of these have none. */
  line?: string;
  /**
   * The beat the line rises on, when the scene ends on a mark the line reads.
   * Left out, the line is simply there: a sentence that waits for no reason is
   * a sentence the reader watches instead of reads.
   */
  lineDelay?: number;
  /**
   * The limit on the claim. It is painted at once and it never moves, because
   * `motion.md` rule 8 keeps a caveat still: a caveat that arrives late is a
   * caveat the reader has already passed.
   */
  note?: string;
  continueLabel?: string;
}) {
  const text = line ? (
    <Text color={colors.inkMuted} align="center" style={styles.line}>{line}</Text>
  ) : null;

  return (
    <OnboardingStep
      step={step}
      title=""
      continueLabel={continueLabel}
      contentStyle={styles.claim}
      bodyStyle={styles.body}
    >
      <Text variant="display" align="center">{title}</Text>
      {scene}
      {text && lineDelay !== undefined ? (
        <TodayRise show delay={lineDelay} distance={rise.line} style={styles.lineBox}>
          {text}
        </TodayRise>
      ) : (
        text
      )}
      {note ? (
        <Text variant="small" color={colors.inkSubtle} align="center" style={styles.line}>
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
  body: {
    gap: spacing.lg,
    alignItems: 'center',
  },
  line: {
    maxWidth: 320,
    alignSelf: 'center',
  },
  lineBox: {
    alignSelf: 'stretch',
  },
});
