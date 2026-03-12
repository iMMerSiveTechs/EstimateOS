/**
 * monetization/types.ts
 *
 * Canonical types for the EstimateOS monetization domain.
 * Shell-agnostic: no company-specific names or branding live here.
 *
 * Relationship to models/types.ts:
 *   AppPlanTier ('free'|'starter'|'pro'|'enterprise') is the legacy generic
 *   enum used by AppSubscriptionStatus. PlanId is the canonical product-level
 *   identifier used by this module. planIdToAppTier() / appTierToPlanId() in
 *   plans.ts map between the two.
 */

// ─── Plan identifiers ─────────────────────────────────────────────────────────

/** Canonical plan IDs. Maps to display names in plans.ts. */
export type PlanId = 'core' | 'growth' | 'launch';

// ─── Setup offer identifiers ──────────────────────────────────────────────────

export type SetupOfferId = 'none' | 'growth_setup' | 'launch_setup';

// ─── Pilot status ─────────────────────────────────────────────────────────────

export type PilotStatus = 'active' | 'converted' | 'expired' | 'waived';

// ─── Feature keys ─────────────────────────────────────────────────────────────
// Add keys here as new gated features are introduced. Never remove a key
// that is referenced in production code — mark deprecated ones with a comment.

export type FeatureKey =
  | 'ai_analysis'
  | 'custom_verticals'
  | 'premium_pricing_rules'
  | 'payment_plans'
  | 'multi_user'
  | 'priority_support'
  | 'white_label'
  | 'api_access'
  | 'advanced_reporting';

// ─── Entitlements ─────────────────────────────────────────────────────────────

export interface PlanEntitlements {
  /** AI credits included per billing period. 0 = no AI included on plan. */
  aiCreditsPerPeriod: number;
  /** Maximum saved estimates. null = unlimited. */
  maxEstimates: number | null;
  /** Maximum team members (seats). null = unlimited. */
  maxTeamMembers: number | null;
  /** Set of feature keys this plan unlocks. */
  features: Set<FeatureKey>;
}

// ─── Plan definition ──────────────────────────────────────────────────────────

export interface PlanDefinition {
  id: PlanId;
  /** Canonical display name. Shell branding layer may override for UI rendering. */
  name: string;
  /** Monthly subscription price in USD cents (e.g. 9900 = $99/mo). */
  monthlyPrice: number;
  /** True if this plan should be highlighted as recommended in plan-picker UI. */
  recommended: boolean;
  /** Short tagline. Shell can override in branding config. */
  tagline: string;
  /** Which setup offer is bundled with this plan by default. */
  defaultSetupOfferId: SetupOfferId;
  entitlements: PlanEntitlements;
}

// ─── Setup offer ──────────────────────────────────────────────────────────────

export interface SetupOffer {
  id: SetupOfferId;
  name: string;
  /** One-time setup fee in USD cents. 0 = no setup fee. */
  oneTimeFee: number;
  /** Human-readable fee string for UI display (e.g. "$1,500+"). */
  feeDisplay: string;
  /** What is included. Shell may append product-specific items. */
  includes: string[];
}

// ─── Founding partner / pilot ─────────────────────────────────────────────────

export interface FoundingPartnerRecord {
  /** The user/org this pilot belongs to. */
  userId: string;
  /** Which plan they are piloting (anchors entitlements during pilot). */
  pilotPlanId: PlanId;
  /** Monthly retail value of the piloted plan (USD cents). Used for UI anchoring. */
  retailMonthlyPrice: number;
  /** Monthly fee actually charged during pilot. 0 = fully waived. */
  pilotMonthlyFee: number;
  /** Whether the one-time setup fee was waived for this partner. */
  setupFeeWaived: boolean;
  /** ISO timestamp when pilot started. */
  startedAt: string;
  /** ISO timestamp when pilot expires. null = open-ended. */
  expiresAt: string | null;
  status: PilotStatus;
  /** Internal ops notes. Never shown to the operator/user. */
  internalNotes?: string;
}

export interface PartnerConversionOffer {
  /** Plan being offered at conversion. */
  planId: PlanId;
  /** Locked-in monthly price (USD cents). May be less than current retail. */
  lockedMonthlyPrice: number;
  /** How long the locked price is guaranteed (months). null = permanent. */
  lockDurationMonths: number | null;
  /** ISO timestamp by which partner must convert to claim this offer. null = no deadline. */
  offerExpiresAt: string | null;
}
