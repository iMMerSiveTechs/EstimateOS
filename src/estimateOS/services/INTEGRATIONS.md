# EstimateOS — Integration Map

Developer reference for all provider seams, their current status, and what is needed to wire live providers.

---

## Architecture

All external provider interactions go through `services/`:

```
services/
├── index.ts              ← Barrel exports
├── ServiceResult.ts      ← Standardized response shape for all seams
├── capabilities.ts       ← Centralized integration readiness queries
├── aiProvider.ts          ← AI analysis provider boundary
├── mapsProvider.ts        ← Maps / location provider boundary
├── paymentProvider.ts     ← Service payment provider boundary (customer pays for work)
├── appMonetization.ts     ← App monetization boundary (operator pays for software)
├── commProvider.ts        ← Communication provider boundary (email, SMS)
└── INTEGRATIONS.md        ← This file
```

**Rules:**
- Screens never import provider SDKs directly.
- Screens call `services/*` functions and render based on `ServiceResult.status`.
- All results use the `ServiceResult<T>` shape (see `ServiceResult.ts`).
- Capabilities are read from `capabilities.ts`, not hardcoded booleans.

---

## ServiceResult Statuses

| Status | Meaning | Screen behavior |
|--------|---------|-----------------|
| `success` | Provider call succeeded | Show data |
| `partial_success` | Some items succeeded | Show data + warning |
| `blocked_not_configured` | Provider not set up | Show setup CTA |
| `blocked_not_enabled` | Feature toggled off | Show "enable in Settings" |
| `offline` | Device is offline | Show retry prompt |
| `validation_error` | Bad input | Show field errors |
| `provider_error` | Provider returned error | Show error message |
| `stub_mode` | No live provider, demo mode | Show stub notice |

---

## Provider Seams

### A. AI Provider (`aiProvider.ts`)

| Aspect | Status | Notes |
|--------|--------|-------|
| Site/media analysis | **Stubbed** | `runAiAnalysis()` returns stub when Gemini not configured |
| AI chat/assistant | **Not started** | Future module, same provider boundary |
| Confidence mapping | **Ready** | `mapConfidence()`, `countLowConfidence()` work locally |
| Error classification | **Ready** | `classifyAiError()` in `domain/aiGuard.ts` |
| Credit gating | **Ready** | `checkAiAccess()` in `domain/aiGuard.ts` |

**To connect a live provider:**
1. Replace `callProvider()` body in `aiProvider.ts`
2. Map provider response to `SuggestedAdjustment[]`
3. Ensure `creditsUsed` is populated correctly
4. Set `integrations.gemini = true` in settings

**Settings required:** `integrations.gemini`, `integrations.stripePublishableKey` (for billing)

---

### B. Maps / Location Provider (`mapsProvider.ts`)

| Aspect | Status | Notes |
|--------|--------|-------|
| Place search | **Stubbed** | Returns `stub_mode` |
| Geocoding | **Stubbed** | Returns `stub_mode` |
| Service area check | **Graceful fallback** | Returns `isInArea: true` when not configured |
| Grounding detector | **Ready** | `needsMapGrounding()` is purely local, no API needed |

**To connect Google Maps:**
1. Replace `searchPlaces()` body — call Places API
2. Replace `geocodeAddress()` body — call Geocoding API
3. Replace `checkServiceArea()` body — Distance Matrix or haversine
4. Set `integrations.googleMaps = true` + `integrations.googleMapsApiKey`

**Settings required:** `integrations.googleMaps`, `integrations.googleMapsApiKey`

---

### C. Service Payment Provider (`paymentProvider.ts`)

| Aspect | Status | Notes |
|--------|--------|-------|
| Online checkout (Stripe) | **Stubbed** | Returns `stub_mode` |
| Manual payment recording | **Fully working** | Local-first, no provider needed |
| Payment plan stage marking | **Fully working** | Local-first |
| Invoice payment events | **Fully working** | Via `createInvoicePaymentEvent()` |
| Checkout availability check | **Ready** | `isCheckoutAvailable()` queries capabilities |

**To connect Stripe:**
1. Replace `initiateCheckout()` body — create PaymentIntent, show payment sheet
2. Set `integrations.stripeEnabled = true` + `integrations.stripePublishableKey`
3. Handle webhooks on backend for payment confirmation

