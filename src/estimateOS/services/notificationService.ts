/**
 * services/notificationService.ts — Local notification scheduling for reminders.
 *
 * Uses expo-notifications to schedule/cancel local device notifications.
 * Degrades gracefully: if expo-notifications is not installed or permissions are
 * denied, reminders save normally and the app remains fully usable.
 *
 * To install: npx expo install expo-notifications
 *
 * Call configureNotificationHandler() once at app startup (App.tsx / root).
 */

import { Reminder, ReminderType } from '../models/types';
import { Platform } from 'react-native';

// Dynamic require — app won't crash if package isn't installed yet
let Notifications: any = null;
try { Notifications = require('expo-notifications'); } catch {}

// ─── Types ───────────────────────────────────────────────────────────────────

export type NotifPermissionStatus = 'granted' | 'denied' | 'undetermined' | 'unavailable';

export interface ScheduleResult {
  /** Notification ID returned by expo-notifications, or null if not scheduled. */
  notificationId: string | null;
  /** Permission status at the time of scheduling attempt. */
  permissionStatus: NotifPermissionStatus;
}

// ─── Permission ───────────────────────────────────────────────────────────────

// Session-level cache — avoid re-prompting once permission is settled
let _permCache: NotifPermissionStatus | null = null;

/** Get current permission without prompting. */
export async function getNotificationPermission(): Promise<NotifPermissionStatus> {
  if (!Notifications) return 'unavailable';
  if (_permCache === 'granted') return 'granted';
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') _permCache = 'granted';
    return (status as NotifPermissionStatus) ?? 'undetermined';
  } catch {
    return 'unavailable';
  }
}

/**
 * Request notification permission if not yet granted.
 * Returns the resulting status. Safe to call multiple times — uses cache after first call.
 */
export async function requestNotificationPermission(): Promise<NotifPermissionStatus> {
  if (!Notifications) return 'unavailable';
  if (_permCache === 'granted') return 'granted';
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') { _permCache = 'granted'; return 'granted'; }
    if (existing === 'denied') { _permCache = 'denied'; return 'denied'; }
    // undetermined — prompt
    const { status } = await Notifications.requestPermissionsAsync();
    _permCache = status as NotifPermissionStatus;
    return status as NotifPermissionStatus;
  } catch {
    return 'unavailable';
  }
}

// ─── Notification content ─────────────────────────────────────────────────────

const NOTIF_TITLES: Record<ReminderType, string> = {
  estimate_followup: 'Follow-up due',
  callback:          'Callback needed',
  appointment:       'Appointment today',
  invoice_reminder:  'Invoice follow-up',
  checkin:           'Check-in due',
};

function buildTitle(reminder: Reminder): string {
  const prefix = NOTIF_TITLES[reminder.type] ?? 'Reminder';
  return reminder.customerName ? `${prefix} — ${reminder.customerName}` : prefix;
}

function buildBody(reminder: Reminder): string {
  if (reminder.note) return reminder.note;
  if (reminder.customerName) return `Action needed for ${reminder.customerName}.`;
  return 'Tap to open JobForge.';
}

// Notifications fire at 9:00 AM local time on the due date
const NOTIFICATION_HOUR = 9;

// ─── Schedule / cancel ────────────────────────────────────────────────────────

/**
 * Schedule a local notification for a reminder.
 *
 * Fires at 9:00 AM local time on reminder.dueDate.
 * Returns null notificationId (without error) if:
 *   - expo-notifications is not installed
 *   - permission is denied
 *   - due date is in the past
 *   - scheduling throws unexpectedly
 */
export async function scheduleReminderNotification(reminder: Reminder): Promise<ScheduleResult> {
  if (!Notifications) return { notificationId: null, permissionStatus: 'unavailable' };

  const permissionStatus = await requestNotificationPermission();
  if (permissionStatus !== 'granted') {
    return { notificationId: null, permissionStatus };
  }

  try {
    // Parse YYYY-MM-DD and schedule at 9 AM local
    const [year, month, day] = reminder.dueDate.split('-').map(Number);
    if (!year || !month || !day) return { notificationId: null, permissionStatus: 'granted' };

    const triggerDate = new Date(year, month - 1, day, NOTIFICATION_HOUR, 0, 0);

    // Don't schedule for past dates — reminder still saves in-app
    if (triggerDate <= new Date()) {
      return { notificationId: null, permissionStatus: 'granted' };
    }

    // expo-notifications v0.28+ requires SchedulableTriggerInputTypes.DATE.
    // Fall back to the legacy { date } shorthand for older versions.
    const triggerType = Notifications.SchedulableTriggerInputTypes?.DATE ?? 'date';
    const notificationId: string = await Notifications.scheduleNotificationAsync({
      content: {
        title: buildTitle(reminder),
        body: buildBody(reminder),
        sound: true,
        // Android channel — must match the channel created in configureNotificationHandler
        ...(Platform.OS === 'android' ? { channelId: 'reminders' } : {}),
        data: {
          reminderId: reminder.id,
          customerId: reminder.customerId ?? null,
          estimateId: reminder.estimateId ?? null,
          type: reminder.type,
        },
      },
      trigger: { type: triggerType, date: triggerDate },
    });

    return { notificationId, permissionStatus: 'granted' };
  } catch {
    return { notificationId: null, permissionStatus: 'granted' };
  }
}

/**
 * Cancel a previously scheduled notification.
 * Safe to call with null or undefined — does nothing.
 */
export async function cancelScheduledNotification(
  notificationId: string | null | undefined,
): Promise<void> {
  if (!Notifications || !notificationId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {}
}

// ─── App startup ──────────────────────────────────────────────────────────────

/**
 * Configure how notifications appear when the app is foregrounded,
 * and set up the Android notification channel (required for Android 8+).
 * Call once at app root (App.tsx) before the navigator renders.
 */
export function configureNotificationHandler(): void {
  if (!Notifications) return;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    // Android 8+ (API 26+) requires a notification channel.
    // This is safe to call every launch — Expo is idempotent for existing channels.
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('reminders', {
        name: 'Reminders',
        description: 'Follow-up, appointment, and invoice reminders',
        importance: Notifications.AndroidImportance?.MAX ?? 5,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
      }).catch(() => {});
    }
  } catch {}
}
