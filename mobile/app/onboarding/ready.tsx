import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Check } from 'lucide-react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { LineChart } from '@/components/LineChart';
import { OnboardingScreen } from '@/components/OnboardingScreen';
import { Text } from '@/components/Text';
import { completeOnboarding } from '@/services/onboarding';
import { buildOnboardingPlan, type OnboardingPlan, type PlanMedication } from '@/services/onboardingPlan';
import { useAppStore } from '@/stores/app';
import { isProNow, paywallEnabledNow } from '@/stores/entitlement';
import {
  CONCERN_OPTIONS,
  GOAL_OPTIONS,
  getOnboardingDraft,
  onboardingTotalSteps,
  postScheduleStepIndex,
  useOnboardingStore,
} from '@/stores/onboarding';
import { colors, spacing } from '@/theme';

// How long the build beat runs. Long enough to read the four lines, short
// enough that nobody waits for it. Reduce Motion skips it completely.
const BUILD_STEP_MS = 340;
const CURVE_CARDS = 2;
const CHART_HEIGHT = 148;

export default function ReadyScreen() {
  const medicationIds = useOnboardingStore((state) => state.medicationIds);
  const schedules = useOnboardingStore((state) => state.schedules);
  const goalKind = useOnboardingStore((state) => state.goalKind);
  const concerns = useOnboardingStore((state) => state.concerns);
  const reminder = useOnboardingStore((state) => state.reminder);
  const weight = useOnboardingStore((state) => state.weight);
  const setGate = useOnboardingStore((state) => state.setGate);
  const resetDraft = useOnboardingStore((state) => state.resetDraft);
  const bumpVersion = useAppStore((state) => state.bumpVersion);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalSteps = onboardingTotalSteps(medicationIds.length);
  const step = postScheduleStepIndex(medicationIds.length, 'ready');

  const goalLabel = GOAL_OPTIONS.find((goal) => goal.id === goalKind)?.label;
  const concernLabels = CONCERN_OPTIONS
    .filter((option) => option.id !== 'none' && concerns.includes(option.id))
    .map((option) => option.label.toLocaleLowerCase());
  const everyMedicationScheduled = medicationIds.length > 0
    && medicationIds.every((id) => Boolean(schedules[id]));
  const validPlan = Boolean(everyMedicationScheduled && goalLabel && concerns.length > 0);

  // Built once, from the draft, before anything is written. The same numbers
  // the app will show on Today after the button is pressed.
  const plan = useMemo<OnboardingPlan | null>(() => {
    if (!validPlan) return null;
    return buildOnboardingPlan(getOnboardingDraft(useOnboardingStore.getState()), Date.now());
    // The draft is frozen at this point in the flow; the medication list is the
    // only thing that can still change it, and changing it re-enters the flow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validPlan, medicationIds, schedules, reminder.time]);

  const built = useBuildBeat(validPlan, plan?.curveCount ?? 0);

  const finish = async () => {
    if (!validPlan || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const draft = getOnboardingDraft(useOnboardingStore.getState());
      await completeOnboarding(draft);
      setGate({ kind: 'complete' });
      bumpVersion();
      resetDraft();
      // Land on Today first, then raise the paywall over it. Seeing the app you
      // just set up behind the sheet beats a wall in front of an empty room, and
      // dismissing leaves you already home.
      router.replace('/');
      if (paywallEnabledNow() && !isProNow()) {
        router.push('/paywall?from=onboarding');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Poke could not save your plan. Try again.');
      setSubmitting(false);
    }
  };

  if (!validPlan || !plan) {
    return (
      <OnboardingScreen
        step={step}
        totalSteps={totalSteps}
        backHref="/onboarding/reminders"
        title="Finish your setup."
        footer={(
          <Button onPress={() => router.replace('/onboarding/taking')}>
            Go back to the first question
          </Button>
        )}
      >
        <Text color={colors.inkMuted}>Poke needs a few more answers.</Text>
      </OnboardingScreen>
    );
  }

  if (!built.done) {
    return (
      <OnboardingScreen
        step={step}
        totalSteps={totalSteps}
        title="Building your plan"
        subtitle="Poke is doing the arithmetic on what you entered."
        footer={<View />}
      >
        <View style={styles.buildList}>
          {built.labels.map((label, index) => (
            <BuildRow key={label} label={label} done={index < built.completed} />
          ))}
        </View>
      </OnboardingScreen>
    );
  }

  const curves = plan.medications.filter((medication) => medication.curve).slice(0, CURVE_CARDS);
  const hiddenCurves = plan.curveCount - curves.length;

  return (
    <OnboardingScreen
      step={step}
      totalSteps={totalSteps}
      backHref="/onboarding/reminders"
      title="Your plan is ready."
      subtitle={plan.curveCount > 0
        ? 'Every number here comes from your answers and a published half-life.'
        : 'Every number here comes from the answers you entered.'}
      footer={(
        <View style={styles.actions}>
          {error ? <Text selectable color={colors.danger} align="center">{error}</Text> : null}
          {/* `completeOnboarding` writes `disclaimer_accepted_at`, so this button
              is the acceptance. The text must therefore be on this screen. */}
          <Text variant="small" color={colors.inkMuted} align="center" style={styles.disclaimer}>
            Poke keeps a record of what you enter. Poke gives no medical advice, no
            diagnosis and no dose instructions. Speak to your clinician about your
            treatment. Continue to agree.
          </Text>
          <Button disabled={submitting} onPress={finish}>
            {submitting ? 'Saving your plan' : 'Start tracking'}
          </Button>
        </View>
      )}
    >
      <NextShotCard plan={plan} />

      {curves.map((medication) => (
        <CurveCard key={medication.id} medication={medication} />
      ))}
      {hiddenCurves > 0 ? (
        <Text variant="small" color={colors.inkMuted}>
          {hiddenCurves === 1
            ? 'One more level curve is on your Today screen.'
            : `${hiddenCurves} more level curves are on your Today screen.`}
        </Text>
      ) : null}

      <Card padding="xl" style={styles.card}>
        <Text variant="smallStrong" color={colors.inkMuted}>Your routine</Text>
        {plan.medications.map((medication) => (
          <View key={medication.id} style={styles.routineRow}>
            <Text variant="bodyStrong">{medication.name}</Text>
            <Text variant="small" color={colors.inkMuted}>
              {medication.doseLabel} · {medication.scheduleLabel} · {medication.shotsInFourWeeks} shots in 4 weeks
            </Text>
            {medication.curve ? null : (
              <Text variant="small" color={colors.inkMuted}>
                No published half-life, so no level curve.
              </Text>
            )}
          </View>
        ))}

        {plan.sites.length > 0 ? (
          <PlanRow label="First sites" value={plan.sites.join(' → ')} />
        ) : null}
        <PlanRow label="Goal" value={goalLabel ?? ''} />
        {weight.kind === 'entered' ? (
          <PlanRow
            label="Weight"
            value={`${weight.currentText.trim()} ${weight.unit} now · goal ${weight.goalText.trim()} ${weight.unit}`}
          />
        ) : null}
        <PlanRow
          label="Watch list"
          value={concernLabels.length > 0 ? concernLabels.join(' · ') : 'Nothing right now'}
        />
        {reminder.kind === 'enabled' ? (
          <PlanRow label="Reminder" value={`Every shot day at ${reminder.time}`} />
        ) : null}
      </Card>
    </OnboardingScreen>
  );
}

function NextShotCard({ plan }: { plan: OnboardingPlan }) {
  if (!plan.nextShot) {
    return (
      <Card padding="xl" style={styles.card}>
        <Text variant="smallStrong" color={colors.inkMuted}>Next shot</Text>
        <Text color={colors.inkMuted}>
          You have no shot day set yet. Add one from Today when you are ready.
        </Text>
      </Card>
    );
  }
  const { name, at } = plan.nextShot;
  return (
    <Card padding="xl" style={styles.card}>
      <Text variant="smallStrong" color={colors.inkMuted}>Next shot</Text>
      <Text variant="display">{countdownLabel(at)}</Text>
      <Text color={colors.inkMuted}>{name} · {longDate(at)}</Text>
    </Card>
  );
}

function CurveCard({ medication }: { medication: PlanMedication }) {
  const [width, setWidth] = useState(0);
  const curve = medication.curve;
  if (!curve) return null;

  // A short half-life does not plateau, so "steady" would misdescribe it. The
  // curve returns near zero between doses, and the honest line says that.
  const steady = curve.clearsBetweenDoses
    ? 'Each dose clears before the next one.'
    : curve.steadyWeek
      ? `Estimated level is steady from week ${curve.steadyWeek}.`
      : 'Estimated level is still rising at week 4.';

  return (
    <Card padding="xl" style={styles.card}>
      <Text variant="smallStrong" color={colors.inkMuted}>
        {medication.name} · first 4 weeks
      </Text>
      <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={styles.chartHolder}>
        {width > 0 ? (
          <LineChart
            data={curve.points}
            width={width}
            height={CHART_HEIGHT}
            color={colors.chartLine}
            yLabel={(value) => `${round(value)}`}
            xLabel={(t) => weekLabel(t, curve.points[0]?.t ?? t)}
            xTickCount={5}
            yTickCount={3}
          />
        ) : null}
      </View>
      <Text variant="bodyStrong">{steady}</Text>
      <Text variant="small" color={colors.inkMuted}>
        The curve is in {curve.unit}. Poke draws the curve from your dose and your
        schedule. {medication.evidenceNote}
      </Text>
    </Card>
  );
}

function BuildRow({ label, done }: { label: string; done: boolean }) {
  return (
    <View style={styles.buildRow} accessibilityRole="text" accessibilityLabel={`${label}${done ? ', done' : ''}`}>
      <View style={[styles.buildDot, done && styles.buildDotDone]}>
        {done ? <Check size={12} strokeWidth={3} color={colors.inkInverse} /> : null}
      </View>
      <Text color={done ? colors.ink : colors.inkMuted}>{label}</Text>
    </View>
  );
}

function PlanRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.planRow}>
      <Text variant="small" color={colors.inkMuted}>{label}</Text>
      <Text variant="bodyStrong" align="right" style={styles.planValue}>{value}</Text>
    </View>
  );
}

