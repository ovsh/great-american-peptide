import { Platform } from 'react-native';

import { listInjections } from '../repositories/injections';
import { listMedications } from '../repositories/medications';
import { getPreferences, updatePreferences } from '../repositories/preferences';
import { listSideEffects } from '../repositories/sideEffects';
import type { PreferencesRow } from '../db/types';
import { doseOnDay } from '../domain/doseByDay';
import type { Unit } from '../domain/peptides';
import {
  medicationScheduleFromStored,
  nextScheduledDoses,
  parseReminderTime,
  scheduledDosesBetween,
} from '../domain/scheduling';
import { SIDE_EFFECT_PRESETS, type SideEffectPresetId } from '../domain/sideEffects';
import { formatDose } from '../domain/units';
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
 * and it takes the day from a check-in, which the user can answer any time. The
 * check-in yields to nothing else: see `oneNewLoopPerDay`.
 */
type ReminderKind = 'shot' | 'cycle' | 'missed' | 'checkin';

/**
 * Where a tap on a banner lands. Absolute, because a relative path is a 404 on
 * web, and one of two known values, because the route travels through the
 * notification payload and comes back as unknown data.
 */
export type ReminderRoute = '/log-shot' | '/log-side-effect';
const REMINDER_ROUTES: readonly ReminderRoute[] = ['/log-shot', '/log-side-effect'];

interface PlannedReminder {
  kind: ReminderKind;
  at: number;
  title: string;
  body: string;
  /** The screen the tap opens, or undefined when the banner only informs. */
  route?: ReminderRoute;
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

  const queue = dropRepeatedBanners(oneNewLoopPerDay(planned))
    .sort((a, b) => a.at - b.at)
    .slice(0, MAX_PENDING);

  for (const reminder of queue) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: reminder.title,
          body: reminder.body,
          data: reminder.route === undefined ? {} : { route: reminder.route },
        },
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
 * One catch-up and one check-in per local day, and never a catch-up on a day
 * that already carries a shot-day or a cycle reminder.
 *
 * The check-in shares a day with a shot reminder on purpose. The two speak
 * about different shots: the morning banner names today's dose, and the
 * check-in asks about the one logged a day or two back, so dropping it lost the
 * answer on every second shot of a twice-weekly plan. A catch-up still owns its
 * day, because a shot that is already late and a question about how the last
 * one felt are two demands the same morning.
 *
 * Shot-day reminders themselves are per medication: a second medication on the
 * same day is a second reminder, because dropping one would leave a dose
 * unnamed. `dropRepeatedBanners` collapses the pair only when the two rows
 * write the same dose, so nothing distinct is ever lost.
 */
function oneNewLoopPerDay(planned: readonly PlannedReminder[]): PlannedReminder[] {
  const heldDays = new Set<number>();
  for (const reminder of planned) {
    if (holdsTheDay(reminder.kind)) heldDays.add(startOfDay(reminder.at));
  }

  // The catch-ups first, so the check-in pass reads the days they really take
  // rather than the days they asked for. A catch-up dropped here blocks nothing.
  const kept: PlannedReminder[] = [];
  const missedDays = new Set<number>();
  for (const reminder of planned) {
    if (holdsTheDay(reminder.kind)) {
      kept.push(reminder);
      continue;
    }
    if (reminder.kind !== 'missed') continue;
    const day = startOfDay(reminder.at);
    if (heldDays.has(day) || missedDays.has(day)) continue;
    missedDays.add(day);
    kept.push(reminder);
  }

  const checkinDays = new Set<number>();
  for (const reminder of planned) {
    if (reminder.kind !== 'checkin') continue;
    const day = startOfDay(reminder.at);
    if (missedDays.has(day) || checkinDays.has(day)) continue;
    checkinDays.add(day);
    kept.push(reminder);
  }
  return kept;
}

/**
 * The same sentence twice at the same minute is one sentence.
 *
 * No banner names a medication any more, so two rows that share a shot day and
 * a dose, or two cycles that end together, write the same words at the same
 * time. The screen behind the banner still separates them.
 */
