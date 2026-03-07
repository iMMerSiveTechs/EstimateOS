/**
 * services/capabilities.ts — Centralized integration capability queries.
 *
 * Screens should never hardcode `stripeEnabled={false}` or check for API keys
 * directly. Instead, import these helpers.
 *
 * All capability queries are synchronous when given an AppSettings object,
 * or async when they need to fetch settings from storage.
 */

import { AppSettings, IntegrationSettings, AiFeatureSettings } from '../models/types';
import { getSettings } from '../storage/settings';

// ─── Capability flags (from a known settings object) ────────────────────────

export interface IntegrationCapabilities {
  /** AI image/site analysis is enabled in feature settings. */
  aiAnalysis: boolean;
  /** AI provider is ready (Gemini key configured or equivalent). */
  aiProviderReady: boolean;
  /** Google Maps grounding is enabled and has an API key. */
  mapsReady: boolean;
  /** Stripe billing for AI credits / service payments is live. */
  servicePaymentsReady: boolean;
  /** Cloud sync (Firebase) is enabled. */
  cloudSyncEnabled: boolean;
  /** Voice input available. */
  voiceInputReady: boolean;
  /** AI image creation available. */
  imageCreationReady: boolean;
  /** AI chatbot available. */
  chatbotReady: boolean;
  /** Video understanding available. */
  videoUnderstandingReady: boolean;
}

/** Derive capabilities from a loaded AppSettings object. */
export function deriveCapabilities(settings: AppSettings): IntegrationCapabilities {
  const int = settings.integrations;
  const ai  = settings.aiFeatures;
  return {
    aiAnalysis:             ai.analyzeImages,
    aiProviderReady:        int.gemini && !!int.stripePublishableKey,  // Gemini on + billing key
    mapsReady:              int.googleMaps && !!int.googleMapsApiKey,
    servicePaymentsReady:   int.stripeEnabled && !!int.stripePublishableKey,
    cloudSyncEnabled:       int.cloudSync,
    voiceInputReady:        int.voiceInput,
    imageCreationReady:     int.imageCreation,
    chatbotReady:           ai.chatbot,
    videoUnderstandingReady:ai.videoUnderstanding,
  };
}

/** Fetch settings and derive capabilities in one call (async convenience). */
export async function getCapabilities(): Promise<IntegrationCapabilities> {
  const settings = await getSettings();
  return deriveCapabilities(settings);
}

// ─── Individual capability queries (async) ──────────────────────────────────
// These are convenience functions for code that only needs one check.

export async function isStripeReady(): Promise<boolean> {
  const settings = await getSettings();
  return settings.integrations.stripeEnabled && !!settings.integrations.stripePublishableKey;
}

export async function isMapsReady(): Promise<boolean> {
  const settings = await getSettings();
  return settings.integrations.googleMaps && !!settings.integrations.googleMapsApiKey;
}

export async function isAiProviderReady(): Promise<boolean> {
  const settings = await getSettings();
  return settings.integrations.gemini;
}
