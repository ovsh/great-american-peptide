import { useCallback, useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';
import { router, type Href } from 'expo-router';

import { onboardingMotion } from '../theme';

const { fadeOutMs, holdMs, fadeInMs, easing } = onboardingMotion;

// Measured off the recording, not chosen: the half-value lands at 153 ms of 334
// on the way out and 134 ms of 334 on the way in, which is symmetric within the
// error of a 60 fps sample. That is a standard ease-in-out, so this is one.
const CURVE = Easing.bezier(easing.x1, easing.y1, easing.x2, easing.y2);

// Reduce Motion is read once per app run rather than per screen. Twenty-three
// screens each awaiting the same native call would add a frame of blank to
// every step, which is the exact artefact this module exists to control.
let reduceMotion: boolean | null = null;
let reduceMotionPending: Promise<boolean> | null = null;

function readReduceMotion(): Promise<boolean> {
  if (reduceMotion !== null) return Promise.resolve(reduceMotion);
  reduceMotionPending ??= AccessibilityInfo.isReduceMotionEnabled()
    .then((value) => {
      reduceMotion = value;
      return value;
    })
    .catch(() => {
      reduceMotion = false;
      return false;
    });
  return reduceMotionPending;
}

AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
  reduceMotion = value;
});

/** Synchronous answer for a caller that cannot wait. Defaults to motion on. */
export function reduceMotionNow(): boolean {
  return reduceMotion ?? false;
}

void readReduceMotion();

export interface OnboardingTransition {
  /** Drive the body's opacity with this. The chrome must not read it. */
  opacity: Animated.Value;
  /** Fade the body out, hold the dead beat, then navigate. */
  go: (href: Href) => void;
  /** Same sequence, for a caller that replaces rather than pushes. */
  goBack: (href: Href) => void;
  /** Same sequence, ending in an arbitrary action rather than a route. */
  run: (action: () => void) => void;
}

/**
 * The step transition from `docs/meagain-onboarding-map.md` § Motion.
 *
 * A sequenced fade, not a cross-fade. The outgoing body reaches zero opacity,
 * both bodies hold at zero for a short dead beat, and only then does the
 * incoming body start. The beat is 65 ms — brief, but it is what makes each
 * question read as its own event instead of one long carousel.
 *
 * The screen mounts at zero and fades in, so the incoming half needs no
 * co-ordination with the outgoing screen: the outgoing screen simply does not
 * navigate until its own fade and the hold are both over.
 */
export function useOnboardingTransition(): OnboardingTransition {
  const opacity = useRef(new Animated.Value(0)).current;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const navigating = useRef(false);

  useEffect(() => {
    let cancelled = false;
    readReduceMotion().then((skip) => {
      if (cancelled) return;
      if (skip) {
        opacity.setValue(1);
        return;
      }
      Animated.timing(opacity, {
        toValue: 1,
        duration: fadeInMs,
        easing: CURVE,
        useNativeDriver: true,
      }).start();
    });
    const pending = timers.current;
    return () => {
      cancelled = true;
      for (const timer of pending) clearTimeout(timer);
      pending.length = 0;
    };
  }, [opacity]);

  const run = useCallback((action: () => void) => {
    // A second press during the fade would queue a second navigation and land
    // the user two screens on. One transition at a time.
    if (navigating.current) return;
    navigating.current = true;

    if (reduceMotionNow()) {
      navigating.current = false;
      action();
      return;
    }

    Animated.timing(opacity, {
      toValue: 0,
      duration: fadeOutMs,
      easing: CURVE,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) {
        // The fade was cut short, so the body is stranded part way to invisible
        // and no re-render puts it back: `opacity` lives in a ref, outside React
        // state. Lock the screen, take a call, come back, and the question you
        // were reading is gone for good. Put it back where it started.
        opacity.setValue(1);
        navigating.current = false;
        return;
      }
      timers.current.push(setTimeout(() => {
        navigating.current = false;
        action();
      }, holdMs));
    });
  }, [opacity]);

  const go = useCallback((href: Href) => run(() => router.push(href)), [run]);
  const goBack = useCallback((href: Href) => run(() => router.replace(href)), [run]);

  return { opacity, go, goBack, run };
}
