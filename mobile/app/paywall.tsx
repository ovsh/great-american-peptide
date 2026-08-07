import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Activity, Check, FileDown, Layers, TrendingUp, X } from 'lucide-react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { PRIVACY_URL, TERMS_URL } from '@/config/legal';
import { buildPlanOptions, type PlanId, type PlanOption } from '@/domain/plans';
import { useEntitlementStore } from '@/stores/entitlement';
import { colors, radius, spacing } from '@/theme';
import { safeBack } from '@/utils/nav';

const BENEFITS = [
  {
    icon: Activity,
    title: 'Your level, day by day',
    body: 'What is still in you between shots.',
  },
  {
    icon: TrendingUp,
    title: 'Trends that add up',
    body: 'Weight, doses and effects on one line.',
  },
  {
    icon: Layers,
    title: 'Every medication',
    body: 'Your whole stack, not only one.',
  },
  {
    icon: FileDown,
    title: 'Take it to your doctor',
    body: 'Export a clean summary of your log.',
  },
] as const;

export default function PaywallScreen() {
  const params = useLocalSearchParams<{ from?: string }>();
  const fromOnboarding = params.from === 'onboarding';
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
  const storeReady = availability?.kind === 'ready' && plan.pkg !== null;
  const busy = purchasing || restoring;

  const dismiss = () => {
    clearError();
    safeBack('/');
  };

  const confirm = async () => {
    if (!plan.pkg) {
      dismiss();
      return;
    }
    const outcome = await buy(plan.pkg);
    if (outcome.kind === 'purchased') dismiss();
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
            <Text variant="h1">Get the full picture.</Text>
            <Text color={colors.inkMuted}>
              Logging is free forever. Pro adds the numbers.
            </Text>
          </View>

          <View style={styles.benefits}>
            {BENEFITS.map(({ icon: Icon, title, body }) => (
              <View key={title} style={styles.benefitRow}>
                <View style={styles.benefitIcon}>
                  <Icon size={20} color={colors.accent} strokeWidth={2} />
                </View>
                <View style={styles.benefitCopy}>
                  <Text variant="bodyStrong">{title}</Text>
                  <Text variant="small" color={colors.inkMuted}>{body}</Text>
                </View>
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

        {offeringState === 'error' || !storeReady ? (
          <Text variant="caption" color={colors.inkMuted} align="center">
            {storeReadyMessage(availability?.kind === 'ready', offeringState)}
          </Text>
        ) : null}

        {error ? (
          <Text variant="small" color={colors.danger} align="center" selectable>{error}</Text>
        ) : null}

        <Button disabled={busy} onPress={confirm}>
          {ctaLabel(plan, storeReady, purchasing)}
        </Button>
        {fromOnboarding ? (
          <Button variant="ghost" size="sm" disabled={busy} onPress={dismiss}>
            Keep using the free version
          </Button>
        ) : null}
        <Text variant="caption" color={colors.inkSubtle} align="center">
          {renewalCopy(plan)}
        </Text>
        <View style={styles.legalRow}>
          <LegalLink label="Terms" url={TERMS_URL} />
          <Text variant="caption" color={colors.inkSubtle}>·</Text>
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

function ctaLabel(plan: PlanOption, storeReady: boolean, purchasing: boolean): string {
  if (purchasing) return 'Working';
  if (!storeReady) return 'Continue';
  return plan.trialLabel ? 'Start free trial' : `Subscribe ${plan.priceLabel}`;
}

function renewalCopy(plan: PlanOption): string {
  const period = plan.id === 'annual' ? 'year' : 'month';
  const lead = plan.trialLabel
    ? `${plan.trialLabel}, then ${plan.priceLabel} per ${period}.`
    : `${plan.priceLabel} per ${period}.`;
  // Apple wants the price, the period, that it renews on its own, and how to
  // stop it. Say all four, and no more.
  return `${lead} It renews on its own until you cancel it in your Apple Account settings.`;
}

function storeReadyMessage(configured: boolean, offeringState: string): string {
  if (!configured) {
    return Platform.OS === 'web'
      ? 'Purchases do not run in the web preview. Use the iOS build to test them.'
      : 'Subscriptions are not connected in this build yet. Everything stays unlocked.';
  }
  if (offeringState === 'loading') return 'Loading the current prices.';
  return 'We could not reach the App Store. Check your connection and try again.';
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
    paddingBottom: spacing.xl,
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
    alignItems: 'flex-start',
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
    gap: 2,
    paddingTop: 2,
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
