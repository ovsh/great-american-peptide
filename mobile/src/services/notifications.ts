import { Platform } from 'react-native';
import { format } from 'date-fns';

import { listInjections } from '../repositories/injections';
import { listMedications } from '../repositories/medications';
import { getPreferences } from '../repositories/preferences';
import { listSideEffects } from '../repositories/sideEffects';
import type { PreferencesRow } from '../db/types';
import { cycleDurationLabel, cycleFrame, cycleProgressLabel } from '../domain/cycle';
import { doseOnDay } from '../domain/doseByDay';
import {
  medicationScheduleFromStored,
  nextScheduledDoses,
  parseReminderTime,
  scheduledDosesBetween,
} from '../domain/scheduling';
import { cycleStateOf } from '../utils/cycle';
import { startOfDay } from '../utils/date';
import { track } from './analytics';

type ExpoNotifications = typeof import('expo-notifications');

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** The three delays the check-in row offers, in hours. 36 is the default. */
export const CHECKIN_DELAY_OPTIONS = [24, 36, 48] as const;
export type CheckinDelayHours = (typeof CHECKIN_DELAY_OPTIONS)[number];
const CHECKIN_DELAY_DEFAULT: CheckinDelayHours = 36;

/**
 * No banner lands before 10:00 or after 20:00, and the missed-shot catch-up
 * lands at 10:00 exactly. A check-in owed at 03:00 waits for the morning rather
 * than waking anybody.
 */
const QUIET_END_HOUR = 10;
const QUIET_START_HOUR = 20;
const MISSED_SHOT_HOUR = 10;

/** How far back a logged shot can still owe a check-in: the longest delay. */
const CHECKIN_LOOKBACK_MS = 48 * HOUR_MS;
/** How far ahead both schedule-driven loops read. */
const MISSED_HORIZON_DAYS = 21;
const SCHEDULE_HORIZON_DOSES = 6;
/**
 * iOS keeps 64 pending notifications and drops the rest without a word. Poke
 * queues fewer than that on purpose, soonest first, so the ones that get cut
 * are the far ones the next refresh will queue again anyway.
 */
const MAX_PENDING = 56;

let notificationsModule: ExpoNotifications | null = null;
let handlerSet = false;

async function getNotifications(): Promise<ExpoNotifications | null> {
  if (Platform.OS === 'web') return null;
  if (!notificationsModule) {
    notificationsModule = await import('expo-notifications');
  }
  if (!handlerSet) {
    notificationsModule.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: true,
      }),
    });
    handlerSet = true;
  }
  return notificationsModule;
}

export async function ensureNotificationPermission(): Promise<boolean> {
  const Notifications = await getNotifications();
  if (!Notifications) return false;
  const settings = await Notifications.getPermissionsAsync();
  if (settings.status === 'granted') return true;
  const req = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: false },
  });
  const granted = req.status === 'granted';
  // Only the real prompt is counted. A permission iOS granted earlier returns
  // above, and counting that would inflate the answer.
  track('notification_permission_result', { granted });
  return granted;
}

/** A stored delay that is not one of the three offered reads as the default. */
export function checkinDelayHours(value: number | null | undefined): CheckinDelayHours {
  return CHECKIN_DELAY_OPTIONS.find((option) => option === value) ?? CHECKIN_DELAY_DEFAULT;
}

/**
 * The four loops, in the order they win a day.
 *
 * A shot-day reminder is the one the user asked for on the permission screen, so
 * it takes the day. A cycle banner ranks with it: it fires twice in a cycle of
 * weeks and names a day the user wrote down, so dropping it would lose the whole
 * loop rather than one of many. The catch-up names a shot that is already late,
 * which beats a check-in the user can answer any time.
 */
type ReminderKind = 'shot' | 'cycle' | 'missed' | 'checkin';

interface PlannedReminder {
  kind: ReminderKind;
  at: number;
  title: string;
  body: string;
}