// The build beat. The work behind each line is real and already done — the
// pacing only gives the user time to read what Poke worked out. Reduce Motion
// goes straight to the plan.
function useBuildBeat(active: boolean, curveCount: number) {
  const labels = useMemo(() => [
    'Reading your schedule',
    'Finding your next shot day',
    curveCount > 0 ? 'Drawing your level curve' : 'Checking your half-life sources',
    'Choosing your first injection sites',
  ], [curveCount]);

  const [completed, setCompleted] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduceMotion) => {
        if (cancelled) return;
        if (reduceMotion) {
          setCompleted(labels.length);
          setDone(true);
          return;
        }
        labels.forEach((_, index) => {
          timers.push(setTimeout(() => {
            if (!cancelled) setCompleted(index + 1);
          }, BUILD_STEP_MS * (index + 1)));
        });
        timers.push(setTimeout(() => {
          if (!cancelled) setDone(true);
        }, BUILD_STEP_MS * (labels.length + 1)));
      })
      .catch(() => {
        if (cancelled) return;
        setCompleted(labels.length);
        setDone(true);
      });

    return () => {
      cancelled = true;
      for (const timer of timers) clearTimeout(timer);
    };
  }, [active, labels]);

  return { labels, completed, done };
}

function round(value: number): string {
  if (value >= 100) return value.toFixed(0);
  if (value >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

function startOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function countdownLabel(at: number): string {
  const days = Math.round((startOfDay(at) - startOfDay(Date.now())) / (24 * 60 * 60 * 1000));
  if (days <= 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

function longDate(at: number): string {
  return new Date(at).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });
}

function weekLabel(t: number, from: number): string {
  const week = Math.round((t - from) / (7 * 24 * 60 * 60 * 1000));
  return week === 0 ? 'now' : `w${week}`;
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  chartHolder: {
    width: '100%',
    height: CHART_HEIGHT,
    paddingTop: spacing.xs,
  },
  routineRow: {
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingTop: spacing.xs,
  },
  planValue: {
    flex: 1,
  },
  buildList: {
    gap: spacing.lg,
  },
  buildRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  buildDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buildDotDone: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  disclaimer: {
    maxWidth: 340,
    alignSelf: 'center',
  },
  actions: {
    gap: spacing.md,
  },
});
