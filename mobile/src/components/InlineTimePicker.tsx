import { Pressable, StyleSheet, View } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';

import { Text } from './Text';
import { colors, radius, spacing } from '../theme';

type Meridiem = 'AM' | 'PM';

interface TimeParts {
  hour: number;
  minute: number;
  meridiem: Meridiem;
}

interface InlineTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

export function InlineTimePicker({ value, onChange, label = 'Reminder time' }: InlineTimePickerProps) {
  const time = parseTime(value);

  const update = (next: TimeParts) => onChange(formatTime(next));
  const shiftHour = (delta: number) => {
    const hour = ((time.hour - 1 + delta + 12) % 12) + 1;
    update({ ...time, hour });
  };
  const shiftMinute = (delta: number) => {
    const minute = (Math.round(time.minute / 5) * 5 + delta + 60) % 60;
    update({ ...time, minute });
  };

  return (
    <View
      accessibilityLabel={`${label}, ${displayTime(time)}`}
      style={styles.picker}
    >
      <TimeWheel
        label="Hour"
        value={String(time.hour)}
        onDecrease={() => shiftHour(-1)}
        onIncrease={() => shiftHour(1)}
      />
      <Text variant="h2" color={colors.inkMuted}>:</Text>
      <TimeWheel
        label="Minute"
        value={String(time.minute).padStart(2, '0')}
        onDecrease={() => shiftMinute(-5)}
        onIncrease={() => shiftMinute(5)}
      />
      <View style={styles.periods}>
        {(['AM', 'PM'] as const).map((meridiem) => {
          const selected = time.meridiem === meridiem;
          return (
            <Pressable
              key={meridiem}
              accessibilityRole="radio"
              accessibilityLabel={meridiem}
              accessibilityState={{ selected }}
              onPress={() => update({ ...time, meridiem })}
              style={[styles.period, selected && styles.periodSelected]}
            >
              <Text variant="smallStrong" color={selected ? colors.inkInverse : colors.inkMuted}>
                {meridiem}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function TimeWheel({
  label,
  value,
  onDecrease,
  onIncrease,
}: {
  label: string;
  value: string;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <View style={styles.wheel}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Increase ${label.toLocaleLowerCase()}`}
        onPress={onIncrease}
        style={styles.wheelButton}
      >
        <ChevronUp size={18} color={colors.inkMuted} />
      </Pressable>
      <Text variant="h2" align="center">{value}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Decrease ${label.toLocaleLowerCase()}`}
        onPress={onDecrease}
        style={styles.wheelButton}
      >
        <ChevronDown size={18} color={colors.inkMuted} />
      </Pressable>
    </View>
  );
}

function parseTime(value: string): TimeParts {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  const hour24 = match ? Number.parseInt(match[1] ?? '', 10) : 9;
  const rawMinute = match ? Number.parseInt(match[2] ?? '', 10) : 0;
  const validHour = hour24 >= 0 && hour24 <= 23 ? hour24 : 9;
  const minute = rawMinute >= 0 && rawMinute <= 59 ? rawMinute : 0;
  const hour = validHour % 12 || 12;
  return { hour, minute, meridiem: validHour >= 12 ? 'PM' : 'AM' };
}

function formatTime(time: TimeParts): string {
  const hour24 = time.meridiem === 'PM'
    ? time.hour % 12 + 12
    : time.hour % 12;
  return `${String(hour24).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`;
}

function displayTime(time: TimeParts): string {
  return `${time.hour}:${String(time.minute).padStart(2, '0')} ${time.meridiem}`;
}

const styles = StyleSheet.create({
  picker: {
    minHeight: 152,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  wheel: {
    width: 56,
    alignItems: 'center',
    gap: spacing.xs,
  },
  wheelButton: {
    width: 44,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periods: {
    gap: spacing.xs,
  },
  period: {
    minWidth: 56,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  periodSelected: {
    backgroundColor: colors.accent,
  },
});
