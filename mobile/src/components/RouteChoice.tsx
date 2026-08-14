import { Pressable, StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';

import { Text } from './Text';
import { ROUTE_LABELS, type Route } from '../domain/peptides';
import { colors, radius, spacing } from '../theme';

/** Under the skin first, because every preset in the catalogue is a shot there. */
const ROUTES: readonly Route[] = ['sc', 'im'];

interface RouteChoiceProps {
  value: Route;
  onChange: (route: Route) => void;
}

/**
 * Where a shot goes, asked in plain words.
 *
 * Two lines, so neither reader loses: the plain line answers the question, and
 * the clinical word under it is the one a user repeats to a nurse. Two lines do
 * not fit `TimeRangeToggle`, which draws one string per option, so the route is
 * a card each and not a segmented control.
 *
 * The card carries the choice, not the colour: a selected card keeps ink on a
 * pale accent and adds a tick, rather than turning white on green and taking
 * the quiet second line down with it.
 */
export function RouteChoice({ value, onChange }: RouteChoiceProps) {
  return (
    <View style={styles.row}>
      {ROUTES.map((route) => {
        const { plain, clinical } = ROUTE_LABELS[route];
        const selected = route === value;
        return (
          <Pressable
            key={route}
            accessibilityRole="radio"
            accessibilityLabel={`${plain}, ${clinical}`}
            // Two spellings of one fact. A phone reads the state, and
            // react-native-web reads the ARIA prop and drops the state, so the
            // web build announces the choice only because of the second line.
            accessibilityState={{ selected }}
            aria-checked={selected}
            onPress={() => onChange(route)}
            style={({ pressed }) => [
              styles.card,
              selected && styles.cardSelected,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.head}>
              <Text variant="smallStrong" style={styles.plain}>{plain}</Text>
              {selected ? <Check size={16} color={colors.accent} /> : null}
            </View>
            <Text variant="caption" color={colors.inkMuted}>{clinical}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  card: {
    flex: 1,
    minHeight: 44,
    gap: 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cardSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  pressed: {
    opacity: 0.78,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  plain: {
    flexShrink: 1,
  },
});
