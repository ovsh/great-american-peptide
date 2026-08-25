import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { CircleCheck, Info } from 'lucide-react-native';

import { BottomSheet } from '@/components/BottomSheet';
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
  formatPace,
  formatPaceRate,
  getOnboardingDraft,
  goalLabel as goalLabelFor,
  MAINTAIN_PACE_LABEL,
  paceBounds,
  useOnboardingStore,
} from '@/stores/onboarding';
import {
  beatDelay,
  colors,
  easing,
  motion,
  planBeats,
  radius,
  rise,
  spacing,
  timeTo,
} from '@/theme';
import { fmtClock } from '@/utils/date';

const CURVE_CARDS = 2;
const CHART_HEIGHT = 148;
const DAY_MS = 24 * 60 * 60 * 1000;
/** The dot that rides the goal bar, and the height of the row it rides in. */
const DOT_SIZE = 14;

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

  // `goalLabelFor` covers the legacy goal ids too, so a draft restored from an
  // old install still names its goal instead of failing `validPlan`.
  const goalLabel = goalKind ? goalLabelFor(goalKind) : undefined;
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
      // The offer is the last screen of setup, and it replaces this one rather
      // than opening over Today. The plan is still on the screen the user came
      // from, so the curve the paywall sells is the curve they just read.
      //
      // It replaces, so setup cannot be walked back into, and the paywall sends
      // every exit on to Today. The `✕` is on it and it works, so this is the
      // end of setup and not a wall: `docs/meagain-onboarding-adaptation.md`.
      //
      // A user who already holds Pro skips it. `isProNow` covers all three
      // ways: a redeemed tester code, an active subscription, and a store Poke
      // cannot sell through at all.
      if (paywallEnabledNow() && !isProNow()) {
        router.replace('/paywall?source=onboarding_plan');
      } else {
        router.replace('/');
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
      // The cards below are the answer. A line over them saying where the
      // numbers came from only delays the numbers, and each card that needs a
      // source now carries its own.
      bodyStyle={styles.body}
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
              so change both together or neither. Owner approved 8 Aug 2026.

              It sits on its own solid plate, and it never moves. The cards
              above it arrive; this does not, because motion rule 8 says legal
              copy does not animate, and because the plate is what stops a card
              scrolling up behind the words the button agrees to. */}
          <View style={styles.disclaimerPlate}>
            <Text variant="small" color={colors.inkMuted} align="center" style={styles.disclaimer}>
              Poke keeps a record of what you enter. Poke gives no medical advice, no
              diagnosis and no dose instructions. Speak to your clinician about your
              treatment. By finishing setup you agree.
            </Text>
          </View>
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
            {/* Two lines, because one sentence cannot hold a rate and a count
                without a comma the schedule label may already have spent.
                A deferred answer reads as the words "not set yet" rather than
                as a blank, and the shot count is dropped rather than printed as
                a zero, because zero is not what the run found out. */}
            <Text variant="small" color={colors.inkMuted}>
              {medication.doseSet && medication.scheduleSet
                ? `${medication.doseLabel} ${lowerFirst(medication.scheduleLabel)}`
                : unsetLine(medication.doseSet, medication.scheduleSet)}
            </Text>
            {medication.doseSet && medication.scheduleSet ? (
              <Text variant="small" color={colors.inkMuted}>
                {medication.shotsInFourWeeks} shots in the first 4 weeks
              </Text>
            ) : (
              <Text variant="small" color={colors.inkMuted}>
                Finish this one in Medications whenever you are ready.
              </Text>
            )}
            {/* Why there is no curve. A medication that is still waiting for an
                answer has no curve either, and the line above already gives the
                reason, so naming the half-life here would state a second reason
                that is not true. */}
            {medication.curve === null && medication.doseSet && medication.scheduleSet ? (
              <Text variant="small" color={colors.inkMuted}>
                No published half-life, so no level curve.
              </Text>
            ) : null}
          </View>
        ))}

        {plan.sites.length > 0 ? (
          <PlanRow label="First sites" value={plan.sites.join(' → ')} />
        ) : null}
        <PlanRow label="Goal" value={goalLabel ?? ''} />
        {plan.body ? (
          <PlanRow label="BMI" value={`${plan.body.value.toFixed(1)} in the ${plan.body.category.toLocaleLowerCase()} range`} />
        ) : null}
        <PlanRow
          label="Watch list"
          value={concernLabels.length > 0 ? namedList(concernLabels) : 'Nothing right now'}
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
  const { current, goal, unit } = anchor;
  // The verb reads off the two weights and not off `anchor.direction`. The
  // anchor is the sum as it stood at mount, a mount at a maintain pace carries
  // no direction at all, and the weights themselves never move on this screen.
  const verb = goal < current ? 'lose' : 'gain';
  const distance = Math.abs(current - goal);
  const bounds = paceBounds(unit);
  const step = unit === 'lb' ? 0.1 : 0.05;
  const paceLabel = (value: number) => formatPace(value, unit);
  // The user set no rate of change. There is no date, so nothing on this card
  // may name one, and the sentences below swap rather than fill a blank.
  const maintaining = live !== null && live.kind === 'maintain';

  const reduced = useReducedMotion();
  const date = useSharedValue(0);
  const bar = useSharedValue(0);
  const fill = useSharedValue(0);

  useEffect(() => {
    date.value = timeTo(1, { duration: motion.base, easing: easing.out, reduced });
    bar.value = timeTo(1, {
      duration: motion.base,
      easing: easing.out,
      delay: beatDelay(planBeats.bar, reduced),
      reduced,
    });
    fill.value = timeTo(1, {
      duration: motion.slow,
      easing: easing.out,
      delay: beatDelay(planBeats.fill, reduced),
      reduced,
    });
  }, [bar, date, fill, reduced]);

  const dateStyle = useAnimatedStyle(() => ({
    opacity: date.value,
    transform: [{ translateY: (1 - date.value) * rise.line }],
  }));
  const barStyle = useAnimatedStyle(() => ({
    opacity: bar.value,
    transform: [{ translateY: (1 - bar.value) * rise.line }],
  }));
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  const dotStyle = useAnimatedStyle(() => ({
    opacity: fill.value,
    left: `${fill.value * 100}%`,
  }));

  return (
    <Card padding="xl" style={styles.card}>
      <Animated.View style={[styles.headline, dateStyle]}>
        <Text variant="smallStrong" color={colors.inkMuted}>
          {maintaining ? 'Your plan, at the pace you set' : 'Your goal, at the pace you chose'}
        </Text>
        {live === null ? (
          // Reachable from the slider alone: the low end of the range against a
          // long distance runs past `MAX_PROJECTION_WEEKS`. The card stays put so
          // the drag stays alive, and it says what happened rather than a date.
          <>
            <Text variant="display">Over five years</Text>
            <Text color={colors.inkMuted}>
              {formatWeight(distance)} {unit} to {verb} at {paceLabel(pace)} a week runs
              past five years. Poke puts no date on that.
            </Text>
          </>
        ) : live.kind === 'maintain' ? (
          // The maintain branch states what the user set and nothing else. It
          // names no verb, because the user chose neither direction, and it
          // carries no line about stopping or holding a loss, because that
          // would be Poke advising a rate of change.
          <>
            <Text variant="display">{MAINTAIN_PACE_LABEL}</Text>
            <Text color={colors.inkMuted}>
              You set your weekly pace to zero. Poke projects no date and records every
              weight you log.
            </Text>
          </>
        ) : (
          <Text variant="display">{longDate(live.reachesAt)}</Text>
        )}
      </Animated.View>

      {/* The bar is the distance, and the two ends carry the numbers, so the
          dot rests on the goal end rather than anywhere between them. */}
      <Animated.View style={[styles.bar, barStyle]}>
        <View style={styles.track}>
          <Animated.View style={[styles.trackFill, fillStyle]} />
        </View>
        <Animated.View pointerEvents="none" style={[styles.paceDot, dotStyle]} />
      </Animated.View>
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
        <Text variant="smallStrong">{formatPaceRate(pace, unit)}</Text>
      </View>
      <Slider
        value={pace}
        min={bounds.min}
        max={bounds.max}
        step={step}
        onChange={onPaceChange}
        accessibilityLabel="Weekly pace"
        format={paceLabel}
      />

      {/* The card has to name its own arithmetic. `store.config.json` review
          notes promise App Review that this screen says where the date comes
          from, and the slider above is what makes the claim checkable: move the
          pace and the date moves with it. Two sentences, and no more.
          The first of the two is the claim App Review reads, so it stands in
          both variants word for word. Only the second moves: at a pace of zero
          there is no date to call a forecast. */}
      <Text variant="small" color={colors.inkMuted}>
        {maintaining
          ? 'The date is your distance divided by your pace. A pace of zero gives no date.'
          : 'The date is your distance divided by your pace. It is not a forecast.'}
      </Text>
    </Card>
  );
}

