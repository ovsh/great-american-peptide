import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { ChevronRight, Info } from 'lucide-react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { OnboardingScreen } from '@/components/OnboardingScreen';
import { PLAN_CHART_HEIGHT, PlanLevelCurve } from '@/components/plan-level-curve';
import { Slider } from '@/components/Slider';
import { Text } from '@/components/Text';
import { completeOnboarding } from '@/services/onboarding';
import {
  buildOnboardingPlan,
  planProjection,
  type OnboardingPlan,
  type PlanCurve,
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
import { goalFraming } from '@/utils/goalFraming';

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
 * The screen is a picture and three quiet lines, in that order. It used to be
 * six cards of prose, and the owner's note on 23 Aug 2026 was that the payoff of
 * the whole funnel read as a report. So the level curve is the hero, it draws
 * itself once, and every sentence that only explained the app rather than
 * stating a fact about this user came off. What is left is what only Poke can
 * work out: the curve, the goal date, the next shot. The user's own answers sit
 * behind one tap, because a screen that reads them all back is a form receipt.
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
  const [detailsOpen, setDetailsOpen] = useState(false);

  // One clock for the whole screen, read once at mount. The pace slider below
  // recomputes the goal date on every drag, and a `Date.now()` read inside that
  // recompute would move the day the count starts from at the same time as the
  // pace moves the length of the count. Two moving inputs, one visible number.
  const now = useRef(Date.now()).current;

  // `goalLabelFor` covers the legacy goal ids too, so a draft restored from an
  // old install still names its goal instead of failing `validPlan`.
  const goalLabel = goalKind ? goalLabelFor(goalKind) : undefined;
  // `goalKind` is the first pick on the goal screen, the same goal `leadGoal`
  // would choose from the full tag list. Null framing falls back to the
  // generic title below, byte for byte.
  const framing = goalFraming(goalKind ? [goalKind] : null);
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

  return (
    <OnboardingScreen
      step={0}
      totalSteps={1}
      hideProgress
      title={framing ? `Your ${framing.plan} plan is ready` : 'Your plan is ready'}
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
      <CurveHero medications={plan.medications} />

      {plan.projection ? (
        <GoalCard
          anchor={plan.projection}
          live={liveProjection}
          pace={pace}
          onPaceChange={setPace}
        />
      ) : null}

      <NextShotCard plan={plan} />

      {/* The user's own answers, one tap away. Read back in full they are a
          form receipt, and the reveal is not the place for one. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="See what Poke saved"
        onPress={() => setDetailsOpen(true)}
        style={({ pressed }) => [styles.detailsRow, pressed && styles.pressed]}
      >
        <Text variant="smallStrong" color={colors.inkMuted}>See what Poke saved</Text>
        <ChevronRight size={18} color={colors.inkSubtle} />
      </Pressable>

      <BottomSheet
        visible={detailsOpen}
        title="What Poke saved"
        onClose={() => setDetailsOpen(false)}
      >
        <ScrollView
          contentContainerStyle={styles.sheetBody}
          showsVerticalScrollIndicator={false}
        >
          {plan.medications.map((medication) => (
            <View key={medication.id} style={styles.routineRow}>
              <Text variant="bodyStrong">{medication.name}</Text>
              {/* Two lines, because one sentence cannot hold a rate and a count
                  without a comma the schedule label may already have spent.
                  A deferred answer reads as the words "not set yet" rather than
                  as a blank, and the shot count is dropped rather than printed
                  as a zero, because zero is not what the run found out. */}
              <Text variant="small" color={colors.inkMuted}>{routineLine(medication)}</Text>
              <Text variant="small" color={colors.inkMuted}>
                {medication.doseSet && medication.scheduleSet
                  ? `${medication.shotsInFourWeeks} shots in the first 4 weeks`
                  : 'Finish this one in Medications whenever you are ready.'}
              </Text>
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
        </ScrollView>
      </BottomSheet>
    </OnboardingScreen>
  );
}

/**
 * The hero. One medication's first four weeks, drawn.
 *
 * Every medication the user set up has a pill here, including one Poke cannot
 * model: switching to it shows why there is no curve, in the space the curve
 * would have taken. An empty state says it is empty, and hiding the medication
 * would say the user never entered it.
 *
 * What the curve is drawn from is a disclosure, not a caption: principles §6
 * puts it behind the (i) and keeps the words themselves word for word.
 */
