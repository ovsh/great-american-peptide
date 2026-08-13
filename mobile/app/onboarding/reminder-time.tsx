import { InlineTimePicker } from '@/components/InlineTimePicker';
import { OnboardingStep } from '@/components/OnboardingStep';
import { useOnboardingStore } from '@/stores/onboarding';

// The time comes before the permission ask, so the permission sheet arrives with
// something already agreed behind it. This is the slot the recording spends on
// its rating prompt, which `services/reviewGate.ts` will not let Poke copy.
//
// The title asks the whole question and the wheels answer it, so the screen
// carries no subtitle. The shot day is already settled two screens back.
export default function ReminderTimeScreen() {
  const reminder = useOnboardingStore((state) => state.reminder);
  const setReminderTime = useOnboardingStore((state) => state.setReminderTime);

  return (
    <OnboardingStep step="reminder-time" title="What time suits you?">
      {/* Five minute rows. A reminder is a time somebody picks, not a time
          somebody records, so the whole hour is one flick away. */}
      <InlineTimePicker value={reminder.time} onChange={setReminderTime} minuteStep={5} />
    </OnboardingStep>
  );
}
