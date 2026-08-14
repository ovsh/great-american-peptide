// The chrome both preset pickers share: the filter rail, the section head, the
// ghost add row and the add-as-custom action card. Onboarding's picker selects
// many rows and `medications/new.tsx` selects one, but the way a person narrows
// the catalog is the same act on both screens, so the pieces live once here and
// the two screens cannot drift apart.

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Plus } from 'lucide-react-native';

import { Card } from './Card';
import { Text } from './Text';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  pickerEntries,
  searchPresets,
  type PeptidePreset,
  type PresetEntry,
} from '../domain/peptides';
import { colors, radius, spacing } from '../theme';

/** The line under the Selected block and under the Blends list. One sentence,
 * written once, because it is the same fact both places: no half-life, no curve. */
export const NO_CURVE_NOTE = 'Poke draws no level curve without a half-life.';

export type PickerFilter = 'all' | PeptidePreset['category'];

/**
 * The one list state a picker holds: a query, a category, and the rows they
 * leave visible.
 *
 * Search and filter are two ways to narrow one list, never both at once. A
 * live query searches the whole catalog, because a match hidden behind a
 * forgotten pill reads as a missing medication. Typing therefore rests the
 * pill on All, and tapping a pill clears the query. `railFilter` is null while
 * a query is live, so no pill claims a narrowing it is not doing.
 */
export function usePresetCatalog() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<PickerFilter>('all');

  const trimmed = query.trim();
  const hasQuery = trimmed.length > 0;

  const entries = useMemo(() => {
    if (hasQuery) return searchPresets(query);
    const all = pickerEntries();
    if (filter === 'all') return all;
    return all.filter((entry) => entry.preset.category === filter);
  }, [query, hasQuery, filter]);

  return {
    query,
    trimmed,
    hasQuery,
    filter,
    railFilter: hasQuery ? null : filter,
    entries,
    changeQuery: (text: string) => {
      setQuery(text);
      if (filter !== 'all') setFilter('all');
    },
    pickFilter: (next: PickerFilter) => {
      setFilter(next);
      setQuery('');
    },
    clearQuery: () => setQuery(''),
  };
}

/** What the section head over the visible rows calls them. */
export function sectionLabel(hasQuery: boolean, filter: PickerFilter): string {
  if (hasQuery) return 'Results';
  return filter === 'all' ? 'Catalog' : CATEGORY_LABELS[filter];
}

export function SectionHead({ label, count }: { label: string; count: number }) {
  return (
    <View style={styles.secHead}>
      <Text variant="smallStrong" color={colors.inkMuted}>{label}</Text>
      <Text variant="small" color={colors.inkSubtle}>{count}</Text>
    </View>
  );
}

/** The rail of category pills, All first. The active pill fills with ink, not
 * green: green already means a dose or a selected card in this app, and a
 * filter is neither. */
export function FilterRail({
  activeFilter,
  onPick,
}: {
  /** Null while a query is live, so no pill reads as active. */
  activeFilter: PickerFilter | null;
  onPick: (filter: PickerFilter) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.pillRail}
    >
      <FilterPill label="All" active={activeFilter === 'all'} onPress={() => onPick('all')} />
      {CATEGORY_ORDER.map((category) => (
        <FilterPill
          key={category}
          label={CATEGORY_LABELS[category]}
          active={activeFilter === category}
          onPress={() => onPick(category)}
        />
      ))}
    </ScrollView>
  );
}

function FilterPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      aria-checked={active}
      onPress={onPress}
      // The pill stands 36 points tall so the rail stays a rail. The slop
      // brings the touch target back to 44.
      hitSlop={{ top: 4, bottom: 4 }}
      style={({ pressed }) => [styles.pill, active && styles.pillOn, pressed && styles.pressed]}
    >
      <Text variant="smallStrong" color={active ? colors.inkInverse : colors.ink}>{label}</Text>
    </Pressable>
  );
}

/** A quiet permanent door into creating a custom medication, not a card,
 * because every card in these lists is a thing you take. The caller hides it
 * while a query is live: the action card below is the same act, and two open
 * doors to one act is one too many. */
export function GhostAddRow({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add a custom medication"
      onPress={onPress}
      style={({ pressed }) => [styles.ghost, pressed && styles.pressed]}
    >
      <Plus size={18} strokeWidth={2.5} color={colors.accent} />
      <Text variant="smallStrong" color={colors.accent}>Add a custom medication</Text>
    </Pressable>
  );
}

/** The other door into the same act as the ghost row: one creation act, two
 * doors. It sits at the foot of the results rather than the head, so a person
 * who searched a blend part finds the molecule and the blend before Poke
 * offers to invent a row. */
export function AddActionCard({
  name,
  description,
  onPress,
}: {
  name: string;
  /** What pressing the card does with the name, in the caller's own words. */
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Add ${name} as a custom medication`}
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <Card padding="md" style={styles.actionCard}>
        <Plus size={18} strokeWidth={2.5} color={colors.accent} />
        <View style={styles.actionCopy}>
          <Text variant="smallStrong">Add “{name}”</Text>
          <Text variant="small" color={colors.inkMuted}>{description}</Text>
        </View>
      </Card>
    </Pressable>
  );
}

/** The quiet word beside a preset row's name, or nothing. A blend outranks the
 * estimate mark because a blend is always unsourced, so the two never meet. */
export function presetMarker(preset: PeptidePreset): string | undefined {
  if ('parts' in preset) return 'Blend';
  return preset.evidence === 'estimate' ? 'Estimate' : undefined;
}

/** The no-match line over the lone action card. */
export function NoMatchLine({ query }: { query: string }) {
  return <Text color={colors.inkMuted}>Poke has no match for “{query}”.</Text>;
}

export type { PresetEntry };

const styles = StyleSheet.create({
  pillRail: {
    flexDirection: 'row',
    gap: spacing.sm,
    // Room for the hit slop above and below the 36 point pills, so the rail
    // does not clip its own touch targets.
    paddingVertical: 4,
  },
  pill: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillOn: {
    borderColor: colors.ink,
    backgroundColor: colors.ink,
  },
  secHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
  },
  ghost: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionCard: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  actionCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  pressed: {
    opacity: 0.78,
  },
});
