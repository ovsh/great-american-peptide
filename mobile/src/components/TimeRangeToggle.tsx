import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from './Text';
import { colors, radius, spacing } from '../theme';

interface TimeRangeToggleProps<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  getLabel?: (opt: T) => string;
}

export function TimeRangeToggle<T extends string>({ options, value, onChange, size = 'md', getLabel }: TimeRangeToggleProps<T>) {
  return (
    <View style={styles.row}>
      {options.map((opt) => {
        const active = opt === value;
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            style={[
              styles.btn,
              size === 'sm' && styles.btnSm,
              active && { backgroundColor: colors.surfaceInverse, borderColor: colors.surfaceInverse },
            ]}
          >
            <Text
              variant={size === 'sm' ? 'caption' : 'smallStrong'}
              color={active ? colors.inkInverse : colors.inkMuted}
            >
              {getLabel ? getLabel(opt) : opt}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4 },
  btn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  btnSm: { paddingHorizontal: spacing.sm, paddingVertical: 3 },
});
