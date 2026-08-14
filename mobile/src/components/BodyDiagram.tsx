import { useMemo } from 'react';
import Svg, { Path, Circle, G, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import { Text } from './Text';
import { colors, radius, spacing } from '../theme';
import { bodySites, type BodySite, type View as BodyView } from '../domain/bodySites';
import type { Route } from '../domain/peptides';
import {
  DOT_RADIUS_VB,
  VIEWBOX,
  diagramLayout,
  dotCenter,
  dotSize,
  nearestDot,
  tapPointFrom,
} from './body-diagram-geometry';

interface BodyDiagramProps {
  view: BodyView;
  selectedId?: string | null;
  recentSiteIds?: string[];
  suggestedId?: string | null;
  route?: Route;
  onSelect: (s: BodySite) => void;
  width?: number;
  height?: number;
}

// Editorial body silhouette — lean anatomical proportions in a 100x200 viewBox.
// Traced clockwise from the crown of the head with smooth cubic curves.
//
//   y=0   crown
//   y=22  jaw
//   y=30  base of neck
//   y=44  deltoid peak (widest at top, x≈14/86)
//   y=84  natural waist (x≈30/70)
//   y=104 hip line (x≈26/74)
//   y=130 mid-thigh
//   y=152 knee
//   y=190 ankle
//   y=198 sole
const BODY_OUTLINE = `
  M 50 4
  C 56.4 4 61.6 9 61.6 16.4
  C 61.6 22 60.2 26.6 57.6 29.6
  C 65.6 30.6 73 32.6 78.6 36
  C 83.6 39 86.2 43.4 85.6 49.4
  C 84.8 56 83.4 62.4 81.4 68.4
  C 79.4 74.6 76.6 80.2 73.4 84.6
  C 71.6 87 70.8 89.6 70.6 92.6
  C 70.4 96.4 70.6 100.2 71.4 104
  C 72.4 110 73.2 116 73.4 122
  C 73.6 130 73.4 138 73 146
  C 72.6 156 72 166 71 176
  C 70.4 184 69.6 190 68.6 194
  C 68.2 196.4 66.6 197.4 64 197.4
  L 56 197.4
  C 53.4 197.4 52 196 51.6 193.4
  L 50.8 184
  C 50.2 174 50 164 50 154
  C 50 164 49.8 174 49.2 184
  L 48.4 193.4
  C 48 196 46.6 197.4 44 197.4
  L 36 197.4
  C 33.4 197.4 31.8 196.4 31.4 194
  C 30.4 190 29.6 184 29 176
  C 28 166 27.4 156 27 146
  C 26.6 138 26.4 130 26.6 122
  C 26.8 116 27.6 110 28.6 104
  C 29.4 100.2 29.6 96.4 29.4 92.6
  C 29.2 89.6 28.4 87 26.6 84.6
  C 23.4 80.2 20.6 74.6 18.6 68.4
  C 16.6 62.4 15.2 56 14.4 49.4
  C 13.8 43.4 16.4 39 21.4 36
  C 27 32.6 34.4 30.6 42.4 29.6
  C 39.8 26.6 38.4 22 38.4 16.4
  C 38.4 9 43.6 4 50 4
  Z
`;

// Subtle anatomical hints layered over the silhouette to differentiate front vs. back.
// FRONT: collarbone arc, sternum line, navel, knee creases.
// BACK:  shoulder-blade hint, spine line, glute fold, knee hollow.
const FRONT_DETAILS = `
  M 38 33 C 44 31 56 31 62 33
  M 50 36 L 50 78
  M 41 152 C 43 154 47 154 49 152
  M 51 152 C 53 154 57 154 59 152
`;

const BACK_DETAILS = `
  M 50 36 L 50 110
  M 38 50 C 42 48 46 48 49 50
  M 51 50 C 54 48 58 48 62 50
  M 32 116 C 40 124 60 124 68 116
  M 41 156 L 49 156
  M 51 156 L 59 156
`;

export function BodyDiagram({
  view,
  selectedId,
  recentSiteIds = [],
  suggestedId,
  route,
  onSelect,
  width = 200,
  height = 400,
}: BodyDiagramProps) {
  const visible = useMemo(
    () => bodySites.filter((site) => site.view === view && (!route || site.routes.includes(route))),
    [view, route],
  );
  const layout = useMemo(() => diagramLayout(width, height), [width, height]);
  const suggested = suggestedId ? visible.find((site) => site.id === suggestedId) : undefined;
  const suggestedCenter = suggested ? dotCenter(suggested, layout) : null;
  // A screen reader's element is the dot, grown to the smallest control iOS and
  // Android both ask for. Two of them overlap on a thigh, which costs nothing
  // here: the layer takes no touch, so the overlap decides nothing. It buys a
  // focus ring big enough to see and a switch target big enough to hit.
  const readerTarget = Math.max(READER_TARGET_MIN, dotSize(layout));

  // One press for the whole diagram, resolved to the dot nearest the finger.
  // Boxes drawn per site have to overlap at this size, and the overlap handed
  // the tap to whichever box was rendered last.
  const onPressDiagram = (event: GestureResponderEvent) => {
    const point = tapPointFrom(event.nativeEvent);
    if (!point) return;
    const hit = nearestDot(visible, point, layout);
    if (hit) onSelect(hit);
  };

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height} viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}>
        <Defs>
          <LinearGradient id="bodyFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.surface} stopOpacity={1} />
            <Stop offset="0.55" stopColor={colors.surface} stopOpacity={1} />
            <Stop offset="1" stopColor={colors.accentSoft} stopOpacity={1} />
          </LinearGradient>
          <LinearGradient id="bodyShade" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={colors.ink} stopOpacity={0.04} />
            <Stop offset="0.5" stopColor={colors.ink} stopOpacity={0} />
            <Stop offset="1" stopColor={colors.ink} stopOpacity={0.06} />
          </LinearGradient>
        </Defs>

        {/* base silhouette */}
        <Path
          d={BODY_OUTLINE}
          fill="url(#bodyFill)"
          stroke={colors.borderStrong}
          strokeWidth={0.7}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* soft side shading for depth */}
        <Path
          d={BODY_OUTLINE}
          fill="url(#bodyShade)"
          opacity={0.9}
        />

        {/* anatomical detail overlay — front/back specific */}
        <Path
          d={view === 'front' ? FRONT_DETAILS : BACK_DETAILS}
          stroke={colors.borderStrong}
          strokeWidth={0.45}
          strokeOpacity={0.55}
          strokeLinecap="round"
          fill="none"
        />
        {view === 'front' ? (
          <Circle cx={50} cy={96} r={1.35} fill={colors.inkMuted} opacity={0.46} />
        ) : null}

        {/* injection-site dots */}
        <G>
          {visible.map((s) => {
            const cx = s.x * VIEWBOX.width;
            const cy = s.y * VIEWBOX.height;
            const isSelected = s.id === selectedId;
            const isRecent = recentSiteIds.includes(s.id);
            if (isSelected) {
              return (
                <G key={s.id}>
                  <Circle cx={cx} cy={cy} r={SELECTED_HALO_VB} fill={colors.accent} opacity={0.12} />
                  <Circle cx={cx} cy={cy} r={SELECTED_RING_VB} fill={colors.accent} opacity={0.28} />
                  <Circle cx={cx} cy={cy} r={SELECTED_CORE_VB} fill={colors.accent} />
                </G>
              );
            }
            return (
              <G key={s.id}>
                <Circle
                  cx={cx}
                  cy={cy}
                  r={DOT_RADIUS_VB}
                  fill={colors.surface}
                  stroke={isRecent ? colors.warning : colors.borderStrong}
                  strokeWidth={1}
                />
                {isRecent && (
                  <Circle cx={cx} cy={cy} r={DOT_RADIUS_VB * 0.4} fill={colors.warning} opacity={0.7} />
                )}
              </G>
            );
          })}
        </G>
      </Svg>

      {/* One element per site, for a screen reader alone.
          A finger never reaches these: they take no pointer, and the press
          surface that follows sits over them and answers every touch. They
          are here because a reader has to be able to move through the sites
          one by one and activate the one it is on, which a single press
          surface cannot offer. Where a platform turns that activation into a
          tap at the element's own centre, the tap still resolves to this same
          site, because the element is centred on the dot. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {visible.map((s) => {
          const center = dotCenter(s, layout);
          return (
            <Pressable
              key={s.id}
              accessibilityRole="radio"
              accessibilityLabel={s.label}
              // The state is for a phone, the ARIA prop is for the web build.
              // react-native-web drops `accessibilityState` and reads `aria-*`.
              accessibilityState={{ selected: s.id === selectedId }}
              aria-checked={s.id === selectedId}
              onPress={() => onSelect(s)}
              onAccessibilityTap={() => onSelect(s)}
              style={{
                position: 'absolute',
                left: center.x - readerTarget / 2,
                top: center.y - readerTarget / 2,
                width: readerTarget,
                height: readerTarget,
              }}
            />
          );
        })}
      </View>

      {/* The press surface. It carries no label and takes no focus, so the
          reader walks the sites above and never meets one big button. */}
      <Pressable
        accessible={false}
        focusable={false}
        importantForAccessibility="no"
        style={StyleSheet.absoluteFill}
        onPress={onPressDiagram}
      />

      {suggested && suggestedCenter ? (
        <View
          pointerEvents="none"
          style={[
            styles.suggested,
            {
              left: Math.max(0, Math.min(width - SUGGESTED_WIDTH, suggestedCenter.x - SUGGESTED_WIDTH / 2)),
              top: Math.max(0, suggestedCenter.y - SUGGESTED_LIFT),
            },
          ]}
        >
          <Text variant="caption" color={colors.accent}>Suggested</Text>
        </View>
      ) : null}
    </View>
  );
}

/** The smallest square a control is allowed to be, in points. */
const READER_TARGET_MIN = 44;

// The selected dot: a solid core inside two soft rings. The outer ring stops
// short of the closest neighbour any dot has, which is 12 units on a thigh, so
// the mark reads as one site rather than as a wash over two.
const SELECTED_HALO_VB = 9.5;
const SELECTED_RING_VB = 6.4;
const SELECTED_CORE_VB = 3.9;

/** The width the suggestion pill is placed by, so it centres over its dot. */
const SUGGESTED_WIDTH = 88;
/** How far the pill sits above the dot it names, clear of the dot's halo. */
const SUGGESTED_LIFT = 50;

const styles = StyleSheet.create({
  suggested: {
    position: 'absolute',
    minWidth: SUGGESTED_WIDTH,
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
  },
});
