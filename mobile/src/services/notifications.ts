import { Platform } from 'react-native';
import { listInjections } from '../repositories/injections';
import { listMedications } from '../repositories/medications';
import { getPreferences } from '../repositories/preferences';
import { medicationScheduleFromStored, nextScheduledDoses } from '../domain/scheduling';
import { startOfDay } from '../utils/date';

type ExpoNotifications = typeof import('expo-notifications');

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
  return req.status === 'granted';
}

export async function refreshScheduledReminders(): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;
  const prefs = await getPreferences();
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!prefs.notifications_enabled) return;

  const meds = await listMedications();
  const now = Date.now();

  for (const med of meds) {
    if (med.status !== 'active') continue;
    const schedule = medicationScheduleFromStored({
      medicationId: med.id,
      frequencyKind: med.frequency_kind,
      frequencyValue: med.frequency_value,
      createdAt: med.created_at,
      reminderTime: prefs.reminder_time,
    });
    if (!schedule) continue;

    const doses = nextScheduledDoses(schedule, now, 6);
    if (doses.length === 0) continue;

    // A dose the user already logged needs no reminder. The schedule holds one dose
    // per medication per day, so a shot on the same local day answers that dose.
    // Without this, a shot at 07:30 still gets the 09:00 reminder.
    const loggedFrom = Math.min(...doses.map((dose) => dose.scheduledDay));
    const logged = await listInjections({ medicationId: med.id, fromMs: loggedFrom });
    const loggedDays = new Set(logged.map((injection) => startOfDay(injection.taken_at)));

    for (const dose of doses) {
      if (loggedDays.has(dose.scheduledDay)) continue;
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            // The reminder repeats the schedule the user set. It gives no
            // instruction, so the body names the user as the source of the number.
            title: `${med.name} is on your schedule`,
            body: `You set ${med.default_dose} ${med.default_unit} · ${med.default_route.toUpperCase()} for today.`,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(dose.scheduledAt),
          },
        });
      } catch {
        // ignore individual scheduling failures
      }
    }
  }
}
