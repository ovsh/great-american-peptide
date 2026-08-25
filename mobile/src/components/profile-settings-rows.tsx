import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Check, Lock } from 'lucide-react-native';

import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { colors, fonts, radius, spacing } from '@/theme';

/**
 * The parts every Profile row is built from.
 *
 * One convention runs through all of them: **a value you can change is a pill, a
 * value you cannot is plain text**. That is what replaced the chevrons and the
 * boilerplate subtitles — "Dose, schedule and status", "Weight display", "At
 * your usual shot time" — which restated their own titles on every row.
 */

const ROW_HEIGHT = 56;
const PRO_ROW_HEIGHT = 60;
const ICON_SLOT = 24;
/** A chip stands short so the field stays a field. Hit slop brings it to 44. */
const CHIP_HEIGHT = 34;
const CHIP_SLOP = 5;
/** Where a divider starts: past the icon, under the label. */
const DIVIDER_INSET = spacing.lg + ICON_SLOT + spacing.md;

/** A group of rows on one white surface. `Card` owns the radius and the shadow. */
export function ProfileCard({ children }: { children: ReactNode }) {
  return (
    <Card padding="xs" style={styles.card}>
      {children}
    </Card>
  );
}

interface ProfileRowProps {
  icon: ReactNode;
  label: string;
  /** The value slot on the right: a pill, a segment, plain text. */
  value?: ReactNode;
  onPress?: () => void;
  /** False on the first row of a card, where a divider would draw on nothing. */
  divided?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}

