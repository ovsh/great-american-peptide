import type { ReactNode } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { ChevronLeft, Check } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import type { Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from './Card';
import { MarkChip } from './EstimateMark';
import { Text } from './Text';
import type { OnboardingTransition } from './onboardingTransition';
import { colors, radius, spacing } from '../theme';

interface OnboardingScreenProps {
  /**
   * Zero-based position in the flow. The setup run divides one step between
   * its screens, so this can be fractional. See `setupStepIndex`.
   */
  step: number;
  totalSteps: number;
  backHref?: Href;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  bodyStyle?: StyleProp<ViewStyle>;
  /**
   * The step transition. Passing it fades the body in on mount and out on the
   * way to the next screen. The chrome around it never fades: in the recording
   * the back chevron, the progress bar and the primary button all hold at full
   * opacity for the whole 725 ms, and that is what makes the transition read as
   * one screen changing rather than the whole app blinking.
   */
  transition?: OnboardingTransition;
  /** Hide the progress bar. The carousel and the plan sit outside the count. */
  hideProgress?: boolean;
}

export function OnboardingScreen({
  step,
  totalSteps,
  backHref,
  title,
  subtitle,
  children,
  footer,
  contentStyle,
  bodyStyle,
  transition,
  hideProgress = false,
}: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const total = Math.max(1, totalSteps);
  // The bar reads the step the user is on, out of the total, so it is a true
  // fraction. Twenty-three, fixed, as it is in the recording.
  const progress = Math.min(1, Math.max(0, (step + 1) / total));
  // Floor rather than round: every screen of the setup run reads as step 9,
  // which is what they all are. Rounding would push the later ones onto the
  // number the next screen announces.
  const spoken = Math.floor(step) + 1;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerInner}>
          {backHref && transition ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={() => transition.goBack(backHref)}
              style={styles.backButton}
              hitSlop={8}
            >
              <ChevronLeft size={24} color={colors.ink} />
            </Pressable>
          ) : null}
          {hideProgress ? null : (
            <View
              accessibilityRole="progressbar"
              accessibilityLabel={`Step ${spoken} of ${total}`}
              accessibilityValue={{ min: 0, max: total, now: spoken }}
              style={styles.track}
            >
              <View style={[styles.fill, { width: `${progress * 100}%` }]} />
            </View>
          )}
        </View>
      </View>

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        <Animated.View
          style={[
            styles.content,
            contentStyle,
            transition ? { opacity: transition.opacity } : null,
          ]}
        >
          {title ? <Text variant="display">{title}</Text> : null}
          {subtitle ? <Text color={colors.inkMuted}>{subtitle}</Text> : null}
          <View style={[styles.body, bodyStyle]}>{children}</View>
        </Animated.View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.xl) }]}>
        <View style={styles.footerInner}>{footer}</View>
      </View>
    </KeyboardAvoidingView>
  );
}

interface SelectionCardProps {
  title: string;
  /** A quiet word beside the title, for the one row in a list that needs it. */
  marker?: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  compact?: boolean;
  role?: 'checkbox' | 'radio';
}

export function SelectionCard({
  title,
  marker,
  description,
  selected,
  onPress,
  compact = false,
  role = 'checkbox',
}: SelectionCardProps) {
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={role === 'checkbox' ? { checked: selected } : { selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.choicePressable, pressed && styles.pressed]}
    >
      <Card
        padding={compact ? 'md' : 'lg'}
        style={[
          styles.choiceCard,
          { backgroundColor: selected ? colors.accentSoft : colors.surface },
        ]}
      >
        <View style={styles.choiceCopy}>
          <View style={styles.choiceTitle}>
            <Text variant={compact ? 'smallStrong' : 'bodyStrong'} style={styles.choiceName}>
              {title}
            </Text>
            {marker ? <MarkChip label={marker} /> : null}
          </View>
          {description ? <Text variant="small" color={colors.inkMuted}>{description}</Text> : null}
        </View>
        <View style={[styles.check, selected && styles.checkSelected]}>
          {selected ? <Check size={14} strokeWidth={3} color={colors.inkInverse} /> : null}
        </View>
      </Card>
    </Pressable>
  );
}

interface IconChoiceCardProps {
  /** The lucide component itself. The card colours it with the selection. */
  icon: LucideIcon;
  label: string;
  selected: boolean;
  onPress: () => void;
  role?: 'checkbox' | 'radio';
}

/**
 * A card that carries a picture rather than a check.
 *
 * `SelectionCard` is a row and it stacks, which is right for five sentences and
 * wrong for six one-word answers: six stacked rows are a scroll, and the words
 * are short enough that the eye is looking for the shape before it reads. This
 * card is square, it sits in a row of two, and the icon is the thing that is
 * scanned. The check would only repeat what the fill already says, so the fill
 * is the whole selected state.
 *
 * It carries `flex: 1`, so a row of them divides the width evenly and one on a
 * row of its own runs the full width. The caller owns the rows.
 */
export function IconChoiceCard({
  icon: Icon,
  label,
  selected,
  onPress,
  role = 'radio',
}: IconChoiceCardProps) {
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={role === 'checkbox' ? { checked: selected } : { selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.iconChoice, pressed && styles.pressed]}
    >
      <Card
        padding="lg"
        style={[
          styles.iconCard,
          { backgroundColor: selected ? colors.accentSoft : colors.surface },
        ]}
      >
        <Icon size={26} strokeWidth={1.75} color={selected ? colors.accent : colors.inkMuted} />
        <Text variant="smallStrong" align="center">{label}</Text>
      </Card>
    </Pressable>
  );
}

interface ChoicePillProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  style?: ViewStyle;
}

export function ChoicePill({ label, selected, onPress, style }: ChoicePillProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        selected && styles.pillSelected,
        pressed && styles.pressed,
        style,
      ]}
    >
      <Text variant="smallStrong" color={selected ? colors.inkInverse : colors.ink}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.screen,
  },
  headerInner: {
    width: '100%',
    maxWidth: 560,
    minHeight: 44,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  track: {
    // `stretch`, not `width: '100%'`. The parent centres its children, so a full
    // width plus the left margin below would push the right end of the bar off
    // the screen by the width of that margin.
    alignSelf: 'stretch',
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.borderStrong,
    // The chevron sits at the left edge, so the bar starts clear of it.
    marginLeft: spacing.hero,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.xl,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 560,
    paddingTop: spacing.xxl,
    gap: spacing.md,
  },
  body: {
    gap: spacing.md,
    paddingTop: spacing.xl,
  },
  // Pinned, outside the ScrollView and outside the fading body. The button is
  // in the same place on every screen and it does not move during a transition.
  footer: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
  },
  footerInner: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    gap: spacing.md,
  },
  choicePressable: {
    flexGrow: 1,
  },
  pressed: {
    opacity: 0.78,
  },
  choiceCard: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  choiceCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  choiceTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  choiceName: {
    flexShrink: 1,
  },
  iconChoice: {
    flex: 1,
  },
  iconCard: {
    minHeight: 116,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  pill: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
});
