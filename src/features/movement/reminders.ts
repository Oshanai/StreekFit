/**
 * Streak reminders — LOCAL scheduled notifications, no push server needed
 * (TZ §12.2: «напоминания о стрике»; Expo Push подключим после релиза).
 *
 * Strategy: on every daily sync we cancel and re-schedule two one-shots at
 * 19:00 — today (only while the day is still open) and tomorrow (fallback
 * for a day the user never opens the app). Refreshing on each sync keeps
 * them accurate; a user inactive for days gets exactly one nudge, not spam.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import i18n from '@/i18n';

const REMINDER_HOUR = 19;

// Foreground behaviour: never interrupt an open app with the nudge banner.
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

async function hasPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

function at19(daysFromNow: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(REMINDER_HOUR, 0, 0, 0);
  return d;
}

function reminderContent(streak: number): Notifications.NotificationContentInput {
  return {
    title: i18n.t('reminder.title'),
    body:
      streak > 0
        ? i18n.t('reminder.bodyStreak', { count: streak })
        : i18n.t('reminder.body'),
    sound: false,
  };
}

/** Call after each daily sync; safe to call often — schedules are replaced. */
export async function refreshStreakReminders(opts: {
  dayClosed: boolean;
  streak: number;
}): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    if (!(await hasPermission())) return;

    await Notifications.cancelAllScheduledNotificationsAsync();

    const today = at19(0);
    if (!opts.dayClosed && Date.now() < today.getTime()) {
      await Notifications.scheduleNotificationAsync({
        content: reminderContent(opts.streak),
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: today },
      });
    }
    await Notifications.scheduleNotificationAsync({
      content: reminderContent(opts.dayClosed ? opts.streak : 0),
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at19(1) },
    });
  } catch {
    // Notifications are a nudge, never a failure path.
  }
}