**Settings required:** `integrations.stripeEnabled`, `integrations.stripePublishableKey`

**Separation:** Service payments (customer pays for roofing) are structurally separate from app monetization (operator pays for software).

---

### D. App Monetization Provider (`appMonetization.ts`)

| Aspect | Status | Notes |
|--------|--------|-------|
| Subscription state | **Free tier default** | Returns free tier with all basic features |
| Feature entitlements | **Ready** | `isEntitled()` checks subscription status |
| Credit purchase | **Delegates** | Calls `storage/aiCredits.purchaseCredits()` |

**To connect RevenueCat / IAP:**
1. Replace `getSubscriptionStatus()` — query RevenueCat
2. Map provider plan IDs to `AppPlanTier`
3. Cache subscription locally for offline access
4. Wire `purchaseAiCredits()` to IAP flow

**Settings required:** Provider SDK initialization (RevenueCat API key)

---

### E. Communication Provider (`commProvider.ts`)

| Aspect | Status | Notes |
|--------|--------|-------|
| Email send | **Local only** | Uses `expo-mail-composer` or Share API |
| SMS send | **Local only** | Opens native messaging via Share API |
| Push notifications | **Not available** | Returns `stub_mode` |

**To connect SendGrid / Twilio:**
1. Replace `sendEmail()` non-composer branch — call SendGrid API
2. Replace `sendSms()` — call Twilio API
3. Add push notification via FCM/APNs

**Settings required:** Provider API keys (not yet in `IntegrationSettings`)

---

### F. Cloud Sync (Firebase)

| Aspect | Status | Notes |
|--------|--------|-------|
| Firestore persistence | **Production** | All storage modules use Firestore |
| Firebase Auth | **Production** | `auth/AuthContext.tsx` |
| Firebase Storage (media) | **Production** | `media/MediaUploadService.ts` |
| Cloud Functions | **Not yet used** | Available for backend operations |

**Local-first guarantee:** All data writes go to Firestore, which has offline persistence. Core workflows work without network.

---

## Capabilities Module (`capabilities.ts`)

Screens query integration readiness via:

```typescript
import { deriveCapabilities } from '../services/capabilities';

const caps = deriveCapabilities(settings);
// caps.aiAnalysis        — boolean
// caps.aiProviderReady   — boolean
// caps.mapsReady         — boolean
// caps.servicePaymentsReady — boolean
// caps.cloudSyncEnabled  — boolean
```

Or async convenience:

```typescript
import { isStripeReady, isMapsReady, isAiProviderReady } from '../services/capabilities';
```

---

## What Remains to Wire

| Integration | What's needed | Priority |
|-------------|--------------|----------|
| AI provider (Gemini) | Replace `callProvider()` in `aiProvider.ts` | High |
| Stripe (service payments) | Replace `initiateCheckout()` in `paymentProvider.ts` | High |
| Stripe (AI credits) | Already delegated via `purchaseCredits()` — needs SDK wiring | High |
| Google Maps | Replace stubs in `mapsProvider.ts` | Medium |
| SendGrid / email | Replace `sendEmail()` in `commProvider.ts` | Medium |
| Twilio / SMS | Replace `sendSms()` in `commProvider.ts` | Low |
| RevenueCat / IAP | Replace `getSubscriptionStatus()` in `appMonetization.ts` | Low |
| Push notifications | Add FCM/APNs in `commProvider.ts` | Low |

---

## Areas Still Tightly Coupled

1. **Firebase is deeply integrated** — all storage modules import `firebase/config` directly. This is acceptable since Firebase provides offline persistence, but if a non-Firebase backend were needed, storage modules would require adaptor wrappers.

2. **`expo-mail-composer`** is `require()`d dynamically in both `commProvider.ts` and `ReviewSendScreen.tsx`. Future cleanup: `ReviewSendScreen` should call `commProvider.sendComm()` instead of owning its own composer logic.

3. **CreditPurchaseModal** still receives `stripeEnabled` as a prop. The modal itself could query capabilities internally, but the prop pattern is acceptable since it allows the parent to pass a pre-loaded value.
