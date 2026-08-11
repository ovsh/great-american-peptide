import Svg, { Path, Circle, G, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Pressable, View } from 'react-native';
import { colors } from '../theme';
import { bodySites, type BodySite, type View as BodyView } from '../domain/bodySites';

interface BodyDiagramProps {
  view: BodyView;
  selectedId?: string | null;
  recentSiteIds?: string[];
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
  M 50 96 m -1.2 0 a 1.2 1.6 0 1 0 2.4 0 a 1.2 1.6 0 1 0 -2.4 0
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
  onSelect,
  width = 200,
  height = 400,
}: BodyDiagramProps) {
  const visible = bodySites.filter((s) => s.view === view);
  const VBW = 100;
  const VBH = 200;

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height} viewBox={`0 0 ${VBW} ${VBH}`}>
        <Defs>
          <LinearGradient id="bodyFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFCF4" stopOpacity={1} />
            <Stop offset="0.55" stopColor={colors.surface} stopOpacity={1} />
            <Stop offset="1" stopColor="#EDE3CD" stopOpacity={1} />
          </LinearGradient>
          <LinearGradient id="bodyShade" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#0F1B2D" stopOpacity={0.04} />
            <Stop offset="0.5" stopColor="#0F1B2D" stopOpacity={0} />
            <Stop offset="1" stopColor="#0F1B2D" stopOpacity={0.06} />
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

        {/* injection-site dots */}
        <G>
          {visible.map((s) => {
            const cx = s.x * VBW;
            const cy = s.y * VBH;
            const isSelected = s.id === selectedId;
            const isRecent = recentSiteIds.includes(s.id);
            if (isSelected) {
              return (
                <G key={s.id}>
                  <Circle cx={cx} cy={cy} r={9} fill={colors.red} opacity={0.12} />
                  <Circle cx={cx} cy={cy} r={5.5} fill={colors.red} opacity={0.28} />
                  <Circle cx={cx} cy={cy} r={3.2} fill={colors.red} />
                </G>
              );
            }
            return (
              <G key={s.id}>
                <Circle
                  cx={cx}
                  cy={cy}
                  r={3.6}
                  fill={colors.surface}
                  stroke={isRecent ? colors.warning : colors.borderStrong}
                  strokeWidth={0.8}
                />
                {isRecent && (
                  <Circle cx={cx} cy={cy} r={1.4} fill={colors.warning} opacity={0.7} />
                )}
              </G>
            );
          })}
        </G>
      </Svg>

      {/* tap targets */}
      <View
        style={{
          position: 'absolute',
          width,
          height,
        }}
        pointerEvents="box-none"
      >
        {visible.map((s) => {
          const px = s.x * width - 22;
          const py = s.y * height - 22;
          return (
            <Pressable
              key={s.id}
              onPress={() => onSelect(s)}
              style={{
                position: 'absolute',
                left: px,
                top: py,
                width: 44,
                height: 44,
              }}
              hitSlop={4}
            />
          );
        })}
      </View>
    </View>
  );
}
