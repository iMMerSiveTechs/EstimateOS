/**
 * services/commProvider.ts — Communication provider adaptor boundary.
 *
 * Provides clean interfaces for:
 *   - Email send (with optional PDF attachment)
 *   - SMS send
 *   - Notification dispatch
 *   - Unified send flow with intent-based routing
 *
 * Currently all comms use local-first flows (Copy, Share, MailComposer).
 * When a real provider (SendGrid, Twilio, etc.) is connected, replace the
 * stub internals without changing screens or CommReviewModal.
 */

import { Share, Platform, Clipboard } from 'react-native';
import { CommIntent } from '../models/types';
import { ServiceResult, ok, stubMode, providerError } from './ServiceResult';

// ─── Types ──────────────────────────────────────────────────────────────────

export type CommChannel = 'email' | 'sms' | 'push';

export type CommAction = 'email' | 'share' | 'copy';

export interface SendRequest {
  channel: CommChannel;
  to: string;                    // email address or phone number
  subject?: string;              // email only
  body: string;
  /** If true, open device compose UI instead of sending silently. */
  useDeviceComposer?: boolean;
  /** File URIs to attach (e.g. PDF). Used with email composer. */
  attachments?: string[];
}

export interface SendResult {
  channel: CommChannel;
  delivered: boolean;            // true = provider confirmed delivery (or compose opened)
  providerMessageId?: string;    // from SendGrid, Twilio, etc.
}

// ─── Unified send request (Phase 15B) ────────────────────────────────────────

export interface UnifiedSendRequest {
  intent: CommIntent;
  action: CommAction;
  to?: string;                   // email address (required for 'email' action)
  subject: string;
  body: string;
  /** File URIs to attach (e.g. estimate/invoice PDF). */
  attachments?: string[];
}

export interface UnifiedSendResult {
  action: CommAction;
  delivered: boolean;
  message: string;
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

// ─── Unified send (Phase 15B) ────────────────────────────────────────────────

/**
 * Unified communication entry point.
 * Routes to the right delivery mechanism based on action.
 * All screens should use this instead of calling Share/MailComposer directly.
 */
export async function sendUnified(
  request: UnifiedSendRequest,
): Promise<ServiceResult<UnifiedSendResult>> {
  const { action, subject, body, to, attachments } = request;

  if (action === 'copy') {
    const full = subject ? `${subject}\n\n${body}` : body;
    Clipboard.setString(full);
    return ok(
      { action: 'copy', delivered: true, message: 'Copied to clipboard.' },
      'Message copied to clipboard.',
    );
  }

  if (action === 'email') {
    return sendEmailUnified(to, subject, body, attachments);
  }

  if (action === 'share') {
    return sendShareUnified(subject, body, attachments);
  }

  return providerError(`Unknown action: ${action}`);
}

async function sendEmailUnified(
  to: string | undefined,
  subject: string,
  body: string,
  attachments?: string[],
): Promise<ServiceResult<UnifiedSendResult>> {
  try {
    let MailComposer: any = null;
    try { MailComposer = require('expo-mail-composer'); } catch {}

    if (MailComposer && (await MailComposer.isAvailableAsync())) {
      const opts: any = {
        recipients: to ? [to] : [],
        subject,
        body,
      };
      if (attachments && attachments.length > 0) {
        opts.attachments = attachments;
      }
      await MailComposer.composeAsync(opts);
      return ok(
        { action: 'email', delivered: true, message: 'Email composer opened.' },
        'Email composer opened.',
      );
    }

    // Fallback: native share sheet
    await Share.share({ title: subject, message: body });
    return ok(
      { action: 'email', delivered: true, message: 'Shared via share sheet (mail not available).' },
      'Shared via device share sheet.',
    );
  } catch {
    return providerError('Could not open email composer.');
  }
}

async function sendShareUnified(
  subject: string,
  body: string,
  attachments?: string[],
): Promise<ServiceResult<UnifiedSendResult>> {
  try {
    // If we have a PDF attachment, share the file directly via expo-sharing
    if (attachments && attachments.length > 0) {
      let Sharing: any = null;
      try { Sharing = require('expo-sharing'); } catch {}

      if (Sharing && (await Sharing.isAvailableAsync())) {
        // Share the first attachment (primary document)
        await Sharing.shareAsync(attachments[0], {
          mimeType: 'application/pdf',
          dialogTitle: subject,
          UTI: 'com.adobe.pdf',
        });
        return ok(
          { action: 'share', delivered: true, message: 'Shared via share sheet.' },
          'Document shared.',
        );
      }
    }

    // Fallback: share text
    await Share.share({ title: subject, message: body });
    return ok(
      { action: 'share', delivered: true, message: 'Shared via share sheet.' },
      'Shared via share sheet.',
    );
  } catch {
    return providerError('Could not open share sheet.');
  }
}

// ─── Legacy send (kept for backwards compatibility) ──────────────────────────

/**
 * Send a communication (legacy API).
 * Prefer sendUnified() for new code.
 */
export async function sendComm(
  request: SendRequest,
): Promise<ServiceResult<SendResult>> {
  const { channel, to, subject, body, useDeviceComposer = true, attachments } = request;

  if (channel === 'email') {
    return sendEmail(to, subject ?? '', body, useDeviceComposer, attachments);
  }

  if (channel === 'sms') {
    return sendSms(to, body);
  }

  if (channel === 'push') {
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
  attachments?: string[],
): Promise<ServiceResult<SendResult>> {
  if (useDeviceComposer) {
    try {
      let MailComposer: any = null;
      try { MailComposer = require('expo-mail-composer'); } catch {}

      if (MailComposer && (await MailComposer.isAvailableAsync())) {
        const opts: any = { recipients: [to], subject, body };
        if (attachments && attachments.length > 0) {
          opts.attachments = attachments;
        }
        await MailComposer.composeAsync(opts);
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
  //   1. Call provider API with to, subject, body, attachments
  //   2. Return providerMessageId on success
  //   3. Map provider errors to ServiceResult
  return stubMode('Silent email send is not configured. Use device composer or configure a provider.');
}

// ─── SMS (local share or provider) ──────────────────────────────────────────

async function sendSms(
  to: string,
  body: string,
): Promise<ServiceResult<SendResult>> {
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

// ─── Intent → timeline event mapping ────────────────────────────────────────

/**
 * Maps a CommIntent to the appropriate TimelineEventType.
 * Used by screens to log the right event after sendUnified succeeds.
 */
export function intentToTimelineEvent(intent: CommIntent): string {
  switch (intent) {
    case 'estimate_send':        return 'estimate_sent';
    case 'invoice_send':         return 'invoice_sent';
    case 'follow_up':            return 'followup_sent';
    case 'appointment_reminder': return 'reminder_sent';
    case 'payment_reminder':     return 'payment_reminder_sent';
    case 'callback_follow_up':   return 'followup_sent';
    case 'general':              return 'note_added';
    default:                     return 'note_added';
  }
}
