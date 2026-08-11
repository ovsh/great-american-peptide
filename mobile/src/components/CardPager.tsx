import { Children, isValidElement, useEffect, useRef, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import { colors, radius, spacing } from '../theme';

/** The air between two pages. One snap step is one page plus one gap. */
const PAGE_GAP = spacing.md;
/**
 * How far the scroll view reaches past its column. A scroll view clips its
 * content, and a card shadow lives outside the card, so without this bleed the
 * cards in the pager lose the shadow the same card keeps everywhere else. The
 * horizontal bleed is exactly one gap, so the next card stops at the edge of the
 * frame instead of peeking into the gutter.
 */
const BLEED_X = PAGE_GAP;
const BLEED_Y = spacing.xxl;
/** The size the onboarding pager already uses for the same row of dots. */
const DOT_SIZE = spacing.sm;

interface CardPagerProps {
  /**
   * The width of one page, in points. The parent owns the column, so the parent
   * is the one that knows this.
   */
  pageWidth: number;
  /** The singular noun for one page. A screen reader hears "Medication 2 of 3". */
  pageName: string;
  /**
   * The key of the page to open on, or null for the first page. It is the key
   * the caller wrote on the child. The pager holds that page while the list
   * re-sorts, so a caller that has just written a row keeps the page it asked
   * for rather than the one that now sits at the same offset.
   */
  focusKey?: string | null;
  /** Called on the first drag, so the caller can drop its `focusKey`. */
  onUserScroll?: () => void;
  children: ReactNode;
}

/**
 * A row of cards, one page wide, that snaps to one card and marks the place with
 * a row of dots.
 *
 * `snapToInterval` is the snap, the way `WheelPicker` does it. react-native-web
 * does not implement it, so the web preview scrolls free and only the dots keep
 * up. The phone is the one that snaps.
 *
 * The pager stands as tall as its tallest page. Two cards of different heights
 * therefore leave space under the shorter one. That is the price of a row of
 * tiles below that holds still while the finger moves, and the tiles matter more.
 */
export function CardPager({
  pageWidth,
  pageName,
  focusKey = null,
  onUserScroll,
  children,
}: CardPagerProps) {
  const pages = Children.toArray(children);
  const [index, setIndex] = useState(0);
  const step = pageWidth + PAGE_GAP;
  const scroller = useRef<ScrollView>(null);
  // Where the asked-for page sits now. The scroll below depends on this number
  // rather than on the key, so a re-sort carries the pager with it. A shot lifts
  // its medication up the order, and the card at the old offset is by then a
  // different medication.
  const focusIndex = focusKey === null ? -1 : pages.map(callerKey).indexOf(focusKey);

  useEffect(() => {
    if (focusIndex < 0 || step <= 0) return;
    scroller.current?.scrollTo({ x: focusIndex * step, animated: true });
    setIndex(focusIndex);
  }, [focusIndex, step]);

  // Read the offset on every scroll frame rather than on momentum end. iOS fires
  // no momentum end when the finger drags a page across and lets go without a
  // flick, and dots that miss that gesture point at the wrong card.
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (step <= 0) return;
    const raw = Math.round(event.nativeEvent.contentOffset.x / step);
    const next = Math.min(pages.length - 1, Math.max(0, raw));
    setIndex((current) => (current === next ? current : next));
  };

  if (pages.length === 0) return null;
  // A shorter list than the one the finger last scrolled leaves the mark past the
  // end, and then no dot is lit at all.
  const active = Math.min(index, pages.length - 1);

  return (
    <View style={styles.wrap}>
      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        disableIntervalMomentum
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={onScroll}
        onScrollBeginDrag={onUserScroll}
        style={styles.scroller}
        contentContainerStyle={styles.track}
      >
        {pages.map((page, position) => (
          <View key={pageKey(page, position)} style={{ width: pageWidth }}>
            {page}
          </View>
        ))}
      </ScrollView>

      <View
        style={styles.dots}
        accessibilityRole="tablist"
        accessibilityLabel={`${pageName} ${active + 1} of ${pages.length}`}
      >
        {pages.map((page, position) => (
          <View
            key={pageKey(page, position)}
            style={[styles.dot, position === active && styles.dotActive]}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * `Children.toArray` already gave every element a stable key from the key the
 * caller wrote. Reuse it, so a page keeps its identity when the order changes.
 */
function pageKey(page: ReactNode, position: number): string {
  return isValidElement(page) && page.key !== null ? page.key : String(position);
}

/**
 * The key the caller actually wrote. `Children.toArray` prefixes what it hands
 * back with `.$`, so the key on the page is not the string the caller passed as
 * `focusKey`, and a plain match against it finds nothing.
 */
const TO_ARRAY_PREFIX = '.$';

function callerKey(page: ReactNode, position: number): string {
  const key = pageKey(page, position);
  return key.startsWith(TO_ARRAY_PREFIX) ? key.slice(TO_ARRAY_PREFIX.length) : key;
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  scroller: {
    marginHorizontal: -BLEED_X,
    marginVertical: -BLEED_Y,
  },
  track: {
    gap: PAGE_GAP,
    paddingHorizontal: BLEED_X,
    paddingVertical: BLEED_Y,
  },
  dots: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignSelf: 'center',
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: radius.pill,
    backgroundColor: colors.borderStrong,
  },
  dotActive: {
    backgroundColor: colors.accent,
  },
});
