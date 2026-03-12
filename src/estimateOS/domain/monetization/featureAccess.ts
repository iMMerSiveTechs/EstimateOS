/**
 * monetization/featureAccess.ts
 *
 * Feature gate helpers. Pure functions — no side effects, no I/O.
 *
 * These are the canonical entry points for checking plan entitlements
 * throughout the app. Import from here, not from plans.ts directly, so
 * gate logic stays centralized and testable.
 */

import { FeatureKey, PlanEntitlements, PlanId } from './types';
import { PLANS } from './plans';

// ─── Plan order (ascending capability) ───────────────────────────────────────
// Used for minimum-plan comparisons. Must stay in sync with PlanId definition.
const PLAN_ORDER: PlanId[] = ['core', 'growth', 'launch'];

// ─── Entitlement access ───────────────────────────────────────────────────────

/** Returns the full entitlements object for a plan. */
export function getEntitlements(planId: PlanId): PlanEntitlements {
  return PLANS[planId].entitlements;
}

/** Returns true if the given plan grants access to the feature. */
export function canAccess(feature: FeatureKey, planId: PlanId): boolean {
  return PLANS[planId].entitlements.features.has(feature);
}

/**
 * Returns the lowest PlanId that includes the feature.
 * Returns null if the feature is not available on any plan (edge case).
 */
export function minimumPlanFor(feature: FeatureKey): PlanId | null {
  for (const planId of PLAN_ORDER) {
    if (PLANS[planId].entitlements.features.has(feature)) return planId;
  }
  return null;
}

/**
 * Returns true if currentPlanId is at or above the requiredPlanId tier.
 * Use for upgrade prompts: meetsMinimumPlan(user.planId, 'growth').
 */
export function meetsMinimumPlan(currentPlanId: PlanId, requiredPlanId: PlanId): boolean {
  return PLAN_ORDER.indexOf(currentPlanId) >= PLAN_ORDER.indexOf(requiredPlanId);
}

/**
 * Returns denial context for upsell messaging, or null if access is granted.
 *
 * Example usage:
 *   const denied = getAccessDeniedReason('white_label', user.planId);
 *   if (denied) showUpsellSheet(denied.requiredPlanName);
 */
export function getAccessDeniedReason(
  feature: FeatureKey,
  currentPlanId: PlanId,
): { requiredPlanId: PlanId; requiredPlanName: string } | null {
  if (canAccess(feature, currentPlanId)) return null;
  const required = minimumPlanFor(feature);
  if (!required) return null; // feature not on any plan
  return {
    requiredPlanId:   required,
    requiredPlanName: PLANS[required].name,
  };
}

// ─── Quota helpers ────────────────────────────────────────────────────────────

/**
 * Returns true if the operator is within their estimate quota.
 * Always returns true when the plan has no limit (maxEstimates = null).
 */
export function isWithinEstimateLimit(currentCount: number, planId: PlanId): boolean {
  const max = PLANS[planId].entitlements.maxEstimates;
  return max === null || currentCount < max;
}

/**
 * Returns true if the operator is within their team member quota.
 * Always returns true when the plan has no limit (maxTeamMembers = null).
 */
export function isWithinTeamLimit(currentCount: number, planId: PlanId): boolean {
  const max = PLANS[planId].entitlements.maxTeamMembers;
  return max === null || currentCount < max;
}

/**
 * Returns how many AI credits remain given a usage count.
 * Returns null if the plan includes no AI credits.
 */
export function aiCreditsRemaining(usedCount: number, planId: PlanId): number | null {
  const included = PLANS[planId].entitlements.aiCreditsPerPeriod;
  if (included === 0) return null;
  return Math.max(0, included - usedCount);
}

/**
 * Returns true if the operator has AI credits remaining for this period.
 * Returns false when the plan includes no AI (aiCreditsPerPeriod = 0).
 */
export function hasAiCredits(usedCount: number, planId: PlanId): boolean {
  const remaining = aiCreditsRemaining(usedCount, planId);
  return remaining !== null && remaining > 0;
}
