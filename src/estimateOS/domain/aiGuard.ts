/**
 * aiGuard.ts — Centralized AI access guard
 *
 * Every AI feature (media analysis, assistant chat, image generation, etc.)
 * must call checkAiAccess() before proceeding. This ensures:
 *   - Credit balance is sufficient
 *   - Auto-reload state is respected
 *   - Provider/API readiness is checked
 *   - Network state is known
 *
 * Returns AiAccessResult so the caller can show the right UX.
 */

import { CreditBalance, AiCreditSettings, AiFailureType } from '../models/types';

// ─── Result shape ────────────────────────────────────────────────────────────

export type AiAccessStatus = 'allowed' | 'blocked';

export interface AiAccessResult {
  status: AiAccessStatus;
  failureType?: AiFailureType;
  /** Human-readable, safe-to-display message. Never raw stack trace. */
  message?: string;
  /** If true, show Buy Credits CTA. */
  showBuyCredits?: boolean;
  /** If true, show auto-reload setup CTA. */
  showAutoReloadSetup?: boolean;
}

// ─── Friendly failure messages ───────────────────────────────────────────────

export const AI_FAILURE_MESSAGES: Record<AiFailureType, string> = {
  missing_api_key:     'AI provider is not configured. Contact support or check your settings.',
  provider_unavailable:'AI service is temporarily unavailable. Please try again in a moment.',
  no_credits:          'You\'ve used all your AI credits. Buy more to continue.',
  offline:             'You appear to be offline. Please check your connection and try again.',
  timeout:             'Analysis timed out. Try with fewer or smaller images.',
  unsupported_media:   'One or more files are not supported. Use JPG, PNG, HEIC, MP4, or MOV.',
  oversized_media:     'One or more files are too large. Resize or compress and try again.',
  parse_failure:       'AI returned an unexpected result. Try re-running the analysis.',
  invalid_site_photo:  'The photo doesn\'t appear to show a worksite. Upload a clearer site photo.',
  unknown:             'Something went wrong. Please try again.',
};

// ─── Guard function ──────────────────────────────────────────────────────────

export interface AiAccessOptions {
  credits: CreditBalance | null;
  creditSettings?: AiCreditSettings | null;
  /** Pass false to skip credit check (e.g. for Phase 0 demo). */
  requireCredits?: boolean;
  /** Set false when you know the device is offline. */
  isOnline?: boolean;
  /** Set true when the provider API key is missing/unconfigured. */
  providerMissing?: boolean;
}

export function checkAiAccess(opts: AiAccessOptions): AiAccessResult {
  const {
    credits,
    creditSettings,
    requireCredits = true,
    isOnline = true,
    providerMissing = false,
  } = opts;

  if (!isOnline) {
    return { status: 'blocked', failureType: 'offline', message: AI_FAILURE_MESSAGES.offline };
  }

  if (providerMissing) {
    return {
      status: 'blocked',
      failureType: 'missing_api_key',
      message: AI_FAILURE_MESSAGES.missing_api_key,
    };
  }

  if (requireCredits) {
    const balance = credits?.balance ?? 0;
    if (balance <= 0) {
      const autoReload = creditSettings?.autoReload;
      if (autoReload?.enabled) {
        // Auto-reload is on — backend will handle; surface as pending billing
        return {
          status: 'blocked',
          failureType: 'no_credits',
          message: 'Reloading credits… Check your billing settings if this persists.',
          showBuyCredits: false,
          showAutoReloadSetup: false,
        };
      }
      return {
        status: 'blocked',
        failureType: 'no_credits',
        message: AI_FAILURE_MESSAGES.no_credits,
        showBuyCredits: true,
        showAutoReloadSetup: !autoReload?.enabled,
      };
    }
  }

  return { status: 'allowed' };
}

// ─── Error type mapper ────────────────────────────────────────────────────────
// Maps a raw error (from future AI backend) to a typed AiFailureType.

export function classifyAiError(err: unknown): AiFailureType {
  if (!err) return 'unknown';
  const msg = String(err instanceof Error ? err.message : err).toLowerCase();

  if (msg.includes('api key') || msg.includes('unauthorized') || msg.includes('authentication')) return 'missing_api_key';
  if (msg.includes('network') || msg.includes('offline') || msg.includes('enotfound')) return 'offline';
  if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('deadline')) return 'timeout';
  if (msg.includes('quota') || msg.includes('credit') || msg.includes('billing')) return 'no_credits';
  if (msg.includes('unsupported') || msg.includes('format') || msg.includes('mime')) return 'unsupported_media';
  if (msg.includes('too large') || msg.includes('size') || msg.includes('limit')) return 'oversized_media';
  if (msg.includes('parse') || msg.includes('json') || msg.includes('invalid response')) return 'parse_failure';
  if (msg.includes('not a valid site') || msg.includes('no worksite') || msg.includes('irrelevant')) return 'invalid_site_photo';
  if (msg.includes('unavailable') || msg.includes('503') || msg.includes('500')) return 'provider_unavailable';

  return 'unknown';
}

// ─── Maps grounding detector ──────────────────────────────────────────────────
// Detects whether a user question/prompt should use real-time Google Maps data.
// Used in AI Assistant chat and future AI workflows.

const MAPS_KEYWORDS = [
  'near me', 'nearby', 'closest', 'local', 'in my area', 'around here',
  'supplier', 'supply house', 'lumber yard', 'roofing supply', 'material supplier',
  'home depot', 'lowes', 'fastenal', 'abc supply', 'beacon',
  'address', 'directions', 'route', 'miles from', 'distance',
  'service area', 'coverage area', 'delivery area',
  'zip code', 'city', 'county', 'region',
  'find a', 'where is', 'where can i',
];

export function shouldUseMapGrounding(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  return MAPS_KEYWORDS.some(kw => lower.includes(kw));
}

export const MAPS_GROUNDING_HINT = '📍 Grounded with Google Maps';