/**
 * Cancels everything and rebuilds the whole queue.
 *
 * Every caller that writes a shot, a side effect, a medication or a preference
 * calls this, because all three loops read those tables. Rebuilding is how a
 * banner cancels itself: a logged shot simply stops producing its catch-up on
 * the next pass.
 */
export async function refreshScheduledReminders(): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;
  const prefs = await getPreferences();
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!prefs.notifications_enabled) return;

  const now = Date.now();
  const planned = [
    ...(await planShotDayReminders(now, prefs)),
    ...(await planCycleReminders(now, prefs)),
    ...(await planMissedShotReminders(now, prefs)),
    ...(await planCheckinReminders(now, prefs)),
  ];

  const queue = oneNewLoopPerDay(planned)
    .sort((a, b) => a.at - b.at)
    .slice(0, MAX_PENDING);

  for (const reminder of queue) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: { title: reminder.title, body: reminder.body },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(reminder.at),
        },
      });
    } catch {
      // ignore individual scheduling failures
    }
  }
}

/**
 * At most one of the two new loops per local day, and never on a day that
 * already carries a shot-day reminder.
 *
 * Shot-day reminders themselves are per medication, which is the promise the
 * permission screen makes: a second medication on the same day is a second
 * reminder, because dropping one would leave a dose unnamed.
 */
function oneNewLoopPerDay(planned: readonly PlannedReminder[]): PlannedReminder[] {
  const takenDays = new Set<number>();
  for (const reminder of planned) {
    if (holdsTheDay(reminder.kind)) takenDays.add(startOfDay(reminder.at));
  }

  const kept: PlannedReminder[] = [];
  for (const reminder of planned) {
    if (holdsTheDay(reminder.kind)) {
      kept.push(reminder);
      continue;
    }
    const day = startOfDay(reminder.at);
    if (takenDays.has(day)) continue;
    takenDays.add(day);
    kept.push(reminder);
  }
  return kept;
}

/** The two loops that keep their day rather than yielding it to an earlier one. */
function holdsTheDay(kind: ReminderKind): boolean {
  return kind === 'shot' || kind === 'cycle';
}

/**
 * Two banners in a whole cycle: the last day of the plan, and the day the break
 * ends. Both land at the shot-day reminder time.
 *
 * Neither one tells the user what to do. The first repeats the length they set
 * and says the plan ends today, the second says the break they set ends today,
 * and the decision on both days is theirs. Poke never proposes a next cycle,
 * and there is no repeat and no nag: past the last planned day the app keeps
 * counting on screen and sends nothing.
 */
async function planCycleReminders(now: number, prefs: PreferencesRow): Promise<PlannedReminder[]> {
  if (!prefs.notif_cycle_enabled) return [];

  const meds = await listMedications();
  const time = parseReminderTime(prefs.reminder_time);
  const planned: PlannedReminder[] = [];

  for (const med of meds) {
    const state = cycleStateOf(med, now);

    if (state.kind === 'running') {
      const at = atLocalTime(state.lastDayStart, time.hour, time.minute);
      if (at <= now) continue;
      // The frame of the last day and not of today, so the title reads
      // "week 8 of 8" whenever this banner is the one that fires.
      const frame = cycleFrame(state.totalDays, state.totalDays);
      planned.push({
        kind: 'cycle',
        at,
        title: `${med.name}: ${cycleProgressLabel(frame).toLocaleLowerCase()}`,
        body: 'The plan you set ends today.',
      });
      continue;
    }

    if (state.kind === 'onBreak' && state.endsAt !== null && state.daysOff !== null) {
      const at = atLocalTime(state.endsAt, time.hour, time.minute);
      if (at <= now) continue;
      planned.push({
        kind: 'cycle',
        at,
        title: `${med.name}: break ends today`,
        body: `You set ${cycleDurationLabel(state.daysOff)} off.`,
      });
    }
  }
  return planned;
}