/** One setting: icon, label, value. One line, always. */
export function ProfileRow({
  icon,
  label,
  value,
  onPress,
  divided = true,
  accessibilityLabel,
  testID,
}: ProfileRowProps) {
  const body = (
    <>
      {divided ? <View pointerEvents="none" style={styles.divider} /> : null}
      <View style={styles.icon}>{icon}</View>
      <Text variant="bodyStrong" numberOfLines={1} style={styles.label}>{label}</Text>
      {value === undefined ? null : <View style={styles.value}>{value}</View>}
    </>
  );

  if (!onPress) {
    return <View testID={testID} style={styles.row}>{body}</View>;
  }

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

/**
 * A value the user owns. `quiet` is the same pill with the emphasis taken out:
 * the reminder time stays readable when reminders are off, rather than
 * disappearing with the row that used to carry it.
 */
export function ProfileValuePill({ label, quiet = false }: { label: string; quiet?: boolean }) {
  return (
    <View style={[styles.pill, quiet && styles.pillQuiet]}>
      <Text
        variant="caption"
        color={quiet ? colors.inkMuted : colors.ink}
        style={quiet ? styles.pillQuietText : styles.pillText}
      >
        {label}
      </Text>
    </View>
  );
}

/**
 * The one selection axis on this screen: lb or kg.
 *
 * It is deliberately not the accent-green toggle the rest of the app uses. Green
 * on Profile means a shot happened, and a green pill on a units row would be the
 * fifth green thing on a screen whose whole argument is one accent.
 */
export function ProfileSegment<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  label: string;
}) {
  return (
    <View style={styles.segment}>
      {options.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityLabel={`${label}, ${option}`}
            accessibilityState={{ selected }}
            hitSlop={{ top: 10, bottom: 10 }}
            onPress={() => onChange(option)}
            style={[styles.segmentItem, selected && styles.segmentItemOn]}
          >
            <Text
              variant="caption"
              color={selected ? colors.ink : colors.inkMuted}
              style={styles.segmentLabel}
            >
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * The chips that belong to the row above them, indented to its label.
 *
 * A chip here is a switch and not a filter, so an on chip fills with the accent
 * the way every other "this is on" surface in the app does. There is no header
 * over the field and no count under it: the row names the setting, and the
 * chips are the answer to it. `caption` is the one line the field may add, and
 * the caller passes it only when the field says something the chips cannot.
 */
export function ProfileChipField<T extends string>({
  options,
  selected,
  onToggle,
  caption,
  testID,
}: {
  options: readonly { id: T; label: string }[];
  selected: readonly T[];
  onToggle: (id: T) => void;
  caption?: string;
  testID?: string;
}) {
  return (
    <View testID={testID} style={styles.chipField}>
      <View style={styles.chips}>
        {options.map((option) => {
          const on = selected.includes(option.id);
          return (
            <Pressable
              key={option.id}
              accessibilityRole="checkbox"
              accessibilityLabel={option.label}
              accessibilityState={{ checked: on }}
              hitSlop={{ top: CHIP_SLOP, bottom: CHIP_SLOP }}
              onPress={() => onToggle(option.id)}
              style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && styles.chipPressed]}
            >
              <Text variant="caption" color={on ? colors.inkInverse : colors.ink} style={styles.pillText}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {caption === undefined ? null : (
        <Text variant="caption" color={colors.inkSubtle}>{caption}</Text>
      )}
    </View>
  );
}

/** What the export row shows on its right: the file, the lock, or the work. */
export function ProfileExportValue({ state }: { state: 'idle' | 'locked' | 'busy' }) {
  if (state === 'busy') {
    return <ActivityIndicator size="small" color={colors.accent} />;
  }
  if (state === 'locked') {
    return (
      <View style={styles.lockValue}>
        <Lock size={16} strokeWidth={1.8} color={colors.inkSubtle} />
        <Text variant="caption" color={colors.inkSubtle}>CSV</Text>
      </View>
    );
  }
  return <Text variant="caption" color={colors.inkMuted}>CSV</Text>;
}

/**
 * The account state, and the last row of its card in both states.
 *
 * `offer` fills soft green and carries the only solid button on the screen.
 * `active` goes white and quiet. Never a bordered lock box, and never absent:
 * the slot holds the same position whichever side of the paywall the user is on.
 */
export function ProfileProSlot({
  state,
  icon,
  onPress,
  accessibilityLabel,
  testID,
}: {
  state: 'offer' | 'active';
  icon: ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  testID?: string;
}) {
  const offer = state === 'offer';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      // The offer row is the one green surface here, so it dims under a finger
      // rather than turning gray the way a white row does.
      style={({ pressed }) => [
        styles.pro,
        offer && styles.proOffer,
        pressed && (offer ? styles.proPressed : styles.pressed),
      ]}
    >
      {offer ? null : <View pointerEvents="none" style={styles.divider} />}
      <View style={styles.icon}>{icon}</View>
      <Text variant="bodyStrong" color={offer ? colors.successDeep : colors.ink} style={styles.label}>
        Poke Pro
      </Text>
      {offer ? (
        <View style={styles.cta}>
          <Text variant="caption" color={colors.inkInverse} style={styles.pillText}>See Poke Pro</Text>
        </View>
      ) : (
        <View style={styles.activePill}>
          <Check size={13} strokeWidth={2.6} color={colors.successDeep} />
          <Text variant="caption" color={colors.successDeep} style={styles.pillText}>Active</Text>
        </View>
      )}
    </Pressable>
  );
}

/**
 * A plain link under the cards. No card, no icon, no chevron: it is a word.
 *
 * `value` is the state the link leads to, set on the right of the row. Pass it
 * only when the state is worth reading before the tap.
 */
export function ProfileLink({
  label,
  value,
  onPress,
  testID,
}: {
  label: string;
  value?: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={value === undefined ? label : `${label}. ${value}`}
      onPress={onPress}
      style={({ pressed }) => [styles.link, pressed && styles.linkPressed]}
    >
      {value === undefined ? (
        <Text variant="smallStrong" color={colors.inkMuted}>{label}</Text>
      ) : (
        <View style={styles.linkRow}>
          <Text variant="smallStrong" color={colors.inkMuted} style={styles.label}>{label}</Text>
          <Text variant="small" color={colors.inkSubtle}>{value}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 0,
    overflow: 'hidden',
  },
  row: {
    minHeight: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  divider: {
    position: 'absolute',
    left: DIVIDER_INSET,
    right: 0,
    top: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
  },
  icon: {
    width: ICON_SLOT,
    height: ICON_SLOT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    minWidth: 0,
  },
  value: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pill: {
    height: 30,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.background,
  },
  pillQuiet: {
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  pillText: {
    fontFamily: fonts.sansSemiBold,
    fontVariant: ['tabular-nums'],
  },
  pillQuietText: {
    fontVariant: ['tabular-nums'],
  },
  // Indented to the label of the row above, so the chips read as its answer
  // rather than as a block of their own.
  chipField: {
    gap: spacing.sm,
    paddingLeft: DIVIDER_INSET,
    paddingRight: spacing.lg,
    paddingBottom: spacing.md,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    minHeight: CHIP_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.background,
  },
  chipOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  chipPressed: {
    opacity: 0.78,
  },
  segment: {
    flexDirection: 'row',
    padding: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  segmentItem: {
    minWidth: 38,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  segmentItemOn: {
    backgroundColor: colors.surface,
    shadowColor: colors.cardShadow,
    shadowOpacity: 0.14,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentLabel: {
    fontFamily: fonts.sansSemiBold,
  },
  lockValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  pro: {
    minHeight: PRO_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
  },
  proOffer: {
    backgroundColor: colors.successSoft,
  },
  cta: {
    height: 34,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg - 1,
    borderRadius: radius.pill,
    backgroundColor: colors.successDeep,
  },
  activePill: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md - 1,
    borderRadius: radius.pill,
    backgroundColor: colors.successSoft,
  },
  link: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  linkPressed: {
    opacity: 0.6,
  },
  proPressed: {
    opacity: 0.88,
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
});
