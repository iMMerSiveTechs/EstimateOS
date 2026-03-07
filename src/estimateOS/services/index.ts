/**
 * services/index.ts — Barrel export for all provider service boundaries.
 *
 * Import from '../services' to access any provider adaptor.
 */

// Standardized result shape
export { ServiceResult, ServiceStatus, ok, okVoid, partial, blocked, offline,
  validationError, providerError, stubMode, isOk, isBlocked } from './ServiceResult';

// Integration capabilities
export { IntegrationCapabilities, deriveCapabilities, getCapabilities,
  isStripeReady, isMapsReady, isAiProviderReady } from './capabilities';

// AI provider
export { runAiAnalysis, mapConfidence, countLowConfidence,
  AiAnalysisInput, AiAnalysisOutput } from './aiProvider';

// Maps / location provider
export { searchPlaces, geocodeAddress, checkServiceArea,
  needsMapGrounding, MAPS_GROUNDING_HINT,
  PlaceResult, GeocodingResult, ServiceAreaCheckResult } from './mapsProvider';

// Service payment provider (customer pays for roofing work)
export { initiateCheckout, recordManualPayment, createInvoicePaymentEvent,
  markStagePaid, isCheckoutAvailable,
  CheckoutInput, CheckoutOutput } from './paymentProvider';

// App monetization (business pays for software features)
export { getSubscriptionStatus, isEntitled, purchaseAiCredits } from './appMonetization';

// Communication provider
export { sendComm, getCommCapabilities,
  CommChannel, SendRequest, SendResult, CommCapabilities } from './commProvider';
