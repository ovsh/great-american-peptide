import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Check, Syringe } from 'lucide-react-native';

import { Text } from '@/components/Text';
import type { DoseState } from '@/components/today-types';
import { getBodySite } from '@/domain/bodySites';
import { colors, radius, spacing } from '@/theme';
import { fmtTime } from '@/utils/date';

/**
 * The log action, at the foot of the hero card, in every state.
 *
 * The old band came and went with the schedule: due and unscheduled had one,
 * upcoming had none, so the one action the app is for disappeared on five days
 * out of seven. This one never leaves. Due today makes it solid green; a shot
 * already logged turns it soft and reports the time, and it still opens the log
 * screen, because a second shot is a thing that happens.
 */
export function TodayLogBand({
  dose,
  medicationId,
  medicationName,
}: {
  dose: DoseState;
  medicationId: string;
  medicationName: string;
}) {
  const logged = dose.kind === 'loggedToday' ? dose.injection : null;
  const due = dose.kind === 'due';

  return (
    <Pressable
      testID="today-log-shot-action"
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel(dose, medicationName)}
      onPress={() => router.push({ pathname: '/log-shot', params: { medicationId } })}
      style={({ pressed }) => [
        styles.band,
        due && styles.bandDue,
        logged !== null && styles.bandLogged,
        pressed && (due ? styles.bandDuePressed : styles.bandPressed),
      ]}
    >
      {logged !== null ? (
        <>
          <View style={styles.tick}>
            <Check size={12} strokeWidth={2.6} color={colors.successDeep} />
          </View>
          <Text variant="smallStrong" color={colors.successDeep}>
            Logged {fmtTime(logged.taken_at).toLocaleLowerCase()}
          </Text>
        </>
      ) : (
        <>
          <Syringe size={19} color={due ? colors.inkInverse : colors.successDeep} />
          <Text
            variant={due ? 'bodyStrong' : 'smallStrong'}
            color={due ? colors.inkInverse : colors.successDeep}
          >
            Log shot
          </Text>
        </>
      )}
    </Pressable>
  );
}

function accessibilityLabel(dose: DoseState, medicationName: string): string {
  if (dose.kind === 'loggedToday') {
    const site = dose.injection.site_id ? getBodySite(dose.injection.site_id) : undefined;
    const where = site ? `, ${site.label.toLocaleLowerCase()}` : '';
    return `${medicationName} logged ${fmtTime(dose.injection.taken_at).toLocaleLowerCase()}${where}. Log another shot`;
  }
  if (dose.kind === 'due') return `Log ${medicationName} shot, due today`;
  return `Log ${medicationName} shot`;
}

const styles = StyleSheet.create({
  band: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    backgroundColor: colors.surfaceMuted,
  },
  bandDue: {
    borderTopColor: 'transparent',
    backgroundColor: colors.successDeep,
  },
  bandLogged: {
    borderTopColor: 'transparent',
    backgroundColor: colors.successSoft,
  },
  bandPressed: {
    opacity: 0.72,
  },
  bandDuePressed: {
    opacity: 0.9,
  },
  tick: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
});
