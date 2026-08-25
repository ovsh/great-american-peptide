import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ChartLine, Check, Gauge, Scale, Share, ShieldCheck, Syringe, X } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { PaywallHero } from '@/components/paywall-hero';
import { Text } from '@/components/Text';
import { PRIVACY_URL, TERMS_URL } from '@/config/legal';
import type { GoalKind } from '@/db/types';
import { buildPlanOptions, type PlanId, type PlanOption } from '@/domain/plans';
import { getPreferences } from '@/repositories/preferences';
import { track } from '@/services/analytics';
import { useEntitlementStore, type OfferingState } from '@/stores/entitlement';
import { colors, radius, spacing } from '@/theme';
import { goalFraming } from '@/utils/goalFraming';
import { safeBack } from '@/utils/nav';

/**
 * The screen setup ends on. `onboarding/plan.tsx` sends the user here before
 * Today, so this source is the one that has nothing behind it to go back to.
 */
const FROM_ONBOARDING = 'onboarding_plan';

interface Benefit {
  icon: LucideIcon;
  title: string;
  detail: string;
}

/**
 * What a subscription unlocks, one entry per lock that exists in the code today.
 *
 * Every claim is checkable:
 *   1. `today-hero-card.tsx` passes `value` only when `pro`, so a free user gets
 *      the shape and an unlock chip in place of the reading, at rest and under a
 *      scrubbing finger. The chip covers the hours ahead as well, because
 *      `today-level-chart.tsx` reads the forecast half of the curve through the
 *      same chip.
 *   2. `app/reports/level.tsx` puts the whole report behind `ProLock`, and that
 *      lock names the peak, the trough and the average of each dose window.
 *   3. `progress-journey-card.tsx` reads `locked: !pro && hasChange` and shows
 *      the "Unlock your numbers" pill in place of the total, which `readOutFor`
 *      computes as the start weight minus the latest one.
 *   4. `FREE_MEDICATION_LIMIT` in `repositories/medications.ts` is 2, and Pro
 *      has no ceiling at all.
 *   5. `runExport` in `app/(tabs)/profile.tsx` opens this screen for a free
 *      user, and `services/export.ts` writes shots, weights and side effects.
 *
 * Do not add a sixth entry without a sixth lock behind it. Site rotation is kept
 * out on purpose: `log-shot` recommends the next site for every user, so a line
 * here would sell something the free version already gives. It is named in the
 * privacy card instead, where the claim is about where the data sits rather than
 * about who may read it.
 */
const BENEFITS: readonly Benefit[] = [
  {
    icon: ChartLine,
    title: 'Every number on your curve',
    detail: 'Read the estimated level now and at any hour ahead.',
  },
  {
    icon: Gauge,
    title: 'The level report',
    detail: 'See the peak, the trough and the average across each dose window.',
  },
  {
    icon: Scale,
    title: 'Your total change on Progress',
    detail: 'Read how far your weight moved since you started.',
  },
  {
    icon: Syringe,
    title: 'Every medication you take',
    detail: 'The free version keeps two. Poke Pro sets no ceiling.',
  },
  {
    icon: Share,
    title: 'Your whole log as a file',
    detail: 'Export every shot, weight and side effect as one CSV file.',
  },
];

/**
 * The one claim on this screen that is true on both sides of the paywall.
 *
 * It sits apart from the benefit list for that reason: it is not a lock, it is
 * the reason a person picked Poke over an app with an account. `profile.tsx`
 * carries the same promise in the same words, and `services/analytics.ts` is the
 * only file that may reach a server with an event that holds no health data.
 */
const PRIVACY = {
  title: 'On this phone and nowhere else',
  body: 'Your shots, your levels and your injection sites stay on this device.',
  note: 'Poke has no account and sends no health data anywhere.',
} as const;

/**
 * The second half of the disclosure. Guideline 3.1.2 asks for four things: the
 * price, the period, that it renews on its own, and how to stop it. `priceCopy`
 * says the first two and this says the last two. Both render together, and
 * neither ships without the other.
 */
