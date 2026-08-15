import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Check, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Line } from 'react-native-svg';

import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { Input } from '@/components/Input';
import { SeveritySlider } from '@/components/SeveritySlider';
import { Text } from '@/components/Text';
import {
  SIDE_EFFECT_PRESETS,
  makeCustomSideEffect,
  sideEffectLabel,
  type SideEffect,
  type SideEffectPresetId,
} from '@/domain/sideEffects';
import { createSideEffect, listSideEffects, markDayAllClear } from '@/repositories/sideEffects';
import { track } from '@/services/analytics';
import { refreshScheduledReminders } from '@/services/notifications';
import { useAppStore } from '@/stores/app';
import { colors, radius, spacing } from '@/theme';
import { fmtTime, startOfDay } from '@/utils/date';
import { safeBack } from '@/utils/nav';

type EffectChoice =
  | { kind: 'preset'; id: SideEffectPresetId }
  | { kind: 'custom' };

/** The bottom of the scale the slider draws. It is a real answer, never a default. */
const SEVERITY_MIN = 0;

/**
 * A typed label that reads as a preset becomes that preset. The storage key of a
 * custom effect differs from the preset id, so "Nausea" typed by hand would count
 * as a second effect on Progress. Match here, at the caller, and leave the key alone.
 */
function presetForLabel(value: string): SideEffect | null {
  const typed = value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  if (!typed) return null;
  const preset = SIDE_EFFECT_PRESETS.find((option) => option.label.toLocaleLowerCase() === typed);
  return preset ? { kind: 'preset', id: preset.id } : null;
}

