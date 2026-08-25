import { StyleSheet, View } from 'react-native';
import { FlaskConical, MapPin, Syringe } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { Text } from '@/components/Text';
import { InterstitialScene } from '@/components/onboarding/interstitial-scene';
import { colors, radius, spacing } from '@/theme';

/**
 * The three parts of the routine, and what Poke does with each one.
 *
 * This screen runs only for a user who said they are brand new, and it is the
 * first thing they see after the schedules. It names the parts so the words on
 * the screens that follow mean something, and it stops there.
 *
 * It teaches no technique. Poke is a log and not a nurse: how to hold a
 * syringe, where to put it and what to do about it are between the user and the
 * person who prescribed the medication. Every line below is a line about Poke.
 * Nothing here is an instruction, a number or a should.
 */
const PARTS: readonly { icon: LucideIcon; title: string; line: string }[] = [
  {
    icon: FlaskConical,
    title: 'Mixing a vial',
    line: 'Poke works the syringe math out from the numbers on your vial.',
  },
  {
    icon: Syringe,
    title: 'Taking a shot',
    line: 'Poke logs the dose and the time in two taps.',
  },
  {
    icon: MapPin,
    title: 'Moving between sites',
    line: 'Poke keeps the map of where your shots went.',
  },
];

export default function HowAShotWorksScreen() {
  return (
    <InterstitialScene
      step="how-a-shot-works"
      title="Three parts to every shot"
      scene={(
        <View style={styles.rows}>
          {PARTS.map((part) => (
            <PartRow key={part.title} icon={part.icon} title={part.title} line={part.line} />
          ))}
        </View>
      )}
    />
  );
}

function PartRow({ icon: Icon, title, line }: { icon: LucideIcon; title: string; line: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.disc}>
        <Icon size={20} strokeWidth={1.75} color={colors.accent} />
      </View>
      <View style={styles.copy}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="small" color={colors.inkMuted}>{line}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rows: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 340,
    gap: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  disc: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
  },
});
