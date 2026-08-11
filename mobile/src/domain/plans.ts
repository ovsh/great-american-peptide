import type { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';

export type PlanId = 'annual' | 'monthly';

export interface PlanOption {
  id: PlanId;
  /** null when we are rendering placeholder pricing (no store connection yet). */
  pkg: PurchasesPackage | null;
  title: string;
  priceLabel: string;
  cadenceLabel: string;
  /** Annual only: the same price expressed per month, for honest comparison. */
  perMonthLabel: string | null;
  /** Annual only: how much cheaper than paying monthly, e.g. "Save 58%". */
  badge: string | null;
  /** e.g. "1 month free", when the product carries a free introductory period. */
  trialLabel: string | null;
}

// Shown when the store is unreachable. These must stay in step with the prices
// configured in App Store Connect, or the paywall will lie in dev.
//
// 39.99 a year sits at the bottom of what the category charges (Shotsy tests
// 39.99 to 59.99, Peps asks 44.99), and it makes the yearly saving read 67%
// rather than 58% next to the monthly price.
const PLACEHOLDER = {
  annual: { price: 39.99, currency: 'USD' },
  monthly: { price: 9.99, currency: 'USD' },
} as const;

// A month, not a week. Everything Pro sells is a trend across shots, and a
// weekly injector logs one shot in seven days and four in a month. A short
// trial would show an empty chart.
const PLACEHOLDER_TRIAL = '1 month free';

export function buildPlanOptions(offering: PurchasesOffering | null): PlanOption[] {
  const annualPkg = offering?.annual ?? findByType(offering, 'ANNUAL');
  const monthlyPkg = offering?.monthly ?? findByType(offering, 'MONTHLY');

  const annualPrice = annualPkg?.product.price ?? PLACEHOLDER.annual.price;
  const monthlyPrice = monthlyPkg?.product.price ?? PLACEHOLDER.monthly.price;
  const currency =
    annualPkg?.product.currencyCode ?? monthlyPkg?.product.currencyCode ?? PLACEHOLDER.annual.currency;

  return [
    {
      id: 'annual',
      pkg: annualPkg,
      title: 'Yearly',
      priceLabel: annualPkg?.product.priceString ?? formatPrice(annualPrice, currency),
      cadenceLabel: 'per year',
      perMonthLabel: `${formatPrice(annualPrice / 12, currency)} / month`,
      badge: savingsBadge(annualPrice, monthlyPrice),
      trialLabel: trialLabel(annualPkg) ?? (annualPkg ? null : PLACEHOLDER_TRIAL),
    },
    {
      id: 'monthly',
      pkg: monthlyPkg,
      title: 'Monthly',
      priceLabel: monthlyPkg?.product.priceString ?? formatPrice(monthlyPrice, currency),
      cadenceLabel: 'per month',
      perMonthLabel: null,
      badge: null,
      trialLabel: trialLabel(monthlyPkg),
    },
  ];
}

/**
 * Percent saved by paying yearly instead of twelve monthly payments. Returns
 * null when yearly is not actually cheaper — we never invent a discount.
 */
export function savingsPercent(annualPrice: number, monthlyPrice: number): number | null {
  if (!Number.isFinite(annualPrice) || !Number.isFinite(monthlyPrice)) return null;
  if (annualPrice <= 0 || monthlyPrice <= 0) return null;
  const yearOfMonthly = monthlyPrice * 12;
  if (annualPrice >= yearOfMonthly) return null;
  return Math.round((1 - annualPrice / yearOfMonthly) * 100);
}

function savingsBadge(annualPrice: number, monthlyPrice: number): string | null {
  const percent = savingsPercent(annualPrice, monthlyPrice);
  return percent === null ? null : `Save ${percent}%`;
}

/**
 * The trial in the store's own words. A one month trial is said as "1 month
 * free", never as "30 days free": the month it starts in decides whether it is
 * 28, 30 or 31 days, so a day count would be a promise we do not keep.
 */
export function trialLabel(pkg: PurchasesPackage | null | undefined): string | null {
  const intro = pkg?.product.introPrice;
  if (!intro || intro.price > 0) return null;

  const count = intro.periodNumberOfUnits;
  if (!Number.isFinite(count) || count <= 0) return null;
  const unit = intro.periodUnit?.toLowerCase() ?? '';
  const noun = unit === 'week' || unit === 'month' || unit === 'year' ? unit : 'day';
  return `${count} ${count === 1 ? noun : `${noun}s`} free`;
}

function findByType(
  offering: PurchasesOffering | null,
  packageType: string,
): PurchasesPackage | null {
  if (!offering) return null;
  return offering.availablePackages.find((pkg) => pkg.packageType === packageType) ?? null;
}

export function formatPrice(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}
