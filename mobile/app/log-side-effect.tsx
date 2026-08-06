import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { X } from 'lucide-react-native';

import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { Input } from '@/components/Input';
import { Text } from '@/components/Text';
import type { SideEffectKind } from '@/db/types';
import { createSideEffect } from '@/repositories/sideEffects';
import { useAppStore } from '@/stores/app';
import { colors, radius, spacing } from '@/theme';
import { safeBack } from '@/utils/nav';

const EFFECTS: readonly { id: SideEffectKind; label: string }[] = [
  { id: 'nausea', label: 'Nausea' },
  { id: 'fatigue', label: 'Fatigue' },
  { id: 'constipation', label: 'Constipation' },
  { id: 'headache', label: 'Headache' },
  { id: 'injection_site', label: 'Injection site' },
  { id: 'appetite_loss', label: 'Appetite loss' },
  { id: 'other', label: 'Other' },
];

export default function LogSideEffectScreen() {
  const bumpVersion = useAppStore((state) => state.bumpVersion);
  const [effect, setEffect] = useState<SideEffectKind>('nausea');
  const [severity, setSeverity] = useState(3);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await createSideEffect({
        effect,
        severity,
        takenAt: Date.now(),
        notes: notes.trim() || null,
      });
      bumpVersion();
      safeBack('/');
    } catch (error: unknown) {
      Alert.alert('Could not save side effect', error instanceof Error ? error.message : 'Try again.');
      setSaving(false);
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
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text variant="smallStrong">What are you feeling?</Text>
          <View style={styles.wrap}>
            {EFFECTS.map((item) => {
              const selected = effect === item.id;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setEffect(item.id)}
                  style={[styles.pill, selected && styles.pillSelected]}
                >
                  <Text variant="smallStrong" color={selected ? colors.inkInverse : colors.ink}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.severityHead}>
            <Text variant="smallStrong">Intensity</Text>
            <Text variant="bodyStrong" color={colors.violet}>{severity} / 10</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scale}>
            {Array.from({ length: 11 }, (_, value) => (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityLabel={`Intensity ${value} of 10`}
                accessibilityState={{ selected: severity === value }}
                onPress={() => setSeverity(value)}
                style={[styles.scalePoint, severity === value && styles.scalePointSelected]}
              >
                <Text variant="smallStrong" color={severity === value ? colors.inkInverse : colors.inkMuted}>{value}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text variant="smallStrong">Notes</Text>
          <Input value={notes} onChangeText={setNotes} placeholder="Anything else?" />
        </View>

        <Button disabled={saving} onPress={save}>{saving ? 'Saving' : 'Log side effect'}</Button>
      </ScrollView>
    </View>
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
  scale: {
    gap: spacing.sm,
  },
  scalePoint: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  scalePointSelected: {
    backgroundColor: colors.violet,
  },
});