/** The reminder time on each scheduled day, unless that day's shot is logged. */
async function planShotDayReminders(now: number, prefs: PreferencesRow): Promise<PlannedReminder[]> {
  const meds = await listMedications();
  const planned: PlannedReminder[] = [];

  for (const med of meds) {
    if (med.status !== 'active') continue;
    const schedule = medicationScheduleFromStored({
      medicationId: med.id,
      frequencyKind: med.frequency_kind,
      frequencyValue: med.frequency_value,
      createdAt: med.created_at,
      cycleStartedAt: med.cycle_started_at,
      reminderTime: prefs.reminder_time,
    });
    if (!schedule) continue;

    const doses = nextScheduledDoses(schedule, now, SCHEDULE_HORIZON_DOSES);
    if (doses.length === 0) continue;

    // A dose the user already logged needs no reminder. The schedule holds one dose
    // per medication per day, so a shot on the same local day answers that dose.
    // Without this, a shot at 07:30 still gets the 09:00 reminder.
    const loggedFrom = Math.min(...doses.map((dose) => dose.scheduledDay));
    const loggedDays = await loggedDaysFor(med.id, loggedFrom);

    for (const dose of doses) {
      if (loggedDays.has(dose.scheduledDay)) continue;
      planned.push({
        kind: 'shot',
        at: dose.scheduledAt,
        // The reminder repeats the schedule the user set. It gives no
        // instruction, so the body names the user as the source of the number.
        // The route is not in it: no screen ever asked the user for one.
        //
        // The number is the one the plan carries on the day this banner fires,
        // so a Monday reminder names the Monday dose.
        title: `Ready for your ${med.name} shot?`,
        body: `You set ${doseOnDay(med.dose_by_day, med.default_dose, dose.scheduledDay)} ${med.default_unit} for today. Log it to track your levels.`,
      });
    }
  }
  return planned;
}

/**
 * 10:00 the morning after a scheduled day with nothing logged on it.
 *
 * The window opens yesterday, so a day that slipped while the app was closed
 * still gets its catch-up this morning. Future days are planned on the
 * assumption that they slip; logging the shot rebuilds the queue without them.
 */
async function planMissedShotReminders(now: number, prefs: PreferencesRow): Promise<PlannedReminder[]> {
  if (!prefs.notif_missed_enabled) return [];

  const meds = await listMedications();
  const planned: PlannedReminder[] = [];
  const from = startOfDay(now) - DAY_MS;
  const through = startOfDay(now) + MISSED_HORIZON_DAYS * DAY_MS;

  for (const med of meds) {
    if (med.status !== 'active') continue;
    const schedule = medicationScheduleFromStored({
      medicationId: med.id,
      frequencyKind: med.frequency_kind,
      frequencyValue: med.frequency_value,
      createdAt: med.created_at,
      cycleStartedAt: med.cycle_started_at,
      reminderTime: prefs.reminder_time,
    });
    if (!schedule) continue;

    const doses = scheduledDosesBetween(schedule, from, through).slice(0, SCHEDULE_HORIZON_DOSES);
    if (doses.length === 0) continue;
    const loggedDays = await loggedDaysFor(med.id, from);

    for (const dose of doses) {
      if (loggedDays.has(dose.scheduledDay)) continue;
      const at = atLocalHourNextDay(dose.scheduledDay, MISSED_SHOT_HOUR);
      if (at <= now) continue;
      planned.push({
        kind: 'missed',
        at,
        title: `Did you miss ${format(new Date(dose.scheduledDay), 'EEEE')}'s shot?`,
        body: 'Log it late and Poke keeps the date you enter.',
      });
    }
  }
  return planned;
}

/**
 * The delay after each logged shot, landing inside 10:00 to 20:00.
 *
 * Two things silence it. An empty watch list means the user named nothing to
 * watch, and a check-in on nothing is a question with no answer. A record
 * already logged since the shot means the question is answered, so the banner
 * would arrive after the fact — and an all-clear counts, because it lives in
 * the same table as a symptom and is the same kind of answer.
 */