const RENEWAL_COPY =
  'The subscription renews on its own until you cancel it in your Apple Account settings.';

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  // Which screen sent the user here. `openPaywall` writes it, and a screen that
  // does not name itself lands as `unknown`.
  const { source } = useLocalSearchParams<{ source?: string }>();

  const offering = useEntitlementStore((state) => state.offering);
  const offeringState = useEntitlementStore((state) => state.offeringState);
  const availability = useEntitlementStore((state) => state.availability);
  const purchasing = useEntitlementStore((state) => state.purchasing);
  const restoring = useEntitlementStore((state) => state.restoring);
  const error = useEntitlementStore((state) => state.error);
  const loadOffering = useEntitlementStore((state) => state.loadOffering);
  const buy = useEntitlementStore((state) => state.buy);
  const restore = useEntitlementStore((state) => state.restore);
  const clearError = useEntitlementStore((state) => state.clearError);

  const [selected, setSelected] = useState<PlanId>('annual');

  // The saved goal, read from the preferences row because the onboarding draft
  // is already reset by the time this screen opens and Profile opens it too.
  // The generic headline renders until the read resolves, so a slow or failed
  // read lands on the exact fallback copy.
  const [goalKind, setGoalKind] = useState<GoalKind | null>(null);
  useEffect(() => {
    getPreferences().then((row) => setGoalKind(row.goal_kind)).catch(() => {});
  }, []);
  const framing = goalFraming(goalKind ? [goalKind] : null);

  useEffect(() => {
    if (offeringState === 'idle') loadOffering().catch(() => {});
  }, [offeringState, loadOffering]);

  useEffect(() => {
    track('paywall_viewed', { source: typeof source === 'string' && source ? source : 'unknown' });
  }, [source]);

  const plans = buildPlanOptions(offering);
  const plan = plans.find((option) => option.id === selected) ?? plans[0];
  // `canSell` is whether Poke can sell anything here at all. `storeReady` is
  // whether the App Store priced this plan. Only the second one may be sold,
  // and only the second one may state a price.
  const canSell = availability?.kind === 'ready';
  const storeReady = canSell && plan.pkg !== null;
  const busy = purchasing || restoring;
  const action = ctaAction(canSell, storeReady, offeringState, purchasing);
  const message = storeMessage(canSell, offeringState, plan.pkg !== null);

  // Setup ends here, so there is no screen under this one: the onboarding stack
  // was replaced by the offer. Every way out of it therefore names Today
  // instead of going back to a route that is gone. Every other caller pushed
  // this screen over its own, and that screen is where a close belongs.
  const fromOnboarding = source === FROM_ONBOARDING;

  const leave = () => {
    clearError();
    if (fromOnboarding) router.replace('/');
    else safeBack('/');
  };

  const confirm = async () => {
    // The button reaches this only in the `buy` state, where the package exists.
    if (!plan.pkg) return;
    const outcome = await buy(plan.pkg);
    if (outcome.kind === 'purchased') {
      track('purchase_completed', { plan: plan.id === 'annual' ? 'yearly' : 'monthly' });
      leave();
    }
  };

  const runAction = () => {
    if (action === 'buy') {
      confirm().catch(() => {});
      return;
    }
    if (action === 'retry') {
      loadOffering().catch(() => {});
      return;
    }
    if (action === 'close') leave();
  };

  const tryRestore = async () => {
    const outcome = await restore();
    if (outcome === 'restored') leave();
  };

  return (
    <View style={styles.root}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={fromOnboarding ? 'Close and go to Today' : 'Close'}
          onPress={leave}
          hitSlop={12}
          style={styles.closeButton}
        >
          <X size={22} color={colors.inkMuted} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Restore purchases"
          onPress={tryRestore}
          disabled={busy}
          hitSlop={12}
        >
          <Text variant="smallStrong" color={busy ? colors.inkSubtle : colors.inkMuted}>
            {restoring ? 'Restoring' : 'Restore'}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <View style={styles.headline}>
            {/* The trial leads, because it is the one thing on this screen the
                nearest competitor does not sell. It shows only once the App
                Store priced this plan, so an offering with no introductory
                period cannot put a trial on screen. */}
            {storeReady && plan.trialLabel ? (
              <View style={styles.trialPill}>
                <Text variant="caption" color={colors.successDeep}>{plan.trialLabel}</Text>
              </View>
            ) : null}
            <Text variant="h1">
              {framing
                ? `Unlock Poke Pro and see your whole ${framing.plan} plan`
                : 'Unlock Poke Pro and see your whole plan'}
            </Text>
            <Text color={colors.inkMuted}>
              Poke Pro opens every reading the free version holds back.
            </Text>
          </View>

          {/* The proof, as a strip. It is the user's own curve, drawn free: the
              shape without the number the list below sells. */}
          <PaywallHero compact />

          <View style={styles.benefits}>
            {BENEFITS.map(({ icon: Icon, title, detail }) => (
              <View key={title} style={styles.benefitRow}>
                <View style={styles.benefitIcon}>
                  <Icon size={17} strokeWidth={2} color={colors.successDeep} />
                </View>
                <View style={styles.benefitCopy}>
                  <Text variant="bodyStrong">{title}</Text>
                  <Text variant="small" color={colors.inkMuted}>{detail}</Text>
                </View>
              </View>
            ))}
          </View>

          <Card padding="lg" style={styles.privacyCard}>
            <View style={styles.benefitIcon}>
              <ShieldCheck size={17} strokeWidth={2} color={colors.successDeep} />
            </View>
            <View style={styles.benefitCopy}>
              <Text variant="bodyStrong">{PRIVACY.title}</Text>
              <Text variant="small" color={colors.inkMuted}>{PRIVACY.body}</Text>
              <Text variant="caption" color={colors.inkSubtle}>{PRIVACY.note}</Text>
            </View>
          </Card>
        </View>
      </ScrollView>

      {/* The price sits with the button. A CTA the buyer can reach without
          scrolling, next to a price they cannot see, is not a fair offer. */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        <View style={styles.plans}>
          {plans.map((option) => (
            <PlanCard
              key={option.id}
              option={option}
              selected={option.id === selected}
              onPress={() => setSelected(option.id)}
            />
          ))}
        </View>

        {message ? (
          <Text variant="caption" color={colors.inkMuted} align="center">{message}</Text>
        ) : null}

        {error ? (
          <Text variant="small" color={colors.danger} align="center" selectable>{error}</Text>
        ) : null}

        <Button disabled={busy || action === 'waiting'} onPress={runAction}>
          {ctaLabel(action, plan)}
        </Button>
        {/* Only when the App Store priced this plan. The renewal terms are the
            one line that must never carry a number Poke made up.

            Two lines rather than one. The button now leads with the trial, so
            what it costs afterwards has to be legible directly under it rather
            than set in the smallest type on the screen. The second line holds
            the rest of the disclosure at the size fine print is read at. */}
        {storeReady ? (
          <View style={styles.terms}>
            <Text variant="small" color={colors.inkMuted} align="center">{priceCopy(plan)}</Text>
            <Text variant="caption" color={colors.inkSubtle} align="center">{RENEWAL_COPY}</Text>
          </View>
        ) : null}
        <View style={styles.legalRow}>
          <LegalLink label="Terms" url={TERMS_URL} />
          <Text variant="caption" color={colors.inkSubtle}>and</Text>
          <LegalLink label="Privacy" url={PRIVACY_URL} />
        </View>
      </View>
    </View>
  );
}

