/**
 * services/mapsProvider.ts — Maps / location provider adaptor boundary.
 *
 * Provides clean interfaces for:
 *   - Place/address lookup
 *   - Service area logic
 *   - Supplier/material source lookup
 *   - Location grounding for AI prompts
 *
 * Currently returns stub results. When Google Maps (or another provider) is
 * connected, replace the stub implementations without touching screens.
 */

import { ServiceResult, ok, blocked, stubMode, providerError, offline } from './ServiceResult';
import { isMapsReady } from './capabilities';
import { shouldUseMapGrounding, MAPS_GROUNDING_HINT } from '../domain/aiGuard';

// ─── Provider interface types ───────────────────────────────────────────────

export interface PlaceResult {
  placeId: string;
  name: string;
  address: string;
  lat?: number;
  lng?: number;
  phone?: string;
  rating?: number;
  types?: string[];             // e.g. ['roofing_supply', 'store']
}

export interface GeocodingResult {
  formattedAddress: string;
  lat: number;
  lng: number;
  city?: string;
  state?: string;
  zip?: string;
  county?: string;
}

export interface ServiceAreaCheckResult {
  isInArea: boolean;
  distanceMiles?: number;
  message: string;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Search for nearby places (suppliers, stores, etc.)
 * Screens call this; never directly call Google Maps SDK.
 */
export async function searchPlaces(
  query: string,
  _location?: { lat: number; lng: number },
): Promise<ServiceResult<PlaceResult[]>> {
  const ready = await isMapsReady();
  if (!ready) {
    return stubMode('Maps is not configured. Enable Google Maps in Settings → Integrations.');
  }

  // TODO: Wire Google Places API here.
  // Expected flow:
  //   1. Use googleMapsApiKey from settings
  //   2. Call Places Nearby or Text Search
  //   3. Map results to PlaceResult[]
  return stubMode('Maps provider not yet connected.');
}

/**
 * Geocode an address string to lat/lng.
 */
export async function geocodeAddress(
  address: string,
): Promise<ServiceResult<GeocodingResult>> {
  const ready = await isMapsReady();
  if (!ready) {
    return stubMode('Maps is not configured. Enable Google Maps in Settings → Integrations.');
  }

  // TODO: Wire Google Geocoding API here.
  return stubMode('Geocoding not yet connected.');
}

/**
 * Check if a job address is within the operator's service area.
 */
export async function checkServiceArea(
  _jobAddress: string,
  _businessAddress: string,
  _maxMiles: number = 50,
): Promise<ServiceResult<ServiceAreaCheckResult>> {
  const ready = await isMapsReady();
  if (!ready) {
    // Graceful fallback: assume in-area when maps is not configured
    return ok({
      isInArea: true,
      message: 'Service area check skipped — Maps not configured.',
    });
  }

  // TODO: Wire Distance Matrix or Geocoding + haversine here.
  return ok({
    isInArea: true,
    message: 'Service area check not yet connected to provider.',
  });
}

/**
 * Check whether a user prompt should trigger map grounding.
 * This is a pure local check (no provider needed).
 */
export function needsMapGrounding(prompt: string): boolean {
  return shouldUseMapGrounding(prompt);
}

export { MAPS_GROUNDING_HINT };
