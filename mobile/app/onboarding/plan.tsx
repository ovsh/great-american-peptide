import { useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { CircleCheck } from 'lucide-react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { LineChart } from '@/components/LineChart';
import { OnboardingScreen } from '@/components/OnboardingScreen';
import { Slider } from '@/components/Slider';
import { Text } from '@/components/Text';
import { completeOnboarding } from '@/services/onboarding';
import {
  buildOnboardingPlan,
  planProjection,
  type OnboardingPlan,
  type PlanMedication,
  type PlanProjection,
} from '@/services/onboardingPlan';
import { useAppStore } from '@/stores/app';
import { isProNow, paywallEnabledNow } from '@/stores/entitlement';
import {
  CONCERN_OPTIONS,
  GOAL_OPTIONS,
  getOnboardingDraft,
  paceBounds,
  useOnboardingStore,
} from '@/stores/onboarding';
import { colors, radius, spacing } from '@/theme';
import { fmtClock } from '@/utils/date';

const CURVE_CARDS = 2;
const CHART_HEIGHT = 148;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The reveal. Recording step 28.
 *
 * It sits outside the counted steps and has no back chevron, exactly as it does
 * in the recording: the flow is over, and the only way on is through the button
 * that saves it.
 *
 * The one thing this screen does that the rest of the app does not is project a
 * date. It is division, it is labelled as division on the card itself, and the
 * line that says so is not decoration. See the header of
 * `services/onboardingPlan.ts`.
 */
export default function PlanScreen() {
  const medicationIds = useOnboardingStore((state) => state.medicationIds);
  const schedules = useOnboardingStore((state) => state.schedules);
  const goalKind = useOnboardingStore((state) => state.goalKind);
  const concerns = useOnboardingStore((state) => state.concerns);
  const reminder = useOnboardingStore((state) => state.reminder);
  const weight = useOnboardingStore((state) => state.weight);
  const pace = useOnboardingStore((state) => state.pace);
  const setPace = useOnboardingStore((state) => state.setPace);
  const setGate = useOnboardingStore((state) => state.setGate);
  const resetDraft = useOnboardingStore((state) => state.resetDraft);
  const bumpVersion = useAppStore((state) => state.bumpVersion);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // One clock for the whole screen, read once at mount. The pace slider below
  // recomputes the goal date on every drag, and a `Date.now()` read inside that
  // recompute would move the day the count starts from at the same time as the
  // pace moves the length of the count. Two moving inputs, one visible number.
  const now = useRef(Date.now()).current;

  const goalLabel = GOAL_OPTIONS.find((goal) => goal.id === goalKind)?.label;
  const concernLabels = CONCERN_OPTIONS
    .filter((option) => option.id !== 'none' && concerns.includes(option.id))
    .map((option) => option.label.toLocaleLowerCase());
  const everyMedicationScheduled = medicationIds.length > 0
    && medicationIds.every((id) => Boolean(schedules[id]));
  const validPlan = Boolean(everyMedicationScheduled && goalLabel && concerns.length > 0);

  // Built once, from the draft, before anything is written. The same numbers the
  // app will show on Today after the button is pressed.
  const plan = useMemo<OnboardingPlan | null>(() => {
    if (!validPlan) return null;
    return buildOnboardingPlan(getOnboardingDraft(useOnboardingStore.getState()), now);
    // The draft is frozen at this point in the flow; the medication list is the
    // only thing that can still change it, and changing it re-enters the flow.
    // The pace is the exception, and it drives `liveProjection` instead: nothing
    // else on this screen depends on it, and rebuilding four weeks of pk curves
    // on every frame of a drag would drop the slider.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validPlan, medicationIds, schedules, reminder.time, now]);

  // The pace slider on the reveal is the same control as the pace screen, bound
  // to the same store field. It is here because the date is the one number in
  // the flow a user might read as Poke's opinion, and a number that moves when
  // you move its input reads as arithmetic instead.
  const liveProjection = useMemo(
    () => planProjection(weight, pace, now),
    [weight, pace, now],
  );

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
        step={0}
        totalSteps={1}
        hideProgress
        title="Finish your setup."
        footer={(
          <Button onPress={() => router.replace('/onboarding/taking')}>
            Go back to your medications
          </Button>
        )}
      >
        <Text color={colors.inkMuted}>Poke needs a few more answers.</Text>
      </OnboardingScreen>
    );
  }

  const curves = plan.medications.filter((medication) => medication.curve).slice(0, CURVE_CARDS);
  const hiddenCurves = plan.curveCount - curves.length;

  return (
    <OnboardingScreen
      step={0}
      totalSteps={1}
      hideProgress
      title="Your plan is ready"
      subtitle={plan.curveCount > 0
        ? 'Every number here comes from your answers and a published half-life.'
        : 'Every number here comes from the answers you entered.'}
      footer={(
        <View style={styles.actions}>
          {error ? <Text selectable color={colors.danger} align="center">{error}</Text> : null}
          {/* `completeOnboarding` writes `disclaimer_accepted_at`, so this button
              is the acceptance. The text must therefore be on this screen.
              The last sentence names no button on purpose. It used to read
              "Continue to agree.", which named a control this screen does not
              have, and `.claude/rules/copy.md` forbids a button label inside
              legal text precisely so a label change cannot falsify it.
              `store.config.json` review notes quote this screen word for word,
              so change both together or neither. Owner approved 8 Aug 2026. */}
          <Text variant="small" color={colors.inkMuted} align="center" style={styles.disclaimer}>
            Poke keeps a record of what you enter. Poke gives no medical advice, no
            diagnosis and no dose instructions. Speak to your clinician about your
            treatment. By finishing setup you agree.
          </Text>
          <Button disabled={submitting} onPress={finish}>
            {submitting ? 'Saving your plan' : 'Start tracking'}
          </Button>
        </View>
      )}
    >
      <View style={styles.crest}>
        <CircleCheck size={20} color={colors.accent} />
        <Text variant="smallStrong" color={colors.accent}>Setup complete</Text>
      </View>

      {plan.projection ? (
        <ProjectionCard
          anchor={plan.projection}
          live={liveProjection}
          pace={pace}
          onPaceChange={setPace}
        />
      ) : null}

      <NextShotCard plan={plan} />

      {curves.map((medication) => (
        <CurveCard key={medication.id} medication={medication} />
      ))}
      {/* Today draws a level card per medication, not a curve. The curve is one
          tap further in, at `/reports/level`. Name the tap. */}
      {hiddenCurves > 0 ? (
        <Text variant="small" color={colors.inkMuted}>
          {hiddenCurves === 1
            ? 'Your other medication has its own card on Today. Tap the card for the full curve.'
            : `Your other ${hiddenCurves} medications each have a card on Today. Tap a card for the full curve.`}
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
        {plan.body ? (
          <PlanRow label="BMI" value={`${plan.body.value.toFixed(1)} · ${plan.body.category.toLocaleLowerCase()}`} />
        ) : null}
        <PlanRow
          label="Watch list"
          value={concernLabels.length > 0 ? concernLabels.join(' · ') : 'Nothing right now'}
        />
        {reminder.kind === 'enabled' ? (
          <PlanRow label="Reminder" value={`Every shot day at ${fmtClock(reminder.time)}`} />
        ) : null}
      </Card>
    </OnboardingScreen>
  );
}

interface ProjectionCardProps {
  /** The weights and the direction, taken at mount. Only the pace moves. */
  anchor: PlanProjection;
  /** The same sum at the live pace. Null once the answer runs past five years. */
  live: PlanProjection | null;
  pace: number;
  onPaceChange: (pace: number) => void;
}

/**
 * The payoff card, and the only forward-looking number Poke shows.
 *
 * MeAgain draws the same card, puts a decorative slider under it, and lets the
 * date read as a prediction. Poke draws the same card and then does two things
 * MeAgain does not: it says in the card what the number is, and it wires the
 * slider to the sum. Drag the pace and the date moves the same instant.
 *
 * Both of those are load-bearing. The sentence is the claim Poke is allowed to
 * make, and the live slider is what makes the claim visibly arithmetic. Do not
 * remove the sentence, and do not let the slider go decorative.
 */
function ProjectionCard({ anchor, live, pace, onPaceChange }: ProjectionCardProps) {
  const { current, goal, unit, direction } = anchor;
  const verb = direction === 'down' ? 'lose' : 'gain';
  const distance = Math.abs(current - goal);
  const bounds = paceBounds(unit);
  const step = unit === 'lb' ? 0.1 : 0.05;
  const formatPace = (value: number) => `${value.toFixed(unit === 'lb' ? 1 : 2)} ${unit}`;

  return (
    <Card padding="xl" style={styles.card}>
      <Text variant="smallStrong" color={colors.inkMuted}>Your goal, at the pace you chose</Text>
      {live ? (
        <>
          <Text variant="display">{longDate(live.reachesAt)}</Text>
          <Text color={colors.inkMuted}>
            {formatWeight(distance)} {unit} to {verb} at {formatPace(live.pace)} a week
            is {formatSpan(live.reachesAt)}.
          </Text>
        </>
      ) : (
        // Reachable from the slider alone: the low end of the range against a
        // long distance runs past `MAX_PROJECTION_WEEKS`. The card stays put so
        // the drag stays alive, and it says what happened rather than a date.
        <>
          <Text variant="display">Over five years</Text>
          <Text color={colors.inkMuted}>
            {formatWeight(distance)} {unit} to {verb} at {formatPace(pace)} a week runs
            past five years. Poke puts no date on that.
          </Text>
        </>
      )}

      <View style={styles.track}>
        <View style={styles.trackFill} />
      </View>
      <View style={styles.trackLabels}>
        <View>
          <Text variant="smallStrong">{formatWeight(current)} {unit}</Text>
          <Text variant="caption" color={colors.inkSubtle}>Today</Text>
        </View>
        <View style={styles.trackEnd}>
          <Text variant="smallStrong" align="right">{formatWeight(goal)} {unit}</Text>
          <Text variant="caption" color={colors.inkSubtle} align="right">Your goal</Text>
        </View>
      </View>

      <View style={styles.paceHead}>
        <Text variant="smallStrong" color={colors.inkMuted}>Weekly pace</Text>
        <Text variant="smallStrong">{formatPace(pace)} a week</Text>
      </View>
      <Slider
        value={pace}
        min={bounds.min}
        max={bounds.max}
        step={step}
        onChange={onPaceChange}
        accessibilityLabel="Weekly pace"
        format={formatPace}
      />

      <Text variant="small" color={colors.inkMuted}>
        That date is your distance divided by the pace you set. It is arithmetic on
        two numbers you typed. It is not a forecast, and no model of your body
        stands behind it. Move the pace above and watch the date move with it.
        Speak to your clinician about the pace that suits you.
      </Text>
    </Card>
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

function PlanRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.planRow}>
      <Text variant="small" color={colors.inkMuted}>{label}</Text>
      <Text variant="bodyStrong" align="right" style={styles.planValue}>{value}</Text>
    </View>
  );
}

function formatWeight(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/**
 * How far off the printed date is, in a unit the reader can check against it.
 *
 * The date carries the raw division out to the hour. A week count that rounds on
 * its own then contradicts it: at 1.6 lb a week over 6 lb the card printed "4
 * weeks" above a date 26 days away. So measure the span from the date the card
 * already shows, and the two cannot disagree. Days are exact against a calendar.
 * Weeks read better and are used only where the span is whole weeks. Past two
 * months a day count stops meaning anything, and "about" carries the rounding.
 */
function formatSpan(reachesAt: number): string {
  const days = Math.max(1, Math.round((startOfDay(reachesAt) - startOfDay(Date.now())) / DAY_MS));
  if (days >= 56) {
    const months = Math.round(days / 30.44);
    return months === 1 ? 'about a month' : `about ${months} months`;
  }
  if (days % 7 === 0) return days === 7 ? 'one week' : `${days / 7} weeks`;
  return days === 1 ? 'one day' : `${days} days`;
}

function startOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function countdownLabel(at: number): string {
  const days = Math.round((startOfDay(at) - startOfDay(Date.now())) / DAY_MS);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

function longDate(at: number): string {
  return new Date(at).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function weekLabel(t: number, from: number): string {
  const week = Math.round((t - from) / (7 * 24 * 60 * 60 * 1000));
  return week === 0 ? 'now' : `w${week}`;
}

const styles = StyleSheet.create({
  crest: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  card: {
    gap: spacing.sm,
  },
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  // The bar is the distance itself, not a progress reading. Nothing has happened
  // yet, so it fills the whole track and the two ends carry the numbers.
  trackFill: {
    height: '100%',
    width: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  trackLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  trackEnd: {
    alignItems: 'flex-end',
  },
  paceHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingTop: spacing.md,
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
  disclaimer: {
    maxWidth: 340,
    alignSelf: 'center',
  },
  actions: {
    gap: spacing.md,
  },
});
