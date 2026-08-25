import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { ChoicePill, OnboardingScreen } from '@/components/OnboardingScreen';
import { Text } from '@/components/Text';
import { useOnboardingTransition } from '@/components/onboardingTransition';
import { reconstitution } from '@/domain/reconstitution';
import {
  firstPostScheduleHref,
  lastSetupHref,
  medicationDisplayName,
  mixCandidateIndex,
  parseDiluentMl,
  scheduleVialMg,
  useOnboardingStore,
  type MedicationScheduleDraft,
} from '@/stores/onboarding';
import { colors, spacing } from '@/theme';

/**
 * The water amounts the chips offer, in millilitres.
 *
 * Whole millilitres, because a syringe of bacteriostatic water is drawn to a
 * mark and these are the marks. They are amounts of water and not doses: the
 * dose is the number the user typed on the dose screen, and it is the same dose
 * whichever of these the user picks. Any other amount is typed instead.
 */
const WATER_ML_OPTIONS: readonly number[] = [1, 2, 3];

/**
 * The one sentence a user who said they are brand new sees, and nobody else.
 *
 * It says what mixing is. It names no amount, no protocol and no order of
 * operations, because a user reading their first vial label is exactly the user
 * Poke must not instruct.
 */
const TEACH_LINE = 'A peptide vial arrives as a dry powder and the water makes it ready to inject.';

/** The mix already in the draft, as typed. Read once, at mount. */
function openingWater(): string {
  const state = useOnboardingStore.getState();
  const index = mixCandidateIndex(state);
  if (index === null) return '';
  const id = state.medicationIds[index];
  return (id ? state.schedules[id]?.diluentMlText : '') ?? '';
}

/**
 * The syringe-math payoff.
 *
 * Every number on this screen came from the user. The vial size is the one they
 * copied off their label, the dose is the one their clinician set, and the water
 * is the one they press here, so the concentration and the draw are arithmetic
 * on their own three numbers rather than a mix Poke picked for them. It is the
 * same sum `app/calculator.tsx` ships, run once on the answers already given.
 *
 * The beat is uncounted, so it hides the progress bar exactly as the compute
 * beat and the plan do. `mixCandidateIndex` decides whether it runs at all, and
 * `setupNextHref` reads the same answer, so the run cannot send anybody to a
 * screen that has nothing to show them.
 */
export default function MixScreen() {
  const medicationIds = useOnboardingStore((state) => state.medicationIds);
  const schedules = useOnboardingStore((state) => state.schedules);
  const customNames = useOnboardingStore((state) => state.customNames);
  const stage = useOnboardingStore((state) => state.journeyStage);
  const experience = useOnboardingStore((state) => state.experienceLevel);
  const setDiluentMl = useOnboardingStore((state) => state.setDiluentMl);
  const index = useOnboardingStore(mixCandidateIndex);
  const transition = useOnboardingTransition();

  // The amount lives here until Save writes it, because Skip has to record
  // nothing at all. A user who saved a mix and came back finds their own number
  // where they left it, and the typed box opens on an amount no chip carries.
  const [water, setWater] = useState(openingWater);
  const [typedOpen, setTypedOpen] = useState(() => {
    const opening = openingWater();
    return opening !== '' && !WATER_ML_OPTIONS.some((ml) => String(ml) === opening);
  });

  const leave = () => transition.go(firstPostScheduleHref(stage, experience));

  const medicationId = index === null ? undefined : medicationIds[index];
  const schedule = medicationId ? schedules[medicationId] : undefined;

  // A reload drops the picker answers, and a deep link can land here with no
  // qualifying medication behind it. The screen says it has nothing rather than
  // drawing a mix out of numbers nobody gave.
  if (!medicationId || !schedule) {
    return (
      <OnboardingScreen
        step={0}
        totalSteps={1}
        hideProgress
        transition={transition}
        title="Nothing to mix yet"
        footer={<Button onPress={leave}>Continue</Button>}
      >
        <Text color={colors.inkMuted}>Poke has no vial size and no dose to mix from.</Text>
      </OnboardingScreen>
    );
  }

  const name = medicationDisplayName(medicationId, customNames);
  const answer = mixAnswer(schedule, water);

  return (
    <OnboardingScreen
      step={0}
      totalSteps={1}
      hideProgress
      backHref={lastSetupHref(medicationIds.length)}
      transition={transition}
      title={`How much water goes into your ${name} vial?`}
      // One medication needs no line: the title already names it. Several do,
      // because the run set up all of them and only one of them is mixed here.
      subtitle={medicationIds.length > 1 ? `Poke uses the numbers you gave for ${name}.` : undefined}
      footer={(
        <>
          <Button disabled={parseDiluentMl(water) === null} onPress={() => {
            setDiluentMl(medicationId, water);
            leave();
          }}>
            Save my mix
          </Button>
          <Button variant="ghost" onPress={leave}>Skip this</Button>
        </>
      )}
    >
      <View style={styles.section}>
        <View style={styles.wrapRow}>
          {WATER_ML_OPTIONS.map((ml) => (
            <ChoicePill
              key={ml}
              label={`${ml} mL`}
              selected={!typedOpen && water === String(ml)}
              onPress={() => {
                setTypedOpen(false);
                setWater(String(ml));
              }}
            />
          ))}
          <ChoicePill
            label="Another amount"
            selected={typedOpen}
            onPress={() => {
              setTypedOpen(true);
              setWater('');
            }}
          />
        </View>

        {/* The box opens empty and stays empty until the user types their own
            amount. No placeholder number, on this screen or any other. */}
        {typedOpen ? (
          <View style={styles.inlineRow}>
            <View style={styles.inputBox}>
              <Input
                value={water}
                onChangeText={setWater}
                keyboardType="decimal-pad"
                style={styles.inputText}
                accessibilityLabel={`Millilitres of bacteriostatic water for ${name}`}
              />
            </View>
            <Text variant="small" color={colors.inkMuted}>mL of bacteriostatic water</Text>
          </View>
        ) : null}

        <Text variant="small" color={colors.inkMuted}>{waterNote(water)}</Text>
      </View>

      {answer ? (
        <Card padding="lg" variant="muted" style={styles.answer}>
          <Text variant="bodyStrong">{answer.draw}</Text>
          <Text variant="small" color={colors.inkMuted}>{answer.concentration}</Text>
          {answer.warnings.map((warning) => (
            <View key={warning} style={styles.warnRow}>
              <AlertTriangle size={14} color={colors.warning} />
              <Text variant="small" style={styles.warnText}>{warning}</Text>
            </View>
          ))}
        </Card>
      ) : null}

      {experience === 'new' ? (
        <Text variant="small" color={colors.inkMuted}>{TEACH_LINE}</Text>
      ) : null}
    </OnboardingScreen>
  );
}

