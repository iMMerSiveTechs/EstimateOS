/**
 * services/commProvider.ts — Communication provider adaptor boundary.
 *
 * Provides clean interfaces for:
 *   - Email send
 *   - SMS send
 *   - Notification dispatch
 *
 * Currently all comms use local-first flows (Copy, Share, MailComposer).
 * When a real provider (SendGrid, Twilio, etc.) is connected, replace the
 * stub internals without changing screens or CommReviewModal.
 */

import { Share, Platform } from 'react-native';
import { ServiceResult, ok, stubMode, providerError } from './ServiceResult';

// ─── Types ──────────────────────────────────────────────────────────────────

export type CommChannel = 'email' | 'sms' | 'push';

export interface SendRequest {
  channel: CommChannel;
  to: string;                    // email address or phone number
  subject?: string;              // email only
  body: string;
  /** If true, open device compose UI instead of sending silently. */
  useDeviceComposer?: boolean;
}

export interface SendResult {
  channel: CommChannel;
  delivered: boolean;            // true = provider confirmed delivery (or compose opened)
  providerMessageId?: string;    // from SendGrid, Twilio, etc.
}

// ─── Channel availability ───────────────────────────────────────────────────

export interface CommCapabilities {
  emailSend: 'local_only' | 'provider_ready';
  smsSend: 'local_only' | 'provider_ready';
  pushNotify: 'not_available' | 'provider_ready';
}

/**
 * Returns what comm channels are available.
 * Currently all are local-only (device compose / share).
 */
export function getCommCapabilities(): CommCapabilities {
  return {
    emailSend: 'local_only',
    smsSend: 'local_only',
    pushNotify: 'not_available',
  };
}

// ─── Send ───────────────────────────────────────────────────────────────────

/**
 * Send a communication.
 * Currently local-first: opens device compose UI for email,
 * native share for SMS. When a provider is connected, it can
 * send silently via API.
 */
export async function sendComm(
  request: SendRequest,
): Promise<ServiceResult<SendResult>> {
  const { channel, to, subject, body, useDeviceComposer = true } = request;

  if (channel === 'email') {
    return sendEmail(to, subject ?? '', body, useDeviceComposer);
  }

  if (channel === 'sms') {
    return sendSms(to, body);
  }

  if (channel === 'push') {
    // Push notifications require a backend provider (FCM, APNs)
    return stubMode('Push notifications are not yet configured.');
  }

  return providerError(`Unknown channel: ${channel}`);
}

// ─── Email (local compose or provider) ──────────────────────────────────────

async function sendEmail(
  to: string,
  subject: string,
  body: string,
  useDeviceComposer: boolean,
): Promise<ServiceResult<SendResult>> {
  if (useDeviceComposer) {
    // Try expo-mail-composer, fall back to share
    try {
      let MailComposer: any = null;
      try { MailComposer = require('expo-mail-composer'); } catch {}

      if (MailComposer && (await MailComposer.isAvailableAsync())) {
        await MailComposer.composeAsync({
          recipients: [to],
          subject,
          body,
        });
        return ok({ channel: 'email', delivered: true }, 'Email composer opened.');
      }

      // Fallback: native share sheet
      await Share.share({ title: subject, message: body });
      return ok({ channel: 'email', delivered: true }, 'Shared via device share sheet.');
    } catch {
      return providerError('Could not open email composer.');
    }
  }

  // TODO: When a provider (SendGrid, etc.) is connected:
  //   1. Call provider API with to, subject, body
  //   2. Return providerMessageId on success
  //   3. Map provider errors to ServiceResult
  return stubMode('Silent email send is not configured. Use device composer or configure a provider.');
}

// ─── SMS (local share or provider) ──────────────────────────────────────────

async function sendSms(
  to: string,
  body: string,
): Promise<ServiceResult<SendResult>> {
  // Local-first: use native share (which can open Messages app)
  try {
    const smsUrl = Platform.OS === 'ios'
      ? `sms:${to}&body=${encodeURIComponent(body)}`
      : `sms:${to}?body=${encodeURIComponent(body)}`;

    await Share.share({ message: body, title: 'Send SMS' });
    return ok({ channel: 'sms', delivered: true }, 'Opened messaging app.');
  } catch {
    return providerError('Could not open messaging app.');
  }

  // TODO: When Twilio is connected:
  //   1. Call backend to send SMS via Twilio
  //   2. Return providerMessageId
}
