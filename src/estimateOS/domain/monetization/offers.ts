/**
 * monetization/offers.ts
 *
 * Setup offer catalog.
 * All prices in USD cents.
 *
 * Setup offers are one-time onboarding packages sold alongside a plan.
 * They are separate from recurring subscription pricing.
 */

import { PlanId, SetupOffer, SetupOfferId } from './types';
import { PLANS } from './plans';

// ─── Offer catalog ────────────────────────────────────────────────────────────

export const SETUP_OFFERS: Record<SetupOfferId, SetupOffer> = {
  none: {
    id: 'none',
    name: 'No Setup',
    oneTimeFee: 0,
    feeDisplay: '$0',
    includes: [],
  },

  growth_setup: {
    id: 'growth_setup',
    name: 'Guided Setup',
    oneTimeFee: 50000,    // $500
    feeDisplay: '$500',
    includes: [
      'Vertical and pricing configuration',
      'Intake question build-out',
      'Onboarding call (1 hr)',
      'PDF estimate template setup',
    ],
  },

  launch_setup: {
    id: 'launch_setup',
    name: 'Full Build',
    oneTimeFee: 150000,   // $1,500 minimum; actual may be higher per scope
    feeDisplay: '$1,500+',
    includes: [
      'Custom brand identity application',
      'Full vertical and rule configuration',
      'White-label domain and app icon',
      'Team onboarding (up to 3 sessions)',
      'PDF + proposal template design',
      'Priority Slack channel (90 days)',
    ],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getSetupOffer(id: SetupOfferId): SetupOffer {
  return SETUP_OFFERS[id];
}

/** Returns the default setup offer bundled with a given plan. */
export function getSetupOfferForPlan(planId: PlanId): SetupOffer {
  return SETUP_OFFERS[PLANS[planId].defaultSetupOfferId];
}

/** Returns all offers that carry a non-zero fee (i.e. exclude 'none'). */
export function getPaidSetupOffers(): SetupOffer[] {
  return Object.values(SETUP_OFFERS).filter(o => o.oneTimeFee > 0);
}

/**
 * Returns the combined first-month cost for a plan + its default setup offer.
 * Useful for displaying total upfront commitment in pricing UI.
 */
export function firstMonthTotal(planId: PlanId): number {
  const plan = PLANS[planId];
  const setup = SETUP_OFFERS[plan.defaultSetupOfferId];
  return plan.monthlyPrice + setup.oneTimeFee;
}
