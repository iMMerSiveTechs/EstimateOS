/**
 * services/appMonetization.ts — App monetization provider adaptor boundary.
 *
 * Handles the business operator's subscription to EstimateOS software features.
 * Completely separate from service payments (see paymentProvider.ts).
 *
 * Responsibilities:
 *   - Subscription state (free / starter / pro / enterprise)
 *   - Feature entitlements (max estimates, custom verticals, payment plans)
 *   - AI credit purchase flow (Stripe / IAP)
 *
 * When RevenueCat / App Store IAP is connected, replace the stubs.
 * Currently returns free-tier defaults so the app works without a provider.
 */

import { AppSubscriptionStatus, AppPlanTier } from '../models/types';
import { ServiceResult, ok, stubMode } from './ServiceResult';
import { isStripeReady } from './capabilities';
import { purchaseCredits as storagePurchaseCredits, PurchaseResult } from '../storage/aiCredits';

// ─── Default subscription (free tier, fully functional) ─────────────────────

const FREE_TIER: AppSubscriptionStatus = {
  tier: 'free',
  state: 'active',
  aiCreditsIncluded: 0,
  premiumPricingRules: false,
  customVerticals: true,        // allow custom verticals on free tier
  paymentPlans: false,
  prioritySupport: false,
};

/**
 * Get current subscription status.
 * Returns free-tier defaults when no provider is connected.
 */
export async function getSubscriptionStatus(): Promise<ServiceResult<AppSubscriptionStatus>> {
  // TODO: When RevenueCat / provider is connected:
  //   1. Query provider for current subscription state
  //   2. Map provider plan ID to AppPlanTier
  //   3. Derive entitlements
  //   4. Cache locally for offline access
  return ok(FREE_TIER);
}

/**
 * Check if a specific feature is entitled for the current subscription.
 * Convenience function so screens don't inspect the full subscription object.
 */
export async function isEntitled(feature: keyof Pick<
  AppSubscriptionStatus,
  'premiumPricingRules' | 'customVerticals' | 'paymentPlans' | 'prioritySupport'
>): Promise<boolean> {
  const result = await getSubscriptionStatus();
  if (result.status !== 'success' || !result.data) return false;
  return !!result.data[feature];
}

/**
 * Purchase AI credits.
 * Delegates to the existing storage/aiCredits purchase flow,
 * but reads Stripe readiness from the capabilities module.
 */
export async function purchaseAiCredits(
  packId: string,
): Promise<ServiceResult<{ creditsAdded: number; newBalance: number }>> {
  const stripeReady = await isStripeReady();
  const result: PurchaseResult = await storagePurchaseCredits(packId, stripeReady);

  if (result.success) {
    return ok({ creditsAdded: result.creditsAdded, newBalance: result.newBalance });
  }

  if (result.errorType === 'billing_not_configured') {
    return stubMode(result.message);
  }

  return { status: 'provider_error', message: result.message, errorCode: result.errorType };
}
