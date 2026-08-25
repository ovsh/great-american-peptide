import { format, formatDistanceToNow, isToday, isTomorrow, isYesterday } from 'date-fns';

export function fmtDate(ms: number): string {
  return format(new Date(ms), 'MMM d, yyyy');
}

export function fmtTime(ms: number): string {
  return format(new Date(ms), 'h:mm a');
}

export function fmtDateTime(ms: number): string {
  return format(new Date(ms), "MMM d, yyyy 'at' h:mm a");
}

/**
 * A stored `HH:MM` in the same form `fmtTime` prints. Preferences hold the
 * 24-hour string because that is the one that sorts, and the picker speaks AM
 * and PM, so a screen that printed the stored string read 19:04 back to a user
 * who had just set 7:04 PM. A string this cannot parse prints as it stands.
 */
export function fmtClock(value: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  const hour24 = Number.parseInt(match?.[1] ?? '', 10);
  const minute = Number.parseInt(match?.[2] ?? '', 10);
  if (!Number.isFinite(hour24) || !Number.isFinite(minute)) return value;
  if (hour24 > 23 || minute > 59) return value;
  return `${hour24 % 12 || 12}:${String(minute).padStart(2, '0')} ${hour24 >= 12 ? 'PM' : 'AM'}`;
}

/**
 * One hour, named the way a person would say it while dragging along a curve:
 * "Today 2 PM", "Tomorrow 8 AM", "Yesterday 9 PM", else "Thu 8 AM". No minutes,
 * because the scrubber snaps to the hour and a ":00" would only repeat that.
 *
 * The clock itself comes from the device, so a 24-hour phone reads "Today 14".
 * `format` cannot ask that question, and the formatter is built once because the
 * label is rebuilt on every hour the finger crosses.
 */
export function fmtHourLabel(ms: number): string {
  const d = new Date(ms);
  const hour = hourFormat().format(d);
  if (isToday(d)) return `Today ${hour}`;
  if (isTomorrow(d)) return `Tomorrow ${hour}`;
  if (isYesterday(d)) return `Yesterday ${hour}`;
  return `${format(d, 'EEE')} ${hour}`;
}

let hourFormatter: Intl.DateTimeFormat | null = null;

function hourFormat(): Intl.DateTimeFormat {
  hourFormatter ??= new Intl.DateTimeFormat(undefined, { hour: 'numeric' });
  return hourFormatter;
}

export function fmtDayLabel(ms: number): string {
  const d = new Date(ms);
  if (isToday(d)) return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'EEEE, MMM d');
}

export function fmtRelative(ms: number): string {
  return formatDistanceToNow(new Date(ms), { addSuffix: true });
}

export function fmtMonthYear(ms: number): string {
  return format(new Date(ms), 'MMMM yyyy').toUpperCase();
}

export function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function endOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}
