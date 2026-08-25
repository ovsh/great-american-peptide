import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, X } from 'lucide-react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { PaywallHero } from '@/components/paywall-hero';
import { Text } from '@/components/Text';
import { PRIVACY_URL, TERMS_URL } from '@/config/legal';
import { buildPlanOptions, type PlanId, type PlanOption } from '@/domain/plans';
import { track } from '@/services/analytics';
import { useEntitlementStore, type OfferingState } from '@/stores/entitlement';
import { colors, radius, spacing } from '@/theme';
import { safeBack } from '@/utils/nav';

/**
 * The screen setup ends on. `onboarding/plan.tsx` sends the user here before
 * Today, so this source is the one that has nothing behind it to go back to.
 */
const FROM_ONBOARDING = 'onboarding_plan';

/**
 * What a subscription unlocks, one line per lock that exists in the code today.
 *
 * Every claim is checkable:
 *   1. `today-level-chart.tsx` draws the shape and holds the estimate back, and
 *      `app/reports/level.tsx` puts the same reading behind `ProLock`.
 *   2. `progress-journey-card.tsx` reads `locked: !pro && hasChange` and shows
 *      the "Unlock your numbers" pill in place of the total.
 *   3. `FREE_MEDICATION_LIMIT` in `repositories/medications.ts` is 2, and Pro
 *      has no ceiling at all.
 *   4. `runExport` in `app/(tabs)/profile.tsx` opens this screen for a free user.
 *
 * Do not add a fifth line without a fifth lock behind it.
 */
const BENEFITS: readonly string[] = [
  'See the exact number on every level curve',
  'Read your total weight change on Progress',
  'Track every medication you take',
  'Export your whole log as a CSV file',
];

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
          <Text variant="h1">Unlock Poke Pro and see your whole plan</Text>

          {/* The proof, as a strip. It is the user's own curve, drawn free: the
              shape without the number the list below sells. */}
          <PaywallHero compact />

          <View style={styles.benefits}>
            {BENEFITS.map((line) => (
              <View key={line} style={styles.benefitRow}>
                <View style={styles.benefitCheck}>
                  <Check size={14} strokeWidth={3} color={colors.successDeep} />
                </View>
                <Text style={styles.benefitCopy}>{line}</Text>
              </View>
            ))}
          </View>
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
            one line that must never carry a number Poke made up. */}
        {storeReady ? (
          <Text variant="caption" color={colors.inkSubtle} align="center">
            {renewalCopy(plan)}
          </Text>
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
          <Text variant="bodyStrong">{option.title}</Text>
          <Text variant="small" color={colors.inkMuted}>{note}</Text>
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
 * The line under a plan's name.
 *
 * Every number in it is computed. `perMonthLabel` is the yearly price divided by
 * twelve, and it is only ever shown next to "billed yearly", because the charge
 * is one payment a year and the exact terms sit under the button. `trialLabel`
 * is the store's own introductory period, so a trial that App Store Connect
 * removes disappears from here too.
 *
 * The monthly plan carries no introductory offer today, so it says so. A blank
 * line beside a plan that names a trial reads as an oversight, and a buyer who
 * picks monthly has to learn there is no trial before the button, not after it.
 */
function planNote(option: PlanOption): string {
  if (option.perMonthLabel) {
    return option.trialLabel
      ? `${option.trialLabel}, then ${option.perMonthLabel} billed yearly.`
      : `${option.perMonthLabel} billed yearly.`;
  }
  return option.trialLabel
    ? `${option.trialLabel}, then ${option.priceLabel} ${option.cadenceLabel}.`
    : 'No free trial.';
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
  return plan.trialLabel ? 'Start free trial' : `Subscribe for ${plan.priceLabel}`;
}

function renewalCopy(plan: PlanOption): string {
  const period = plan.id === 'annual' ? 'year' : 'month';
  const lead = plan.trialLabel
    ? `${plan.trialLabel}, then ${plan.priceLabel} per ${period}.`
    : `${plan.priceLabel} per ${period}.`;
  // Apple wants the price, the period, that it renews on its own, and how to
  // stop it. Say all four, and no more.
  return `${lead} The subscription renews on its own until you cancel it in your Apple Account settings.`;
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
  benefits: {
    gap: spacing.md,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  benefitCheck: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitCopy: {
    flex: 1,
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
    gap: 2,
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
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
});
