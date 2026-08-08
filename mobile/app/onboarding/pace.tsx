import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/Card';
import { OnboardingStep } from '@/components/OnboardingStep';
import { Slider } from '@/components/Slider';
import { Text } from '@/components/Text';
import { paceBounds, useOnboardingStore } from '@/stores/onboarding';
import { colors, spacing } from '@/theme';

export default function PaceScreen() {
  const weight = useOnboardingStore((state) => state.weight);
  const pace = useOnboardingStore((state) => state.pace);
  const setPace = useOnboardingStore((state) => state.setPace);

  const bounds = paceBounds(weight.unit);
  const step = weight.unit === 'lb' ? 0.1 : 0.05;
  const format = (value: number) => `${value.toFixed(weight.unit === 'lb' ? 1 : 2)} ${weight.unit}`;

  return (
    <OnboardingStep
      step="pace"
      title="How fast do you want to go?"
      // The hedge on this screen is the footnote under the slider, not this line.
      // The subtitle used to carry a second, weaker copy of it ("Poke has no
      // opinion about which pace is right for you") directly above a footnote
      // that already says Poke recommends no rate of change. Two overlapping
      // hedges in one viewport read as nerves, not as care, so the strong one
      // stays and the duplicate is gone. Do not put a hedge back here without
      // taking the footnote out, and the footnote is the better of the two.
      //
      // The line also used to open with "Poke uses your number to work out a
      // date". It no longer does. `POST_SCHEDULE_ORDER` is flat, so this screen
      // runs even when the weight screen was skipped, and a skipped weight means
      // no projection at all. A date promised here is one the plan may not show.
      subtitle="Pick the pace you are aiming for."
    >
      <Card padding="xl" style={styles.readout}>
        <Text variant="smallStrong" color={colors.inkMuted}>Your pace</Text>
        <Text variant="display">{format(pace)} a week</Text>
      </Card>

      <View style={styles.sliderHolder}>
        <Slider
          value={pace}
          min={bounds.min}
          max={bounds.max}
          step={step}
          onChange={setPace}
          accessibilityLabel="Weekly pace"
          format={format}
        />
      </View>

      <Text variant="small" color={colors.inkMuted}>
        Speak to your clinician about the pace that suits you. Poke gives no medical
        advice and recommends no rate of change.
      </Text>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  readout: {
    gap: spacing.xs,
  },
  sliderHolder: {
    paddingTop: spacing.sm,
  },
});