function NextShotCard({ plan }: { plan: OnboardingPlan }) {
  if (!plan.nextShot) {
    return (
      <Card padding="xl" style={styles.card}>
        <Text variant="smallStrong" color={colors.inkMuted}>Next shot</Text>
        {/* Reached when every medication is still waiting for a dose or for a
            schedule. Medications is where those rows are, so it names that
            screen rather than Today. */}
        <Text color={colors.inkMuted}>
          You have no shot day set yet. Set one in Medications whenever you are ready.
        </Text>
      </Card>
    );
  }
  const { name, at } = plan.nextShot;
  return (
    <Card padding="xl" style={styles.card}>
      <Text variant="smallStrong" color={colors.inkMuted}>Next shot</Text>
      <Text variant="display">{countdownLabel(at)}</Text>
      <Text color={colors.inkMuted}>{name} on {longDate(at)}</Text>
    </Card>
  );
}

/**
 * One medication's first four weeks.
 *
 * What the curve is drawn from is a disclosure, not a caption: principles §6
 * puts it behind the (i) and keeps the words themselves word for word. The
 * chart draws itself once, under a wipe that crosses at a constant rate.
 */
function CurveCard({ medication }: { medication: PlanMedication }) {
  const [width, setWidth] = useState(0);
  const [aboutOpen, setAboutOpen] = useState(false);
  const reduced = useReducedMotion();
  const draw = useSharedValue(0);

  useEffect(() => {
    draw.value = timeTo(1, {
      duration: motion.draw,
      easing: easing.linear,
      delay: beatDelay(planBeats.curve, reduced),
      reduced,
    });
  }, [draw, reduced]);

  const curtainStyle = useAnimatedStyle(() => ({ left: `${draw.value * 100}%` }));

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
      <View style={styles.curveHead}>
        <Text variant="smallStrong" color={colors.inkMuted} style={styles.curveTitle}>
          {medication.name} over the first 4 weeks
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="About this curve"
          hitSlop={8}
          onPress={() => setAboutOpen(true)}
          style={({ pressed }) => [styles.infoButton, pressed && styles.pressed]}
        >
          <Info size={18} color={colors.inkSubtle} />
        </Pressable>
      </View>
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
        <Animated.View pointerEvents="none" style={[styles.curtain, curtainStyle]} />
      </View>
      <Text variant="bodyStrong">{steady}</Text>

      <BottomSheet
        visible={aboutOpen}
        title="About this curve"
        onClose={() => setAboutOpen(false)}
      >
        <View style={styles.aboutBody}>
          <Text>
            The curve is in {curve.unit}. Poke draws the curve from your dose and your
            schedule. {medication.evidenceNote}
          </Text>
        </View>
      </BottomSheet>
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

// The schedule label opens a sentence the dose already started, so it drops
// its capital: "0.5 mg every week on Monday".
function lowerFirst(value: string): string {
  return value.charAt(0).toLocaleLowerCase() + value.slice(1);
}

/**
 * What the routine line says when the user passed on one of the two answers.
 *
 * It names what is missing rather than showing a blank or a zero, and it never
 * fills the gap in. Both flags true never reaches here.
 */
function unsetLine(doseSet: boolean, scheduleSet: boolean): string {
  if (!doseSet && !scheduleSet) return 'Dose and schedule not set yet.';
  return doseSet ? 'Schedule not set yet.' : 'Dose not set yet.';
}

// A watch list is a list, so it reads as one. Commas up to the last name, and
// "and" before it.
function namedList(values: string[]): string {
  if (values.length <= 1) return values.join('');
  return `${values.slice(0, -1).join(', ')} and ${values[values.length - 1]}`;
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
  // The whole list clears the pinned footer. Without the inset the last card
  // stops half drawn against the consent text, which reads as a broken card.
  body: {
    paddingBottom: spacing.hero,
  },
  headline: {
    gap: spacing.sm,
  },
  bar: {
    height: DOT_SIZE,
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    overflow: 'hidden',
  },
  // The bar is the distance itself, not a progress reading. Nothing has happened
  // yet, so it fills the whole track and the two ends carry the numbers.
  trackFill: {
    height: '100%',
    width: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  paceDot: {
    position: 'absolute',
    width: DOT_SIZE,
    height: DOT_SIZE,
    marginLeft: -DOT_SIZE / 2,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.surface,
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
  curveHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  curveTitle: {
    flex: 1,
  },
  infoButton: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -8,
  },
  pressed: {
    opacity: 0.72,
  },
  aboutBody: {
    paddingBottom: spacing.md,
  },
  chartHolder: {
    width: '100%',
    height: CHART_HEIGHT,
    paddingTop: spacing.xs,
    overflow: 'hidden',
  },
  // The card is the surface the chart sits on, so the wipe is the same colour
  // and reads as the curve drawing itself rather than as a shape passing over.
  curtain: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
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
  disclaimerPlate: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  disclaimer: {
    maxWidth: 340,
    alignSelf: 'center',
  },
  actions: {
    gap: spacing.md,
  },
});
