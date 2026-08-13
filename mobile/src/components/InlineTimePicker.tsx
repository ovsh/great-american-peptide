import { useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { WHEEL_FRAME_HEIGHT, WHEEL_ITEM_HEIGHT, WheelPicker } from './WheelPicker';
import { colors, radius, spacing } from '../theme';

type Meridiem = 'AM' | 'PM';

const HOURS = Array.from({ length: 12 }, (_, index) => index + 1);

/**
 * Which minutes get a row.
 *
 * `log-shot` records the real time a shot was taken, so it leaves the step at 1
 * and 09:07 lands on a row. A reminder is a time somebody picks, and sixty rows
 * put 7:30 four hard flicks away from 7:00, so those screens pass 5.
 *
 * The current minute always gets a row, whatever the step. A reminder set to
 * 7:28 on an older build has to stay reachable on the wheel that now steps by
 * five, rather than silently reading as the first row.
 */
function minuteValues(step: number, current: number): readonly number[] {
  const grid: number[] = [];
  for (let minute = 0; minute < 60; minute += step) grid.push(minute);
  if (grid.includes(current)) return grid;
  return [...grid, current].sort((a, b) => a - b);
}
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
  /** Minutes between rows. See `minuteValues`. */
  minuteStep?: number;
}

export function InlineTimePicker({
  value,
  onChange,
  label = 'Reminder time',
  minuteStep = 1,
}: InlineTimePickerProps) {
  const time = parseTime(value);
  const minutes = minuteValues(minuteStep, time.minute);

  /**
   * The three controls write into one string, and they do not all write in the
   * same tick: a wheel settles on a timer, so a settle that started before an
   * AM or PM tap lands after it. Each control therefore writes only its own
   * field into the newest string, never a whole snapshot taken at render time.
   * Without this the late wheel wrote the pre-tap meridiem back, and a time the
   * user picked as 9:00 AM was saved as 21:00 and read back as 9:00 PM.
   *
   * `sent` holds what this picker last wrote, so a value that changes outside
   * the picker still wins.
   */
  const latest = useRef(value);
  const sent = useRef(value);
  if (value !== sent.current) latest.current = value;

  const commit = (patch: Partial<TimeParts>) => {
    const next = formatTime({ ...parseTime(latest.current), ...patch });
    latest.current = next;
    sent.current = next;
    onChange(next);
  };

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
            onChange={(hour) => commit({ hour })}
            accessibilityLabel={`${label} hour`}
          />
        </View>
        <Text variant="h2" color={colors.inkMuted}>:</Text>
        <View style={styles.column}>
          <WheelPicker
            bare
            values={minutes}
            value={time.minute}
            onChange={(minute) => commit({ minute })}
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
              onPress={() => commit({ meridiem })}
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

/**
 * A stored `HH:mm` as the clock a person reads.
 *
 * A settings row that opens this picker has to print the saved time, and it
 * reads it through the same parser the wheels use, so the row and the wheels
 * can never disagree about what is saved.
 */
export function clockLabel(value: string): string {
  return displayTime(parseTime(value));
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
