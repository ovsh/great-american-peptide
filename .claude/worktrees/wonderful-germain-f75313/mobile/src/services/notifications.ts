import { Platform } from 'react-native';
import { listMedications } from '../repositories/medications';
import { lastInjectionFor } from '../repositories/injections';
import { getPreferences } from '../repositories/preferences';
import { frequencyHours } from '../domain/scheduling';

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

function parseTime(hhmm: string): { hour: number; minute: number } {
  const [h, m] = hhmm.split(':').map((s) => parseInt(s, 10));
  return { hour: h ?? 9, minute: m ?? 0 };
}

export async function refreshScheduledReminders(): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;
  const prefs = await getPreferences();
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!prefs.notifications_enabled) return;

  const meds = await listMedications();
  const { hour, minute } = parseTime(prefs.reminder_time);

  for (const med of meds) {
    if (med.status !== 'active') continue;
    const last = await lastInjectionFor(med.id);
    const intervalMs = frequencyHours(med.frequency_kind, med.frequency_value) * 60 * 60 * 1000;
    const lastTaken = last?.taken_at ?? Date.now() - intervalMs;
    let next = lastTaken + intervalMs;
    const now = Date.now();
    if (next < now) next = now + 60 * 1000;

    for (let i = 0; i < 6; i++) {
      const fireDate = new Date(next + i * intervalMs);
      fireDate.setHours(hour, minute, 0, 0);
      if (fireDate.getTime() <= Date.now()) continue;
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: med.name,
            body: `${med.default_dose} ${med.default_unit} · ${med.default_route.toUpperCase()}`,
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireDate },
        });
      } catch {
        // ignore individual scheduling failures
      }
    }
  }
}
