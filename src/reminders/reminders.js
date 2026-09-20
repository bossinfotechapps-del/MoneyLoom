import notifee, { AlarmType, AndroidImportance, AuthorizationStatus, RepeatFrequency, TriggerType } from '@notifee/react-native';
import { isLastDayOfMonth, monthEndSummary, monthStartSummary, nightlySummary } from './summaries';
import { daysInMonth, monthKey, todayStr } from '../utils/dates';

export const REMINDER_ID = 'moneyloom-daily-log';
export const MONTH_END_ID = 'moneyloom-month-end';
export const MONTH_START_ID = 'moneyloom-month-start';

const CHANNEL_ID = 'daily-reminder';
const MONTHLY_CHANNEL_ID = 'monthly-summary';

const at = (date, hour, minute) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute, 0, 0).getTime();

const nextDaily = (hour, minute) => {
  const now = new Date();
  let when = at(now, hour, minute);
  if (when <= now.getTime() + 30 * 1000) when = at(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1), hour, minute);
  return when;
};

// The last day of this month at the given time, or next month's if that has passed
const nextMonthEnd = (hour, minute) => {
  const now = new Date();
  const lastDay = daysInMonth(monthKey(todayStr()));
  let when = at(new Date(now.getFullYear(), now.getMonth(), lastDay), hour, minute);
  if (when <= now.getTime() + 30 * 1000) {
    const next = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    when = at(next, hour, minute);
  }
  return when;
};

// The 1st of next month
const nextMonthStart = (hour, minute) => {
  const now = new Date();
  let when = at(new Date(now.getFullYear(), now.getMonth(), 1), hour, minute);
  if (when <= now.getTime() + 30 * 1000) when = at(new Date(now.getFullYear(), now.getMonth() + 1, 1), hour, minute);
  return when;
};

async function allowed(askPermission) {
  const settings = askPermission ? await notifee.requestPermission() : await notifee.getNotificationSettings();
  return settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED;
}

const channels = async () => {
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Daily summary',
    description: 'An evening note with what you spent today',
    importance: AndroidImportance.DEFAULT,
  });
  await notifee.createChannel({
    id: MONTHLY_CHANNEL_ID,
    name: 'Monthly summary',
    description: 'A note at the end and start of each month',
    importance: AndroidImportance.DEFAULT,
  });
};

const schedule = async ({ id, channelId, title, body, timestamp, repeat, pressAction }) => {
  await notifee.cancelTriggerNotification(id);
  await notifee.createTriggerNotification(
    {
      id,
      title,
      body,
      android: {
        channelId,
        smallIcon: 'ic_stat_moneyloom',
        color: '#1D6B66',
        pressAction: { id: pressAction, launchActivity: 'default' },
      },
    },
    {
      type: TriggerType.TIMESTAMP,
      timestamp,
      ...(repeat ? { repeatFrequency: repeat } : {}),
      // Inexact alarm: needs no special permission, and may arrive a few minutes late
      alarmManager: { type: AlarmType.SET_AND_ALLOW_WHILE_IDLE },
    }
  );
};

/**
 * Schedules the evening summary.
 *
 * Android fixes a notification's text when it is scheduled, so this is re-run whenever the app
 * closes: the wording then reflects the latest data. `data` is optional; without it the
 * notification falls back to a plain nudge.
 */
export async function scheduleDailyReminder(hour, minute, askPermission = true, data = null) {
  if (!(await allowed(askPermission))) return false;
  await channels();
  const text = data
    ? nightlySummary(data)
    : { title: 'Log today’s spending', body: 'Takes a few seconds and keeps your monthly trends accurate.' };
  await schedule({
    id: REMINDER_ID,
    channelId: CHANNEL_ID,
    title: text.title,
    body: text.body,
    timestamp: nextDaily(hour, minute),
    repeat: RepeatFrequency.DAILY,
    pressAction: 'add-expense',
  });
  return true;
}

/**
 * Schedules the two monthly notes: one on the last evening of the month asking you to set next
 * month's budget, and one on the 1st summarising the month just finished.
 */
export async function scheduleMonthlyNotes(askPermission = false, data = null) {
  if (!(await allowed(askPermission))) return false;
  await channels();
  const end = data ? monthEndSummary(data) : { title: 'Month ending', body: 'Set next month’s budget.' };
  const start = data ? monthStartSummary(data) : { title: 'Last month in one line', body: 'See how the month went.' };
  await schedule({
    id: MONTH_END_ID,
    channelId: MONTHLY_CHANNEL_ID,
    title: end.title,
    body: end.body,
    timestamp: nextMonthEnd(20, 0),
    pressAction: 'set-budget',
  });
  await schedule({
    id: MONTH_START_ID,
    channelId: MONTHLY_CHANNEL_ID,
    title: start.title,
    body: start.body,
    timestamp: nextMonthStart(10, 0),
    pressAction: 'open-overview',
  });
  return true;
}

export async function cancelDailyReminder() {
  await notifee.cancelTriggerNotification(REMINDER_ID);
}

export async function cancelMonthlyNotes() {
  await notifee.cancelTriggerNotification(MONTH_END_ID);
  await notifee.cancelTriggerNotification(MONTH_START_ID);
}

/** Re-writes whichever notifications are switched on, with wording from the data as it stands now. */
export async function refreshScheduled(settings, data) {
  if (!settings) return;
  try {
    if (settings.reminderEnabled) await scheduleDailyReminder(settings.reminderHour, settings.reminderMinute, false, data);
    if (settings.monthlyNotesEnabled) await scheduleMonthlyNotes(false, data);
  } catch (e) {
    // Notifications are a convenience: never let them break the app
  }
}

export const formatTime = (hour, minute) => {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
};

export { isLastDayOfMonth };
