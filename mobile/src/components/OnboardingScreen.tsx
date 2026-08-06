import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { ChevronLeft, Check } from 'lucide-react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from './Card';
import { Text } from './Text';
import { colors, radius, spacing } from '../theme';

type OnboardingBackHref =
  | './'
  | './taking'
  | './schedule'
  | './goal'
  | './weight'
  | './concerns'
  | './reminders';

interface OnboardingScreenProps {
  step: number;
  backHref?: OnboardingBackHref;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  bodyStyle?: StyleProp<ViewStyle>;
}

export function OnboardingScreen({
  step,
  backHref,
  title,
  subtitle,
  children,
  footer,
  contentStyle,
  bodyStyle,
}: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerInner}>
          {backHref ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={() => router.replace(backHref)}
              style={styles.backButton}
            >
              <ChevronLeft size={24} color={colors.ink} />
            </Pressable>
          ) : null}
          <View accessibilityLabel={`Step ${step + 1} of 8`} style={styles.dots}>
            {Array.from({ length: 8 }, (_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  index < step && styles.dotComplete,
                  index === step && styles.dotActive,
                ]}
              />
            ))}
          </View>
        </View>
      </View>

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, spacing.xl) },
        ]}
      >
        <View style={[styles.content, contentStyle]}>
          {title ? <Text variant="display">{title}</Text> : null}
          {subtitle ? <Text color={colors.inkMuted}>{subtitle}</Text> : null}
          <View style={[styles.body, bodyStyle]}>{children}</View>
          <View style={styles.footer}>{footer}</View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

interface SelectionCardProps {
  title: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  compact?: boolean;
  role?: 'checkbox' | 'radio';
}

export function SelectionCard({
  title,
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
          <Text variant={compact ? 'smallStrong' : 'bodyStrong'}>{title}</Text>
          {description ? <Text variant="small" color={colors.inkMuted}>{description}</Text> : null}
        </View>
        <View style={[styles.check, selected && styles.checkSelected]}>
          {selected ? <Check size={14} strokeWidth={3} color={colors.inkInverse} /> : null}
        </View>
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
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.borderStrong,
  },
  dotComplete: {
    backgroundColor: colors.accentSoft,
  },
  dotActive: {
    width: 20,
    backgroundColor: colors.accent,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.screen,
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
  footer: {
    marginTop: 'auto',
    paddingTop: spacing.xxxl,
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
