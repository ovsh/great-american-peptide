import { useEffect, useMemo } from 'react';

import { OnboardingStep } from '@/components/OnboardingStep';
import { WheelPicker } from '@/components/WheelPicker';
import { useOnboardingStore } from '@/stores/onboarding';

// A four-digit year, not a date. The date adds nothing Poke uses and it is one
// more piece of you sitting in a database.
const FIRST_YEAR = 1900;
const CURRENT_YEAR = new Date().getFullYear();
/** Where the wheel rests before it is touched. Nothing computes from it. */
const DEFAULT_YEAR = CURRENT_YEAR - 35;

export default function BirthdayScreen() {
  const birthYearText = useOnboardingStore((state) => state.birthYearText);
  const setBirthYearText = useOnboardingStore((state) => state.setBirthYearText);

  // Most recent first. Scrolling down goes back in time, which is the direction
  // a birth year runs.
  const years = useMemo(
    () => Array.from({ length: CURRENT_YEAR - FIRST_YEAR + 1 }, (_, i) => CURRENT_YEAR - i),
    [],
  );

  const parsed = Number.parseInt(birthYearText, 10);
  const answered = Number.isInteger(parsed) && parsed >= FIRST_YEAR && parsed <= CURRENT_YEAR;
  const year = answered ? parsed : DEFAULT_YEAR;

  // The row under the band is the answer, so the store has to agree with it
  // from the first frame. Otherwise Continue would carry nothing while the
  // screen shows a year.
  useEffect(() => {
    if (!answered) setBirthYearText(String(DEFAULT_YEAR));
  }, [answered, setBirthYearText]);

  return (
    <OnboardingStep
      step="birthday"
      title="What year were you born?"
      subtitle="Poke asks for the year only."
    >
      <WheelPicker
        values={years}
        value={year}
        onChange={(next) => setBirthYearText(String(next))}
        accessibilityLabel="Birth year"
      />
    </OnboardingStep>
  );
}
