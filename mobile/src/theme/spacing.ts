export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  hero: 48,
  screen: 20,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const elevation = {
  none: {
    shadowOpacity: 0,
    elevation: 0,
  },
  card: {
    shadowColor: '#111418',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  raised: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
} as const;

// Onboarding's step transition, measured off the MeAgain recording at its native
// 59.94 fps rather than guessed. See `docs/meagain-onboarding-map.md` § Motion.
//
// It is a sequenced fade, not a cross-fade: the outgoing body reaches zero before
// the incoming body starts, with a short dead beat between them. The beat is what
// makes each question land as its own event. Only the body moves — the back
// chevron, the progress bar and the primary button hold at full opacity for the
// whole 725 ms.
export const onboardingMotion = {
  fadeOutMs: 330,
  holdMs: 65,
  fadeInMs: 330,
  /** 330 + 65 + 330. */
  totalMs: 725,
  /** Half-value lands at 153/334 out and 134/334 in, so the curve is symmetric. */
  easing: { x1: 0.42, y1: 0, x2: 0.58, y2: 1 },
  /** The compute ring, 0 to 100 %, decelerating. Measured, not chosen. */
  computeMs: 13_800,
} as const;