async function planCheckinReminders(now: number, prefs: PreferencesRow): Promise<PlannedReminder[]> {
  if (!prefs.notif_checkin_enabled) return [];
  if (!hasSideEffectWatchList(prefs.side_effect_concerns)) return [];

  const delayMs = checkinDelayHours(prefs.notif_checkin_delay_hours) * HOUR_MS;
  const shots = await listInjections({ fromMs: now - CHECKIN_LOOKBACK_MS });
  if (shots.length === 0) return [];

  const logs = await listSideEffects({ fromMs: now - CHECKIN_LOOKBACK_MS });
  const planned: PlannedReminder[] = [];

  for (const shot of shots) {
    const at = insideWakingHours(shot.taken_at + delayMs);
    if (at <= now) continue;
    const answered = logs.some((log) => log.taken_at >= shot.taken_at && log.taken_at <= at);
    if (answered) continue;
    planned.push({
      kind: 'checkin',
      at,
      title: 'How do you feel today?',
      // Both offers are real: the side-effect sheet logs a symptom, and its
      // all-clear band records a clear day. Either one answers this window.
      body: 'Yesterday was a shot day. Log a symptom, or mark the day clear.',
    });
  }
  return planned;
}

/** The local days a medication already has a shot on, from `fromMs` forward. */
async function loggedDaysFor(medicationId: string, fromMs: number): Promise<Set<number>> {
  const logged = await listInjections({ medicationId, fromMs });
  return new Set(logged.map((injection) => startOfDay(injection.taken_at)));
}

/**
 * `['none']`, `[]` and unreadable JSON all mean the user watches nothing.
 *
 * Exported because the Profile check-in row has to explain itself with the
 * same reading the scheduler uses: a toggle that reads on while this returns
 * false is a loop that never fires, and the row must say why.
 */
export function hasSideEffectWatchList(stored: string | null): boolean {
  if (!stored) return false;
  try {
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return false;
    return parsed.some((item) => typeof item === 'string' && item !== 'none');
  } catch {
    return false;
  }
}

/**
 * The nearest hour inside 10:00 to 20:00 local.
 *
 * A time before the window waits for 10:00 the same morning. A time after it
 * waits for 10:00 the next morning rather than firing at 20:00 the same
 * evening, because a banner pushed backwards would arrive before the delay the
 * user chose has run out.
 */
function insideWakingHours(at: number): number {
  // Rounded on the local clock, not on the millisecond count: half-hour zones
  // such as India would land every check-in on the half hour otherwise.
  const rounded = new Date(at);
  const roundUp = rounded.getMinutes() >= 30;
  rounded.setMinutes(0, 0, 0);
  if (roundUp) rounded.setTime(rounded.getTime() + HOUR_MS);

  const hour = rounded.getHours();
  if (hour < QUIET_END_HOUR) return atLocalHour(rounded.getTime(), QUIET_END_HOUR);
  if (hour > QUIET_START_HOUR) return atLocalHourNextDay(rounded.getTime(), QUIET_END_HOUR);
  return rounded.getTime();
}

function atLocalHour(at: number, hour: number): number {
  return atLocalTime(at, hour, 0);
}

function atLocalTime(at: number, hour: number, minute: number): number {
  const date = new Date(at);
  date.setHours(hour, minute, 0, 0);
  return date.getTime();
}

/**
 * The same hour on the following calendar day. `setDate` rather than plus 24
 * hours: on the two days a year the offset changes, 24 hours lands on the wrong
 * date and the catch-up would name a day the user has not reached yet.
 */
function atLocalHourNextDay(at: number, hour: number): number {
  const date = new Date(at);
  date.setDate(date.getDate() + 1);
  date.setHours(hour, 0, 0, 0);
  return date.getTime();
}

/**
 * The shot-day banner's two strings.
 *
 * Onboarding paints this banner on a mock lock screen, so the two strings live
 * here rather than being typed a second time on that screen. A preview that
 * carried its own copy would drift the first time either string changed.
 */
export const SHOT_REMINDER_TITLE = "It's time 💪";
export const SHOT_REMINDER_BODY = 'Your scheduled shot is ready to log.';
