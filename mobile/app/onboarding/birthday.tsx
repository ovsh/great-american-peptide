import { useMemo } from 'react';

import { OnboardingStep } from '@/components/OnboardingStep';
import { WheelPicker } from '@/components/WheelPicker';
import { useOnboardingStore } from '@/stores/onboarding';

// A four-digit year, not a date. The date adds nothing Poke uses and it is one
// more piece of you sitting in a database.
const CURRENT_YEAR = new Date().getFullYear();
/**
 * The ends of the wheel, as ages rather than as years.
 *
 * Poke is an adult app, so the wheel starts at eighteen. It stops at a hundred
 * because a wheel of two hundred rows is a wheel nobody reaches the end of, and
 * every year past a hundred is a row the user has to scroll through.
 */
const YOUNGEST = 18;
const OLDEST = 100;
const FIRST_YEAR = CURRENT_YEAR - OLDEST;
const LAST_YEAR = CURRENT_YEAR - YOUNGEST;
/** Where the wheel rests before it is touched. Nothing computes from it. */
const REST_YEAR = CURRENT_YEAR - 35;

export default function BirthdayScreen() {
  const birthYearText = useOnboardingStore((state) => state.birthYearText);
  const setBirthYearText = useOnboardingStore((state) => state.setBirthYearText);

  // Most recent first. Scrolling down goes back in time, which is the direction
  // a birth year runs.
  const years = useMemo(
    () => Array.from({ length: LAST_YEAR - FIRST_YEAR + 1 }, (_, i) => LAST_YEAR - i),
    [],
  );

  const parsed = Number.parseInt(birthYearText, 10);
  const answered = Number.isInteger(parsed) && parsed >= FIRST_YEAR && parsed <= LAST_YEAR;

  return (
    <OnboardingStep
      step="birthday"
      title="What year were you born?"
      // Nothing is written on mount. The wheel rests on the row for thirty-five
      // and the store stays empty, so a user who skips leaves no year behind and
      // a user who presses Continue without touching the wheel is taken at their
      // word: the row under the band is the answer they are looking at. The
      // height and weight screens seed on mount instead, because a skip there
      // only costs a BMI; a birth year Poke invented is a fact about a person.
      onContinue={(advance) => {
        if (!answered) setBirthYearText(String(REST_YEAR));
        advance();
      }}
      secondary={{
        label: 'Skip this',
        onPress: (advance) => {
          setBirthYearText('');
          advance();
        },
      }}
    >
      <WheelPicker
        values={years}
        value={answered ? parsed : null}
        restValue={REST_YEAR}
        onChange={(next) => setBirthYearText(String(next))}
        accessibilityLabel="Birth year"
      />
    </OnboardingStep>
  );
}