export default function LogSideEffectScreen() {
  const bumpVersion = useAppStore((state) => state.bumpVersion);
  const [choice, setChoice] = useState<EffectChoice>({ kind: 'preset', id: 'nausea' });
  const [customEffect, setCustomEffect] = useState('');
  // Null until the user sets it. `severity` is NOT NULL in the table and 0 is a real
  // answer on the scale, so an untouched slider must not reach the row at all.
  const [severity, setSeverity] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // Separate from `saving`: the Log button prints "Saving" off that flag, and
  // the all-clear writing under it must not make the symptom button claim work
  // it is not doing. Each flow still disables the other while it runs.
  const [marking, setMarking] = useState(false);
  /** When today's all-clear was recorded, or null. Drives the band's done face. */
  const [clearedAt, setClearedAt] = useState<number | null>(null);
  const returnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (returnTimer.current) clearTimeout(returnTimer.current);
  }, []);

  // The band has two faces, so it has to know on arrival whether today already
  // carries a clear. A wrong first face would flash the offer at a user who
  // answered this morning.
  useEffect(() => {
    let alive = true;
    listSideEffects({ fromMs: startOfDay(Date.now()) })
      .then((logs) => {
        if (!alive) return;
        const clear = logs.find((log) => log.effect.kind === 'clear');
        if (clear) setClearedAt(clear.taken_at);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const typedPreset = choice.kind === 'custom' ? presetForLabel(customEffect) : null;
  const effect: SideEffect | null = choice.kind === 'preset'
    ? { kind: 'preset', id: choice.id }
    : typedPreset ?? makeCustomSideEffect(customEffect);

  const save = async () => {
    if (saving || marking || !effect || severity === null) return;
    setSaving(true);
    try {
      await createSideEffect({
        effect,
        severity,
        takenAt: Date.now(),
        notes: notes.trim() || null,
      });
      bumpVersion();
      // This answers the day-after check-in, so the queue drops it.
      await refreshScheduledReminders().catch(() => {});
      // Which side effect and how bad it was stay on the phone. The event only
      // says a day was reported.
      track('side_effect_logged', { clear: false });
      setSaved(true);
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      returnTimer.current = setTimeout(() => safeBack('/'), 650);
    } catch (error: unknown) {
      Alert.alert('Poke could not save your side effect', error instanceof Error ? error.message : 'Try again.');
      setSaving(false);
    }
  };

  // One clear per day: the repository returns the existing record on a second
  // press, so pressing the done face confirms and closes rather than dead-tapping.
  const markClear = async () => {
    if (saving || marking) return;
    setMarking(true);
    try {
      const record = await markDayAllClear(Date.now());
      bumpVersion();
      // This answers the day-after check-in, so the queue drops it.
      await refreshScheduledReminders().catch(() => {});
      track('side_effect_logged', { clear: true });
      setClearedAt(record.taken_at);
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      returnTimer.current = setTimeout(() => safeBack('/'), 650);
    } catch (error: unknown) {
      Alert.alert('Poke could not mark the day clear', error instanceof Error ? error.message : 'Try again.');
      setMarking(false);
    }
  };

  return (
    <View style={styles.root}>
      <Header
        title="Log side effect"
        leading={(
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => safeBack('/')} style={styles.close}>
            <X size={22} color={colors.ink} />
          </Pressable>
        )}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* The other answer to the check-in. It draws the mark it leaves: the
            same hollow ring on the baseline that a clear day gets on the
            Progress chart, so the record and the control share one language. */}
        <Pressable
          testID="side-effect-all-clear"
          accessibilityRole="button"
          accessibilityLabel={clearedAt === null
            ? 'Mark today clear'
            : `Today is marked clear at ${fmtTime(clearedAt).toLowerCase()}`}
          disabled={saving || marking}
          onPress={markClear}
          style={[styles.clearBand, clearedAt !== null && styles.clearBandDone]}
        >
          <ClearMark />
          {clearedAt !== null ? (
            <View style={styles.clearDone}>
              <Check size={16} strokeWidth={2.5} color={colors.successDeep} />
              <Text variant="smallStrong" color={colors.successDeep}>
                Marked clear at {fmtTime(clearedAt).toLowerCase()}
              </Text>
            </View>
          ) : (
            <Text variant="smallStrong">Mark today clear</Text>
          )}
        </Pressable>

        <View style={styles.section}>
          <Text variant="smallStrong">What are you feeling?</Text>
          <View style={styles.wrap}>
            {SIDE_EFFECT_PRESETS.map((item) => {
              const selected = choice.kind === 'preset' && choice.id === item.id;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setChoice({ kind: 'preset', id: item.id })}
                  style={[styles.pill, selected && styles.pillSelected]}
                >
                  <Text variant="smallStrong" color={selected ? colors.inkInverse : colors.ink}>{item.label}</Text>
                </Pressable>
              );
            })}
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: choice.kind === 'custom' }}
              onPress={() => setChoice({ kind: 'custom' })}
              style={[styles.pill, choice.kind === 'custom' && styles.pillSelected]}
            >
              <Text variant="smallStrong" color={choice.kind === 'custom' ? colors.inkInverse : colors.ink}>
                Custom
              </Text>
            </Pressable>
          </View>
          {choice.kind === 'custom' ? (
            <>
              <Input
                autoFocus
                value={customEffect}
                onChangeText={setCustomEffect}
                placeholder="Name the side effect"
                accessibilityLabel="Custom side effect"
                maxLength={60}
              />
              {typedPreset ? (
                <Text variant="caption" color={colors.inkMuted}>
                  Poke logs this as {sideEffectLabel(typedPreset)}.
                </Text>
              ) : null}
            </>
          ) : null}
        </View>

        <View style={styles.section}>
          <View style={styles.severityHead}>
            <View style={styles.severityCopy}>
              <Text variant="smallStrong">Severity</Text>
              <Text variant="small" color={colors.inkMuted}>Drag to set 0 through 10.</Text>
            </View>
            {severity === null ? (
              <Text
                accessibilityLiveRegion="polite"
                variant="smallStrong"
                color={colors.inkMuted}
                style={styles.severityUnset}
              >
                Not set
              </Text>
            ) : (
              <Text accessibilityLiveRegion="polite" style={styles.severityValue}>{severity}</Text>
            )}
          </View>
          <SeveritySlider value={severity ?? SEVERITY_MIN} onChange={setSeverity} />
          {severity === null ? (
            <Text variant="caption" color={colors.inkMuted}>Poke saves the side effect after you set the severity.</Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text variant="smallStrong">Note <Text variant="small" color={colors.inkMuted}>(optional)</Text></Text>
          <Input
            value={notes}
            onChangeText={setNotes}
            placeholder="Add a note"
            accessibilityLabel="Optional note"
            maxLength={240}
          />
        </View>

        {saved ? (
          <View accessibilityLiveRegion="polite" style={styles.saved}>
            <Check size={18} strokeWidth={2.5} color={colors.accent} />
            <Text variant="smallStrong" color={colors.accent}>Saved</Text>
          </View>
        ) : null}
        <Button disabled={saving || marking || !effect || severity === null} onPress={save}>
          {saving ? 'Saving' : 'Log side effect'}
        </Button>
      </ScrollView>
    </View>
  );
}

/**
 * A clear day as the chart draws it: a hollow ring sitting on the baseline.
 * Violet is the side-effect hue everywhere; hollow is what "asked, and nothing
 * to report" looks like next to the filled dot of a logged symptom.
 */
function ClearMark() {
  return (
    <Svg width={44} height={20}>
      <Line x1={2} y1={13} x2={42} y2={13} stroke={colors.violet} strokeOpacity={0.3} strokeWidth={1.6} strokeLinecap="round" />
      <Circle cx={22} cy={13} r={5.5} fill={colors.surface} stroke={colors.violet} strokeOpacity={0.7} strokeWidth={2} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  close: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    gap: spacing.xxxl,
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.hero,
  },
  section: {
    gap: spacing.md,
  },
  clearBand: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  clearBandDone: {
    borderColor: colors.accentSoft,
    backgroundColor: colors.accentSoft,
  },
  clearDone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  pill: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  pillSelected: {
    backgroundColor: colors.violet,
  },
  severityHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  severityCopy: {
    gap: 2,
  },
  // The unset readout holds the height of the number it replaces, so the section
  // does not jump the moment the user sets a severity.
  severityUnset: {
    lineHeight: 46,
    textAlign: 'right',
  },
  severityValue: {
    minWidth: 44,
    fontSize: 40,
    lineHeight: 46,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    color: colors.violet,
    textAlign: 'right',
  },
  saved: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
});
