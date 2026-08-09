import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { WHEEL_FRAME_HEIGHT, WHEEL_ITEM_HEIGHT, WheelPicker } from './WheelPicker';
import { colors, radius, spacing } from '../theme';

type Meridiem = 'AM' | 'PM';

const HOURS = Array.from({ length: 12 }, (_, index) => index + 1);
// Every minute, not every fifth. `log-shot` passes the real time a shot was
// taken, so 09:07 has to land on a row.
const MINUTES = Array.from({ length: 60 }, (_, index) => index);
/** The band sits on the middle row, so it starts half a frame less half a row down. */
const BAND_TOP = (WHEEL_FRAME_HEIGHT - WHEEL_ITEM_HEIGHT) / 2;

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

  return (
    <View
      accessibilityLabel={`${label}, ${displayTime(time)}`}
      style={styles.picker}
    >
      {/* One band across both wheels, the way an iOS picker draws it. The
          wheels are `bare` because two bands side by side would leave a seam
          at the colon. */}
      <View style={styles.wheels}>
        <View pointerEvents="none" style={styles.band} />
        <View style={styles.column}>
          <WheelPicker
            bare
            values={HOURS}
            value={time.hour}
            onChange={(hour) => update({ ...time, hour })}
            accessibilityLabel={`${label} hour`}
          />
        </View>
        <Text variant="h2" color={colors.inkMuted}>:</Text>
        <View style={styles.column}>
          <WheelPicker
            bare
            values={MINUTES}
            value={time.minute}
            onChange={(minute) => update({ ...time, minute })}
            format={(minute) => String(minute).padStart(2, '0')}
            accessibilityLabel={`${label} minute`}
          />
        </View>
      </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  wheels: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: BAND_TOP,
    height: WHEEL_ITEM_HEIGHT,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
  },
  column: {
    width: 64,
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
