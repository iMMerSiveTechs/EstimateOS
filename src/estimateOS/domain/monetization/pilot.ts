/**
 * monetization/pilot.ts
 *
 * Founding partner / pilot program support.
 *
 * A pilot is a temporarily free or discounted period before a partner
 * converts to a paid subscription. The pilot is anchored to a plan so the
 * partner experiences full entitlements before committing.
 *
 * Immutability: all state-transition helpers return new records. Never mutate
 * a FoundingPartnerRecord directly.
 */

import { FoundingPartnerRecord, PartnerConversionOffer, PilotStatus, PlanId } from './types';
import { PLANS } from './plans';

// ─── Program-level config ─────────────────────────────────────────────────────
// Defaults used when creating new pilot records. Override per-partner via opts.

export const FOUNDING_PARTNER_CONFIG = {
  /** Default plan entitlements granted during pilot. */
  defaultPilotPlanId: 'growth' as PlanId,
  /** Default pilot duration in days. null = open-ended (no expiry). */
  defaultPilotDays: 90 as number | null,
  /** Days after pilot expiry that a conversion offer remains valid. */
  conversionOfferWindowDays: 30,
  /**
   * Default locked-in discount fraction off retail at conversion.
   * 0 = no discount (full retail price). 0.1 = 10% off retail.
   */
  defaultLockInDiscountPct: 0,
  /** How long the locked price is guaranteed after conversion (months). null = permanent. */
  defaultLockDurationMonths: null as number | null,
} as const;

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createFoundingPartnerRecord(
  userId: string,
  opts: {
    pilotPlanId?: PlanId;
    /** Monthly fee charged during pilot (USD cents). Default 0 = free pilot. */
    pilotMonthlyFee?: number;
    setupFeeWaived?: boolean;
    /** Pilot duration in days. null = open-ended. Omit to use program default. */
    durationDays?: number | null;
    internalNotes?: string;
  } = {},
): FoundingPartnerRecord {
  const planId = opts.pilotPlanId ?? FOUNDING_PARTNER_CONFIG.defaultPilotPlanId;
  const plan = PLANS[planId];
  const now = new Date();

  const durationDays =
    opts.durationDays !== undefined
      ? opts.durationDays
      : FOUNDING_PARTNER_CONFIG.defaultPilotDays;

  const expiresAt =
    durationDays !== null
      ? new Date(now.getTime() + durationDays * 86_400_000).toISOString()
      : null;

  return {
    userId,
    pilotPlanId:        planId,
    retailMonthlyPrice: plan.monthlyPrice,
    pilotMonthlyFee:    opts.pilotMonthlyFee ?? 0,
    setupFeeWaived:     opts.setupFeeWaived ?? true,
    startedAt:          now.toISOString(),
    expiresAt,
    status:             'active',
    internalNotes:      opts.internalNotes,
  };
}

// ─── Status helpers ───────────────────────────────────────────────────────────

export function isPilotActive(record: FoundingPartnerRecord): boolean {
  if (record.status !== 'active') return false;
  if (record.expiresAt === null) return true;
  return new Date(record.expiresAt) > new Date();
}

export function isPilotExpired(record: FoundingPartnerRecord): boolean {
  if (record.status === 'expired') return true;
  if (record.status !== 'active') return false;
  return record.expiresAt !== null && new Date(record.expiresAt) <= new Date();
}

/** Days remaining in the pilot. Returns null if open-ended, 0 if expired. */
export function pilotDaysRemaining(record: FoundingPartnerRecord): number | null {
  if (record.expiresAt === null) return null;
  const ms = new Date(record.expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

// ─── Conversion offer ─────────────────────────────────────────────────────────

/**
 * Derives the conversion offer for a founding partner.
 *
 * @param lockInDiscountPct  Fraction off retail (0.0–1.0). 0 = no discount.
 * @param lockDurationMonths Months the locked price is guaranteed. null = permanent.
 * @param offerWindowDays    Days after pilot expiry the offer is valid.
 */
export function getConversionOffer(
  record: FoundingPartnerRecord,
  opts: {
    lockInDiscountPct?: number;
    lockDurationMonths?: number | null;
    offerWindowDays?: number;
  } = {},
): PartnerConversionOffer {
  const discountPct =
    opts.lockInDiscountPct ?? FOUNDING_PARTNER_CONFIG.defaultLockInDiscountPct;
  const lockDuration =
    opts.lockDurationMonths !== undefined
      ? opts.lockDurationMonths
      : FOUNDING_PARTNER_CONFIG.defaultLockDurationMonths;
  const windowDays =
    opts.offerWindowDays ?? FOUNDING_PARTNER_CONFIG.conversionOfferWindowDays;

  const lockedPrice = Math.round(record.retailMonthlyPrice * (1 - discountPct));

  // Offer window starts when the pilot expires (or now, if open-ended / already active).
  const windowBase = record.expiresAt ?? new Date().toISOString();
  const offerExpiresAt = new Date(
    new Date(windowBase).getTime() + windowDays * 86_400_000,
  ).toISOString();

  return {
    planId:             record.pilotPlanId,
    lockedMonthlyPrice: lockedPrice,
    lockDurationMonths: lockDuration,
    offerExpiresAt,
  };
}

// ─── Immutable state transitions ──────────────────────────────────────────────

export function markPilotConverted(record: FoundingPartnerRecord): FoundingPartnerRecord {
  return { ...record, status: 'converted' };
}

export function markPilotExpired(record: FoundingPartnerRecord): FoundingPartnerRecord {
  return { ...record, status: 'expired' };
}

export function markPilotWaived(record: FoundingPartnerRecord): FoundingPartnerRecord {
  return { ...record, status: 'waived' };
}

/**
 * Returns the effective PilotStatus accounting for wall-clock expiry.
 * Use this rather than reading record.status directly when the record may
 * not have been updated since expiry occurred.
 */
export function resolvedPilotStatus(record: FoundingPartnerRecord): PilotStatus {
  if (record.status !== 'active') return record.status;
  if (isPilotExpired(record)) return 'expired';
  return 'active';
}