function PlanCard({
  option,
  selected,
  onPress,
}: {
  option: PlanOption;
  selected: boolean;
  onPress: () => void;
}) {
  const note = planNote(option);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={[
        option.title,
        option.trialLabel,
        `${option.priceLabel} ${option.cadenceLabel}`,
        note,
        option.badge,
      ].filter((part): part is string => Boolean(part)).join('. ')}
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <Card
        padding="lg"
        style={[styles.planCard, selected && styles.planCardSelected]}
      >
        <View style={[styles.radio, selected && styles.radioSelected]}>
          {selected ? <Check size={13} strokeWidth={3} color={colors.inkInverse} /> : null}
        </View>
        <View style={styles.planCopy}>
          <View style={styles.planTitleRow}>
            <Text variant="bodyStrong">{option.title}</Text>
            {/* The trial sits on the plan that carries it, so the two cards read
                against each other: one starts free and the other says it does
                not. The savings pill keeps the card's edge to itself. */}
            {option.trialLabel ? (
              <View style={styles.trialTag}>
                <Text variant="caption" color={colors.successDeep}>{option.trialLabel}</Text>
              </View>
            ) : null}
          </View>
          {note ? <Text variant="small" color={colors.inkMuted}>{note}</Text> : null}
        </View>
        <View style={styles.planPrice}>
          <Text variant="bodyStrong">{option.priceLabel}</Text>
          <Text variant="caption" color={colors.inkSubtle}>{option.cadenceLabel}</Text>
        </View>
      </Card>
      {/* On the card's own edge, so the saving reads as a tag on the plan and
          not as a fourth thing inside it. It takes no touch: the card under it
          is the target, and its label already carries this badge. */}
      {option.badge ? (
        <View style={styles.saveBadge} pointerEvents="none">
          <Text variant="caption" color={colors.inkInverse}>{option.badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function LegalLink({ label, url }: { label: string; url: string }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={() => {
        Linking.openURL(url).catch(() => {});
      }}
    >
      <Text variant="caption" color={colors.inkMuted}>{label}</Text>
    </Pressable>
  );
}

/**
 * The line under a plan's name, or null when the tag beside the name has said
 * everything there is to say.
 *
 * Every number in it is computed. `perMonthLabel` is the yearly price divided by
 * twelve, and it is only ever shown next to "billed yearly", because the charge
 * is one payment a year and the exact terms sit under the button. It is the
 * honest form of the anchor a paywall in this category reaches for: the same
 * money, said at the cadence the buyer compares.
 *
 * The trial moved to the tag beside the plan's name, so it is not repeated
 * here. What stays is the case with no tag to carry: the monthly plan holds no
 * introductory offer today, so it says so. A blank line beside a plan that names
 * a trial reads as an oversight, and a buyer who picks monthly has to learn
 * there is no trial before the button, not after it.
 */
function planNote(option: PlanOption): string | null {
  if (option.perMonthLabel) return `${option.perMonthLabel}, billed yearly.`;
  return option.trialLabel ? null : 'No free trial.';
}

/**
 * What the one large button does. The label is derived from this and never
 * chosen on its own, so the button cannot promise a purchase it will not make.
 */
type CtaAction = 'buy' | 'retry' | 'close' | 'waiting' | 'purchasing';

function ctaAction(
  canSell: boolean,
  storeReady: boolean,
  offeringState: OfferingState,
  purchasing: boolean,
): CtaAction {
  if (purchasing) return 'purchasing';
  // Nothing is for sale here, so the button leaves rather than pretends.
  if (!canSell) return 'close';
  if (storeReady) return 'buy';
  if (offeringState === 'idle' || offeringState === 'loading') return 'waiting';
  return 'retry';
}

function ctaLabel(action: CtaAction, plan: PlanOption): string {
  if (action === 'purchasing') return 'Purchasing';
  if (action === 'waiting') return 'Loading the prices';
  if (action === 'retry') return 'Try again';
  if (action === 'close') return 'Close';
  if (!plan.trialLabel) return `Subscribe for ${plan.priceLabel}`;
  const phrase = trialPhrase(plan);
  return phrase ? `Start my ${phrase} free trial` : 'Start my free trial';
}

/**
 * The trial as the adjective a button can carry: "3-day", "1-week".
 *
 * `plans.ts` owns the question of whether a trial exists at all, so this reads
 * `trialLabel` first and only then reshapes the store's own period. It returns
 * null for a plan the store never priced, for a period the store did not send,
 * and for an introductory offer that costs money, and the caller then names no
 * length rather than a wrong one. No length is ever written here, so a trial
 * that App Store Connect shortens shortens this button with it.
 */
function trialPhrase(plan: PlanOption): string | null {
  if (!plan.trialLabel) return null;
  const intro = plan.pkg?.product.introPrice;
  if (!intro || intro.price > 0) return null;
  const count = intro.periodNumberOfUnits;
  if (!Number.isFinite(count) || count <= 0) return null;
  const unit = intro.periodUnit?.toLowerCase() ?? '';
  const noun = unit === 'week' || unit === 'month' || unit === 'year' ? unit : 'day';
  return `${count}-${noun}`;
}

/**
 * The first half of the disclosure: what this plan costs and how often. Apple
 * wants the price, the period, that it renews on its own, and how to stop it.
 * This line carries the first two and `RENEWAL_COPY` carries the rest.
 */
function priceCopy(plan: PlanOption): string {
  const period = plan.id === 'annual' ? 'year' : 'month';
  return plan.trialLabel
    ? `${plan.trialLabel}, then ${plan.priceLabel} per ${period}.`
    : `${plan.priceLabel} per ${period}.`;
}

/**
 * Null when the App Store priced the chosen plan and there is nothing to
 * explain. Otherwise it names which prices on screen the store has not
 * confirmed, so the rows above are never read as an offer.
 */
function storeMessage(
  canSell: boolean,
  offeringState: OfferingState,
  planOnSale: boolean,
): string | null {
  if (!canSell) {
    return Platform.OS === 'web'
      ? 'Purchases do not run in the web preview. Use the iOS build to test purchases.'
      : 'This build has no subscription connection. Every Pro feature stays unlocked.';
  }
  if (offeringState === 'idle' || offeringState === 'loading') {
    return 'Poke is loading the current prices.';
  }
  if (offeringState === 'error') {
    return 'Poke could not reach the App Store. The prices above are not confirmed. Check your connection.';
  }
  if (!planOnSale) return 'The App Store does not offer this plan today. Pick the other plan above.';
  return null;
}

/** The savings pill, sat half on and half off the card it belongs to. */
const BADGE_HEIGHT = 22;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.sm,
  },
  closeButton: {
    width: 32,
    height: 32,
    marginLeft: -6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.screen,
    // The pricing block sits under this list and never scrolls, so the list
    // needs room to run out above it. Without the inset the last benefit row
    // stops half drawn against the divider and reads as a rendering fault.
    paddingBottom: spacing.hero,
  },
  content: {
    width: '100%',
    maxWidth: 560,
    gap: spacing.xl,
    paddingTop: spacing.sm,
  },
  headline: {
    gap: spacing.sm,
  },
  trialPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
  },
  benefits: {
    gap: spacing.lg,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  // A square tile rather than the round check the list used to carry. Five
  // identical ticks say only "included"; the medication, the scale and the
  // report each say which lock the line is about.
  benefitIcon: {
    width: spacing.xxxl,
    height: spacing.xxxl,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  // Set in a card, because it is the one promise on this screen that a free user
  // already holds. A sixth row in the list would read as a sixth thing to buy.
  privacyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  plans: {
    gap: spacing.md,
  },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  planCardSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  pressed: {
    opacity: 0.8,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  planCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  trialTag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
  },
  planPrice: {
    alignItems: 'flex-end',
  },
  saveBadge: {
    position: 'absolute',
    top: -BADGE_HEIGHT / 2,
    right: spacing.lg,
    height: BADGE_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
  },
  footer: {
    width: '100%',
    maxWidth: 560 + spacing.screen * 2,
    alignSelf: 'center',
    paddingHorizontal: spacing.screen,
    // Half the savings pill sits above the yearly card, so the footer opens far
    // enough for it to clear the divider.
    paddingTop: spacing.xl,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.background,
  },
  terms: {
    gap: spacing.xs,
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
});
