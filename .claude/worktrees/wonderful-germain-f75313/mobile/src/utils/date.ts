import { format, formatDistanceToNow, isToday, isTomorrow, isYesterday } from 'date-fns';

export function fmtDate(ms: number): string {
  return format(new Date(ms), 'MMM d, yyyy');
}

export function fmtTime(ms: number): string {
  return format(new Date(ms), 'h:mm a');
}

export function fmtDateTime(ms: number): string {
  return format(new Date(ms), 'MMM d, yyyy · h:mm a');
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
