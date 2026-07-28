/**
 * Streak reminders — LOCAL scheduled notifications, no push server needed
 * (TZ §12.2: «напоминания о стрике»; Expo Push подключим после релиза).
 *
 * Strategy: on every daily sync we cancel and re-schedule two one-shots at
 * 19:00 — today (only while the day is still open) and tomorrow (fallback
 * for a day the user never opens the app). Refreshing on each sync keeps
 * them accurate; a user inactive for days gets exactly one nudge, not spam.
 *
 * expo-notifications is required LAZILY: a dev client built before the
 * native module was added must degrade to a no-op, not crash the Today
 * screen at import time.
 */

import { Platform } from 'react-native';

import i18n from '@/i18n';

type NotificationsModule = typeof import('expo-notifications');

const REMINDER_HOUR = 19;

let cachedModule: NotificationsModule | null | undefined;
let handlerSet = false;

function getNotifications(): NotificationsModule | null {
  if (Platform.OS === 'web') return null;
  if (cachedModule !== undefined) return cachedModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: old dev clients lack the native module
    cachedModule = require('expo-notifications') as NotificationsModule;
  } catch {
    cachedModule = null;
  }
  return cachedModule;
}

async function hasPermission(notifications: NotificationsModule): Promise<boolean> {
  const current = await notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await notifications.requestPermissionsAsync();
  return asked.granted;
}

function at19(daysFromNow: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(REMINDER_HOUR, 0, 0, 0);
  return d;
}

function reminderContent(streak: number) {
  return {
    title: i18n.t('reminder.title'),
    body:
      streak > 0
        ? i18n.t('reminder.bodyStreak', { count: streak })
        : i18n.t('reminder.body'),
    sound: false as const,
  };
}

/** Call after each daily sync; safe to call often — schedules are replaced. */
export async function refreshStreakReminders(opts: {
  dayClosed: boolean;
  streak: number;
}): Promise<void> {
  const notifications = getNotifications();
  if (notifications == null) return;
  try {
    if (!handlerSet) {
      // Foreground behaviour: never interrupt an open app with the nudge banner.
      notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: false,
          shouldShowList: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      });
      handlerSet = true;
    }

    if (!(await hasPermission(notifications))) return;

    await notifications.cancelAllScheduledNotificationsAsync();

    const today = at19(0);
    if (!opts.dayClosed && Date.now() < today.getTime()) {
      await notifications.scheduleNotificationAsync({
        content: reminderContent(opts.streak),
        trigger: { type: notifications.SchedulableTriggerInputTypes.DATE, date: today },
      });
    }
    await notifications.scheduleNotificationAsync({
      content: reminderContent(opts.dayClosed ? opts.streak : 0),
      trigger: { type: notifications.SchedulableTriggerInputTypes.DATE, date: at19(1) },
    });
  } catch {
    // Notifications are a nudge, never a failure path.
  }
}
