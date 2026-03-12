/**
 * monetization/plans.ts
 *
 * Canonical plan definitions for EstimateOS.
 * All prices in USD cents.
 *
 * To adapt for a different shell:
 *   - Override `name` / `tagline` in the shell's branding config layer.
 *   - Do NOT change plan IDs, price values, or entitlement shapes here.
 *   - Add new FeatureKeys to types.ts before referencing them in entitlements.
 */

import { AppPlanTier } from '../../models/types';
import { PlanDefinition, PlanId } from './types';

// ─── Plan catalog ─────────────────────────────────────────────────────────────

export const PLANS: Record<PlanId, PlanDefinition> = {
  core: {
    id: 'core',
    name: 'Self-Serve Core',
    monthlyPrice: 9900,     // $99/mo
    recommended: false,
    tagline: 'Everything you need to run estimates on your own.',
    defaultSetupOfferId: 'none',
    entitlements: {
      aiCreditsPerPeriod: 10,
      maxEstimates: null,
      maxTeamMembers: 1,
      features: new Set([
        'ai_analysis',
        'custom_verticals',
        'premium_pricing_rules',
      ]),
    },
  },

  growth: {
    id: 'growth',
    name: 'Guided Growth',
    monthlyPrice: 14900,    // $149/mo
    recommended: true,
    tagline: 'Onboarded, configured, and ready to bill from day one.',
    defaultSetupOfferId: 'growth_setup',
    entitlements: {
      aiCreditsPerPeriod: 30,
      maxEstimates: null,
      maxTeamMembers: 3,
      features: new Set([
        'ai_analysis',
        'custom_verticals',
        'premium_pricing_rules',
        'payment_plans',
        'priority_support',
        'advanced_reporting',
      ]),
    },
  },

  launch: {
    id: 'launch',
    name: 'Branded Launch',
    monthlyPrice: 24900,    // $249/mo
    recommended: false,
    tagline: 'Full white-glove build, your brand, your workflows.',
    defaultSetupOfferId: 'launch_setup',
    entitlements: {
      aiCreditsPerPeriod: 100,
      maxEstimates: null,
      maxTeamMembers: null,
      features: new Set([
        'ai_analysis',
        'custom_verticals',
        'premium_pricing_rules',
        'payment_plans',
        'multi_user',
        'priority_support',
        'white_label',
        'api_access',
        'advanced_reporting',
      ]),
    },
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getPlan(id: PlanId): PlanDefinition {
  return PLANS[id];
}

export function getDefaultPlan(): PlanDefinition {
  return PLANS.growth;
}

export function getAllPlans(): PlanDefinition[] {
  return [PLANS.core, PLANS.growth, PLANS.launch];
}

/**
 * Maps a canonical PlanId to the legacy AppPlanTier used by
 * AppSubscriptionStatus in models/types.ts.
 * Use this when writing to storage or calling existing code that expects AppPlanTier.
 */
export function planIdToAppTier(id: PlanId): AppPlanTier {
  const map: Record<PlanId, AppPlanTier> = {
    core:   'starter',
    growth: 'pro',
    launch: 'enterprise',
  };
  return map[id];
}

/**
 * Reverse mapping: reads a stored AppPlanTier and returns the nearest PlanId.
 * Returns null for 'free' (no active paid plan).
 */
export function appTierToPlanId(tier: AppPlanTier): PlanId | null {
  const map: Partial<Record<AppPlanTier, PlanId>> = {
    starter:    'core',
    pro:        'growth',
    enterprise: 'launch',
  };
  return map[tier] ?? null;
}
