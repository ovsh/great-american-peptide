import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Activity, Check, FileDown, Layers, X, type LucideIcon } from 'lucide-react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { PaywallHero } from '@/components/paywall-hero';
import { Text } from '@/components/Text';
import { PRIVACY_URL, TERMS_URL } from '@/config/legal';
import { buildPlanOptions, type PlanId, type PlanOption } from '@/domain/plans';
import { useEntitlementStore, type OfferingState } from '@/stores/entitlement';
import { colors, radius, spacing } from '@/theme';
import { safeBack } from '@/utils/nav';

// The hero draws the level, so the list no longer names it. What is left is the
// three things the drawing cannot show, one line each, in the order a user
// meets them.
const BENEFITS: readonly Benefit[] = [
  {
    icon: Activity,
    title: 'Exact numbers and progress charts',
  },
  {
    icon: Layers,
    title: 'Unlimited medications',
  },
  {
    icon: FileDown,
    title: 'Export your whole log as a CSV file',
  },
];

interface Benefit {
  icon: LucideIcon;
  title: string;
}

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();

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

  const dismiss = () => {
    clearError();
    safeBack('/');
  };

  const confirm = async () => {
    // The button reaches this only in the `buy` state, where the package exists.
    if (!plan.pkg) return;
    const outcome = await buy(plan.pkg);
    if (outcome.kind === 'purchased') dismiss();
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
    if (action === 'close') dismiss();
  };

  const tryRestore = async () => {
    const outcome = await restore();
    if (outcome === 'restored') dismiss();
  };

  return (
    <View style={styles.root}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={dismiss}
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
          <View style={styles.hero}>
            <View style={styles.badge}>
              <Text variant="caption" color={colors.accent}>POKE PRO</Text>
            </View>
            <Text variant="h1">Your estimated level, day by day</Text>
            <Text color={colors.inkMuted}>
              Poke draws the curve from the shots you log.
            </Text>
          </View>

          <PaywallHero />

          <View style={styles.benefits}>
            {BENEFITS.map(({ icon: Icon, title }) => (
              <View key={title} style={styles.benefitRow}>
                <View style={styles.benefitIcon}>
                  <Icon size={20} color={colors.accent} strokeWidth={2} />
                </View>
                <Text variant="bodyStrong" style={styles.benefitCopy}>{title}</Text>
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
            <PlanRow
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

function PlanRow({
  option,
  selected,
  onPress,
}: {
  option: PlanOption;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${option.title}, ${option.priceLabel} ${option.cadenceLabel}`}
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
            {option.badge ? (
              <View style={styles.saveBadge}>
                <Text variant="caption" color={colors.inkInverse}>{option.badge}</Text>
              </View>
            ) : null}
          </View>
          <Text variant="small" color={colors.inkMuted}>
            {option.perMonthLabel ?? `${option.priceLabel} ${option.cadenceLabel}`}
          </Text>
        </View>
        <View style={styles.planPrice}>
          <Text variant="bodyStrong">{option.priceLabel}</Text>
          <Text variant="caption" color={colors.inkSubtle}>{option.cadenceLabel}</Text>
        </View>
      </Card>
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
  },
  hero: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    marginBottom: spacing.xs,
  },
  benefits: {
    gap: spacing.md,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  benefitIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
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
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  saveBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
  },
  planPrice: {
    alignItems: 'flex-end',
  },
  footer: {
    width: '100%',
    maxWidth: 560 + spacing.screen * 2,
    alignSelf: 'center',
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.lg,
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