interface MixAnswer {
  /** The user's own dose, in syringe units. */
  draw: string;
  /** What the vial holds once the water is in. */
  concentration: string;
  /**
   * The domain's two flags, said in the reader's words. The conditions are
   * read off the result and mirror `domain/reconstitution.ts` exactly; only
   * the sentences differ, because "aliquot" serves the calculator's audience
   * and not somebody reading their first vial label. Each one states a fact
   * about the user's own three numbers and proposes nothing.
   */
  warnings: string[];
}

/**
 * The mixing math, or null while there is no water amount to run it on.
 *
 * `domain/reconstitution.ts` does the arithmetic and this function only feeds it
 * and reads it back. The guards repeat the ones in `mixCandidateIndex` because
 * this reads the draft itself: an international unit measures activity rather
 * than mass, so no volume follows from one, and a missing vial size or dose
 * leaves nothing to compute.
 */
function mixAnswer(schedule: MedicationScheduleDraft, water: string): MixAnswer | null {
  const vialMg = scheduleVialMg(schedule);
  const diluentMl = parseDiluentMl(water);
  const dose = Number.parseFloat(schedule.doseText);
  if (vialMg === null || diluentMl === null) return null;
  if (!Number.isFinite(dose) || dose <= 0 || schedule.unit === 'iu') return null;

  const result = reconstitution({
    materialMassMg: vialMg,
    diluentMl,
    aliquotAmountMcg: schedule.unit === 'mg' ? dose * 1000 : dose,
  });
  if (!result.valid || result.aliquotVolumeMl === null) return null;

  const warnings: string[] = [];
  if (result.aliquotVolumeMl > diluentMl) {
    warnings.push('Your dose is more than this vial holds.');
  }
  if (result.aliquotVolumeMl < 0.01) {
    warnings.push(
      'The draw is smaller than one mark on a U-100 syringe, so the syringe cannot measure it.',
    );
  }

  return {
    draw: `Your ${dose} ${schedule.unit} dose is ${syringeUnits(result.aliquotVolumeMl)} units on a U-100 insulin syringe.`,
    concentration: `${formatMgPerMl(result.concentrationMgPerMl)} mg per mL after mixing.`,
    warnings,
  };
}

/**
 * A volume in millilitres, on the barrel of a U-100 insulin syringe.
 *
 * A U-100 syringe carries one hundred marks to the millilitre, so the volume
 * times a hundred is the mark. Ten marks and up read as a whole number, because
 * the barrel has no finer mark to read and a tenth of a unit written on a line
 * the syringe does not carry is precision Poke invented. Under ten it keeps one
 * decimal, which is as far as a half-unit barrel goes.
 */
function syringeUnits(volumeMl: number): string {
  const units = volumeMl * 100;
  if (units >= 10) return String(Math.round(units));
  return String(Math.round(units * 10) / 10);
}

/** The concentration, to two decimals, with nothing trailing that says nothing. */
function formatMgPerMl(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** The chosen amount read back, or the line that says nothing is chosen yet. */
function waterNote(water: string): string {
  const ml = parseDiluentMl(water);
  if (ml === null) return 'Poke has no water amount yet.';
  return `Poke records ${ml} mL of bacteriostatic water.`;
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  inputBox: {
    width: 112,
  },
  inputText: {
    textAlign: 'center',
  },
  answer: {
    gap: spacing.sm,
  },
  warnRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  warnText: {
    flex: 1,
  },
});