function dropRepeatedBanners(queue: readonly PlannedReminder[]): PlannedReminder[] {
  const seen = new Set<string>();
  return queue.filter((reminder) => {
    const key = `${reminder.at}|${reminder.title}|${reminder.body}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** The two loops that keep their day rather than yielding it to an earlier one. */
function holdsTheDay(kind: ReminderKind): boolean {
  return kind === 'shot' || kind === 'cycle';
}

/**
 * Two banners in a whole cycle: the last day of the plan, and the day the break
 * ends. Both land at the shot-day reminder time.
 *
 * Neither one tells the user what to do. The first says the plan ends today,
 * the second says the plan starts again today, and the decision on both days is
 * theirs. Poke never proposes a next cycle, and there is no repeat and no nag:
 * past the last planned day the app keeps counting on screen and sends nothing.
 *
 * Neither one names the medication or the length any more. A cycle is read off
 * a lock screen by whoever holds the phone, and the screen behind the banner
 * still carries both.
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
      planned.push({
        kind: 'cycle',
        at,
        title: 'Cycle complete 🏁',
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
        title: "Break's over ☀️",
        body: 'Your plan starts again today.',
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
        // No medication name and no injection site: a lock screen is read by
        // whoever is holding the phone. The dose is the one number the user set
        // themselves, and it is the one the plan carries on the day this banner
        // fires, so a Monday reminder names the Monday dose.
        title: SHOT_REMINDER_TITLE,
        body: shotBody(doseOnDay(med.dose_by_day, med.default_dose, dose.scheduledDay), med.default_unit),
        route: '/log-shot',
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
        title: 'Still time ✅',
        body: "Yesterday's shot is still waiting to be logged.",
        route: '/log-shot',
      });
    }
  }
  return planned;
}

/**
 * The delay after each logged shot, landing inside 10:00 to 20:00.
 *
 * Two things silence it. An empty watch list means the user took every chip off
 * the Profile row, and a check-in on nothing is a question with no answer. A record
 * already logged since the shot means the question is answered, so the banner
 * would arrive after the fact — and an all-clear counts, because it lives in
 * the same table as a symptom and is the same kind of answer.
 */
async function planCheckinReminders(now: number, prefs: PreferencesRow): Promise<PlannedReminder[]> {
  if (!prefs.notif_checkin_enabled) return [];
  const watching = await resolveSideEffectWatchList(prefs.side_effect_concerns);
  if (watching.length === 0) return [];

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
      title: 'Quick check-in 🌿',
      // Both offers are real: the side-effect sheet logs a symptom, and its
      // all-clear band records a clear day. Either one answers this window.
      body: 'Log a symptom or mark the day clear.',
      route: '/log-side-effect',
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
 * The side effects the check-in asks about, read out of the stored preference.
 *
 * Only preset ids survive. The column also holds `none`, which onboarding
 * writes for "nothing right now", and it may hold an id a later build renamed.
 * Neither is a chip the Profile row can draw, so neither counts as a watch.
 */
function sideEffectWatchList(stored: string | null): SideEffectPresetId[] {
  if (!stored) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return SIDE_EFFECT_PRESETS
    .map((preset) => preset.id)
    .filter((id) => parsed.includes(id));
}

/** The column value for a watch list. `[]` is a real answer, not a missing one. */
export function serializeSideEffectWatchList(ids: readonly SideEffectPresetId[]): string {
  return JSON.stringify(ids);
}

/**
 * The watch list, with the one-time default written on the first read.
 *
 * Every user who set up Poke before the Profile row could edit this list has
 * either nothing stored or the `none` onboarding offers, and both silenced the
 * check-in for good with no screen to turn it back on. So a list that names no
 * preset becomes all eight presets, once, and the answer is persisted rather
 * than recomputed: the user can then take chips off and Poke keeps that.
 *
 * A stored empty array is the one shape this leaves alone. Onboarding cannot
 * write it — that screen refuses to continue on an empty pick — so it can only
 * come from a user who cleared every chip on the Profile row, which is an
 * answer and not a gap. `notif_checkin_enabled` stays the real off switch.
 */
export async function resolveSideEffectWatchList(stored: string | null): Promise<SideEffectPresetId[]> {
  const watching = sideEffectWatchList(stored);
  if (watching.length > 0) return watching;
  if (stored === '[]') return [];

  const all = SIDE_EFFECT_PRESETS.map((preset) => preset.id);
  await updatePreferences({ side_effect_concerns: serializeSideEffectWatchList(all) });
  return all;
}

/**
 * Routes a tap on a banner to the screen that answers it.
 *
 * The route rides in the notification payload rather than being derived from
 * the title, because the queue outlives the build that wrote it. It comes back
 * as unknown data, so it is checked against the two routes Poke schedules
 * before any of it reaches the router.
 */
export async function listenForReminderTaps(
  open: (route: ReminderRoute) => void,
): Promise<() => void> {
  const Notifications = await getNotifications();
  if (!Notifications) return () => {};
  const handled = new Set<string>();
  const respond = (response: { notification: { request: { identifier: string; content: { data: unknown } } } }) => {
    // Once per banner: the tap that started the app reaches this function both
    // as the last response and, on a warm start, through the listener.
    if (handled.has(response.notification.request.identifier)) return;
    handled.add(response.notification.request.identifier);
    const route = reminderRouteFrom(response.notification.request.content.data);
    if (route) open(route);
  };
  const subscription = Notifications.addNotificationResponseReceivedListener(respond);
  // A tap on a dead app starts it, and the response lands before the database
  // gate lets this listener exist. The module keeps that response, so read it
  // back once the listener is up. It is in-memory state, not history: a fresh
  // start holds only the tap that caused it, or nothing.
  const launch = await Notifications.getLastNotificationResponseAsync();
  if (launch) respond(launch);
  return () => subscription.remove();
}

function reminderRouteFrom(data: unknown): ReminderRoute | null {
  if (typeof data !== 'object' || data === null) return null;
  const route = (data as { route?: unknown }).route;
  return REMINDER_ROUTES.find((known) => known === route) ?? null;
}

/**
 * The shot-day banner's title, and the body it writes when it holds no dose.
 *
 * Onboarding paints this banner on a mock lock screen, on the welcome carousel
 * and again on the notification step, so the two strings live here rather than
 * being typed a second time on those screens. A preview that carried its own
 * copy would drift the first time either string changed.
 */
export const SHOT_REMINDER_TITLE = "It's time 💪";
export const SHOT_REMINDER_BODY = 'Your scheduled shot is ready to log.';

/** `Your 2.50 mg shot is ready to log.`, or the same sentence without a number. */
function shotBody(dose: number, unit: Unit): string {
  if (!Number.isFinite(dose) || dose <= 0) return SHOT_REMINDER_BODY;
  return `Your ${formatDose(dose, unit)} shot is ready to log.`;
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