function CurveHero({ medications }: { medications: PlanMedication[] }) {
  const [selectedId, setSelectedId] = useState(
    () => (medications.find((medication) => medication.curve) ?? medications[0])?.id ?? '',
  );
  const [width, setWidth] = useState(0);
  const [aboutOpen, setAboutOpen] = useState(false);
  const reduced = useReducedMotion();
  const card = useSharedValue(0);

  useEffect(() => {
    card.value = timeTo(1, { duration: motion.base, easing: easing.out, reduced });
  }, [card, reduced]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: card.value,
    transform: [{ translateY: (1 - card.value) * rise.card }],
  }));

  const selected = medications.find((medication) => medication.id === selectedId) ?? medications[0];
  if (!selected) return null;
  const curve = selected.curve;

  return (
    <Animated.View style={cardStyle}>
      <Card padding="xl" style={styles.card}>
        <View style={styles.heroHead}>
          {medications.length > 1 ? (
            <View accessibilityRole="radiogroup" style={styles.pills}>
              {medications.map((medication) => (
                <Pressable
                  key={medication.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: medication.id === selected.id }}
                  accessibilityLabel={medication.name}
                  hitSlop={6}
                  onPress={() => setSelectedId(medication.id)}
                  style={({ pressed }) => [
                    styles.pill,
                    medication.id === selected.id && styles.pillOn,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    variant="smallStrong"
                    color={medication.id === selected.id ? colors.ink : colors.inkMuted}
                  >
                    {medication.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text variant="bodyStrong" style={styles.heroName}>{selected.name}</Text>
          )}
          {/* No curve, nothing to disclose. The box below states the reason
              itself, and a sheet that then said where a curve comes from would
              be answering a question this medication does not raise. */}
          {curve ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="About this curve"
              hitSlop={8}
              onPress={() => setAboutOpen(true)}
              style={({ pressed }) => [styles.infoButton, pressed && styles.pressed]}
            >
              <Info size={18} color={colors.inkSubtle} />
            </Pressable>
          ) : null}
        </View>

        <Text variant="small" color={colors.inkMuted}>{routineLine(selected)}</Text>

        {/* The box keeps its height whichever medication is selected, so a pill
            press swaps the picture instead of moving the page under the finger.
            The two words sit against the curve rather than in the card's own
            rhythm, because they are the axis and not the next thing to read. */}
        <View style={styles.chartBlock}>
          <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={styles.chartHolder}>
            {curve && width > 0 ? (
              <PlanLevelCurve
                points={curve.points}
                width={width}
                steadyWeek={curve.clearsBetweenDoses ? null : curve.steadyWeek}
                play={!reduced}
              />
            ) : null}
            {curve ? null : (
              <View style={styles.chartEmpty}>
                <Text variant="small" color={colors.inkMuted} align="center">
                  {noCurveLine(selected)}
                </Text>
              </View>
            )}
          </View>
          {curve ? (
            <View style={styles.weekRow}>
              <Text variant="caption" color={colors.inkSubtle}>Now</Text>
              <Text variant="caption" color={colors.inkSubtle}>Week 4</Text>
            </View>
          ) : null}
        </View>

        {curve ? <Text variant="bodyStrong">{steadyLine(curve)}</Text> : null}

        {curve ? (
          <BottomSheet
            visible={aboutOpen}
            title="About this curve"
            onClose={() => setAboutOpen(false)}
          >
            <View style={styles.aboutBody}>
              <Text>
                The curve is in {curve.unit}. Poke draws the curve from your dose and your
                schedule. {selected.evidenceNote}
              </Text>
            </View>
          </BottomSheet>
        ) : null}
      </Card>
    </Animated.View>
  );
}

interface GoalCardProps {
  /** The weights and the direction, taken at mount. Only the pace moves. */
  anchor: PlanProjection;
  /** The same sum at the live pace. Null once the answer runs past five years. */
  live: PlanProjection | null;
  pace: number;
  onPaceChange: (pace: number) => void;
}

/**
 * The date, and the only forward-looking number Poke shows.
 *
 * MeAgain draws the same card, puts a decorative slider under it, and lets the
 * date read as a prediction. Poke draws the same card and then does two things
 * MeAgain does not: it says in the card what the number is, and it wires the
 * slider to the sum. Drag the pace and the date moves the same instant.
 *
 * Both of those are load-bearing, and `DECISIONS.md` row 20 is what they answer
 * to. The sentence is the claim Poke is allowed to make, and the live slider is
 * what makes the claim visibly arithmetic. Do not remove the sentence, and do
 * not let the slider go decorative.
 */
function GoalCard({ anchor, live, pace, onPaceChange }: GoalCardProps) {
  const { current, goal, unit } = anchor;
  const bounds = paceBounds(unit);
  const step = unit === 'lb' ? 0.1 : 0.05;
  const paceLabel = (value: number) => formatPace(value, unit);
  // The user set no rate of change. There is no date, so nothing on this card
  // may name one, and the label below swaps rather than fills a blank.
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
          {maintaining ? 'At the pace you set' : 'At the pace you chose'}
        </Text>
        {live === null ? (
          // Reachable from the slider alone: the low end of the range against a
          // long distance runs past `MAX_PROJECTION_WEEKS`. The card stays put so
          // the drag stays alive, and it says what happened rather than a date.
          <>
            <Text variant="display">Over five years</Text>
            <Text variant="small" color={colors.inkMuted}>
              Poke puts no date on a plan that runs past five years.
            </Text>
          </>
        ) : live.kind === 'maintain' ? (
          // The maintain branch names what the user set and nothing else. It
          // names no verb, because the user chose neither direction, and it
          // carries no line about stopping or holding a loss, because that
          // would be Poke advising a rate of change. The sum below says why
          // there is no date.
          <Text variant="display">{MAINTAIN_PACE_LABEL}</Text>
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
          <Text variant="caption" color={colors.inkSubtle} align="right">Goal</Text>
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
  const shot = plan.nextShot;
  return (
    <Card padding="lg" style={styles.quietCard}>
      <View style={styles.quietHead}>
        <Text variant="small" color={colors.inkMuted}>Next shot</Text>
        <Text variant="bodyStrong">{shot ? countdownLabel(shot.at) : 'Not set yet'}</Text>
      </View>
      {/* Reached when every medication is still waiting for a dose or for a
          schedule. Medications is where those rows are, so it names that
          screen rather than Today. */}
      <Text variant="small" color={colors.inkMuted}>
        {shot
          ? `${shot.name} on ${longDate(shot.at)}`
          : 'Set a shot day in Medications whenever you are ready.'}
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

/** The dose and the schedule as one line, or the words for the one that is missing. */
function routineLine(medication: PlanMedication): string {
  if (medication.doseSet && medication.scheduleSet) {
    return `${medication.doseLabel} ${lowerFirst(medication.scheduleLabel)}`;
  }
  return unsetLine(medication.doseSet, medication.scheduleSet);
}

/**
 * Why the hero has no picture for this medication.
 *
 * A missing answer and a missing half-life are two different reasons, and only
 * one of them is the user's to fix, so the box never states the wrong one.
 */
function noCurveLine(medication: PlanMedication): string {
  if (!medication.doseSet && !medication.scheduleSet) {
    return 'Poke draws the curve once you set the dose and the schedule.';
  }
  if (!medication.doseSet) return 'Poke draws the curve once you set the dose.';
  if (!medication.scheduleSet) return 'Poke draws the curve once you set the schedule.';
  return 'No published half-life, so no level curve.';
}

// A short half-life does not plateau, so "steady" would misdescribe it. The
// curve returns near zero between doses, and the honest line says that.
// "week" and its number are joined with a no-break space: on a narrow screen
// the sentence wraps before "week" instead of stranding the bare number.
function steadyLine(curve: PlanCurve): string {
  if (curve.clearsBetweenDoses) return 'Each dose clears before the next one.';
  if (curve.steadyWeek) return `Estimated level is steady from week\u00A0${curve.steadyWeek}.`;
  return 'Estimated level is still rising at week\u00A04.';
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

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  quietCard: {
    gap: spacing.xs,
  },
  // Air between the three things on the page, and enough at the foot to clear
  // the pinned footer. Without the inset the last card stops half drawn against
  // the consent text, which reads as a broken card.
  body: {
    gap: spacing.lg,
    paddingBottom: spacing.hero,
  },
  heroHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  heroName: {
    flex: 1,
  },
  pills: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  pill: {
    minHeight: 32,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  pillOn: {
    backgroundColor: colors.accentSoft,
  },
  chartBlock: {
    gap: spacing.xs,
  },
  chartHolder: {
    width: '100%',
    height: PLAN_CHART_HEIGHT,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  chartEmpty: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  quietHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
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
  detailsRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  aboutBody: {
    paddingBottom: spacing.md,
  },
  sheetBody: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
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
