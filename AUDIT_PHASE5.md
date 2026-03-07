# EstimateOS — Phase 3.5 / 4 / 5 Audit Note

_Internal developer reference. Updated: 2026-03-07_

---

## Phase 3.5 — Stabilization Fixes

### Files Changed
| File | Fix |
|---|---|
| `models/types.ts` | Added canonical `AiAnalysisRecord`, `SuggestedAdjustment`, `AiFailureType` — eliminates shape drift between screen and storage |
| `storage/aiHistory.ts` | Fixed Firestore Timestamp deserialization — `createdAt` is now reliably an ISO string |
| `screens/AiSiteAnalysisScreen.tsx` | Fixed broken imports: `AiAnalysisRecord`/`SuggestedAdjustment` now from `models/types`, not `aiCredits` |
| `components/PricingSummaryCard.tsx` | Manual line items now accept negative values (discounts/credits); removed `Math.max(0,...)` clamp on display totals |
| `domain/pricingEngineV2.ts` | Manual items no longer clamped to 0; variance band no longer clamps result to 0 |

### Smoke Test Checklist
- [x] Create estimate → Save Draft → Reload draft: answers and customer preserved
- [x] AI history shape: `AiScanRecord` fields (`createdAt`, `summary`, `answersSnapshot`, `evidenceByQuestion`) all present and typed
- [x] Negative discount line item: accepted, reflected in total range (can go below base)
- [x] No NaN in pricing output: `isFinite()` guards on all manual item values
- [x] AI history write: `appendAiHistory()` uses canonical `AiScanRecord` shape

### Remaining Risks (Pre-Phase 4 Blockers)
- **Phase 0 demo only**: No real AI backend; `runAnalysis()` shows DemoModal. Phase 2 requires replacing `DemoModal` with real API call.
- **AI history read may return stale data** if Firestore rules don't allow subcollection read for `aiHistory/{estimateId}/records`. Verify Firestore security rules.
- **`getAnalysisHistory()` in aiCredits returns `AnalysisRecord[]`**, not `AiAnalysisRecord[]`. These are two different shapes — `AnalysisRecord` is the billing log, `AiAnalysisRecord` is the in-session working record. The screen currently casts `history` as `AiAnalysisRecord[]` from `getAnalysisHistory()`. **This will need to be aligned in Phase 2** when real AI results are stored.

---

## Phase 4 — AI Credits + Billing + Smart Grounding + AI Reliability

### Files Changed / Created
| File | Change |
|---|---|
| `models/types.ts` | Added `AiCreditPack`, `AI_CREDIT_PACKS`, `AutoReloadSettings`, `AiCreditSettings`, `AiFailureType`, `SuggestedAdjustment`, `AiAnalysisRecord` |
| `storage/aiCredits.ts` | Added `getCreditSettings()`, `saveCreditSettings()`, `purchaseCredits()` (Stripe stub), `maybeAutoReload()` |
| `domain/aiGuard.ts` _(new)_ | Centralized access guard: `checkAiAccess()`, `classifyAiError()`, `AI_FAILURE_MESSAGES`, `shouldUseMapGrounding()` |
| `components/CreditPurchaseModal.tsx` _(new)_ | Full credit purchase UI with Stripe stub, auto-reload toggle, pack selection |
| `screens/SettingsScreen.tsx` | Added website field, credit status widget (green/amber/red), Buy Credits button → `CreditPurchaseModal`, Stripe Billing toggle |
| `screens/AiSiteAnalysisScreen.tsx` | Added `checkAiAccess()` guard, typed failure banner, retry with last media, Maps grounding hint |

### Credit Enforcement Points
1. `AiSiteAnalysisScreen.runAnalysis()` — calls `checkAiAccess()` before proceeding. Returns `showBuyCredits` when blocked.
2. `SettingsScreen` — displays credit status with visual indicator; gates AI if 0 credits.
3. `aiGuard.checkAiAccess()` — single function all AI features must call.

### Stripe Wiring
- **Location**: `storage/aiCredits.ts` → `purchaseCredits(packId, stripeEnabled)`
- **State**: Stub returns `billing_not_configured` when `stripeEnabled = false` (default).
- **What's needed to go live**: Wire `react-native-stripe-sdk` payment sheet; replace stub body with real payment intent flow; call `addCredits()` on success.
- **Clear label**: UI shows "Billing Setup Required" notice — never silently fakes a purchase.

### Maps Auto-Grounding
- **Location**: `domain/aiGuard.ts` → `shouldUseMapGrounding(prompt)`
- **Trigger**: Keyword matching on user focus prompt (nearby, supplier, local, etc.)
- **UI hint**: `MAPS_GROUNDING_HINT` (`"📍 Grounded with Google Maps"`) shown in `AiSiteAnalysisScreen` when triggered
- **Actual grounding**: Not yet implemented — requires real AI backend + `googleMapsApiKey` in integrations settings.

### AI Error States Mapped
All mapped in `domain/aiGuard.ts → AI_FAILURE_MESSAGES`:
- `missing_api_key` — AI provider not configured
- `provider_unavailable` — 500/503 from AI service
- `no_credits` — balance 0
- `offline` — network unavailable
- `timeout` — request timed out
- `unsupported_media` — wrong file type
- `oversized_media` — file too large
- `parse_failure` — AI returned unparseable response
- `invalid_site_photo` — image isn't a worksite
- `unknown` — fallback

### External Setup Still Required
- [ ] Stripe publishable key + backend payment intent endpoint
- [ ] Real AI backend (Gemini / OpenAI) wired to `runAnalysis()`
- [ ] Google Maps API key for location grounding
- [ ] Firestore security rules reviewed for `aiHistory` subcollections
- [ ] `purchaseCredits()` real implementation (react-native-stripe-sdk)

---

## Phase 5 — Platform Hardening + Org Readiness

### Files Changed
| File | Change |
|---|---|
| `models/types.ts` | Added `website` to `BusinessProfile`; added `InvoiceStatus` `void`; added `subtotal`, `discountAmount`, `taxAmount`, `totalAmount`, `termsFooterSnapshot`, `voidedAt`, `voidReason` to `Invoice`; added `OrgWorkspace` stub; added `SyncStatus`/`SyncState`; updated `IntegrationSettings` with `stripeEnabled`, `stripePublishableKey`, `googleMapsApiKey` |
| `storage/settings.ts` | Added `website` to `DEFAULT_SETTINGS.businessProfile`; added `stripeEnabled: false` to integrations defaults |
| `screens/SettingsScreen.tsx` | Added Website field in Business Profile; Stripe Billing toggle |
| `screens/InvoiceScreen.tsx` | Added `void` status badge; voidedAt display; Void Invoice action button |

### Contract Alignment Status
| Area | Status | Notes |
|---|---|---|
| Estimate ↔ EstimateRepository | ✅ Aligned | Single canonical `Estimate` type; Firestore merge upsert |
| AI history ↔ AiScanRecord | ✅ Fixed (Phase 3.5) | Timestamp deserialization added |
| AiAnalysisRecord (working) | ✅ Canonical | Now in `models/types.ts` |
| Invoice ↔ InvoiceRepository | ✅ Aligned | `void` status added |
| BusinessProfile ↔ SettingsScreen | ✅ Aligned | `website` field added to both |
| Credits ↔ AiCreditsStorage | ✅ Aligned | `AiCreditSettings` canonical type |
| PricingSummaryCard ↔ LineItem | ✅ Fixed | Negative values supported |
| Pricing engine manual items | ✅ Fixed | No longer clamped to 0 |

### Org Readiness
- `OrgWorkspace` type stub added to `models/types.ts` — includes `workspaceId`, `workspaceName`, `userRole`, `ownerUid`
- Currently unused; ready to be wired when multi-company features are needed
- `UserRole` type: `owner | admin | estimator | viewer`

### Sync State
- `SyncStatus` / `SyncState` types added to `models/types.ts`
- States: `saved_local | syncing | synced | sync_failed`
- Currently no UI wired — see "Remaining" below

### Business Profile Persistence
- Full profile (name, phone, email, address, **website**, terms, logo URI) persists to Firestore via `saveSettings()` / `saveBusinessProfile()`
- PDF generation and ReviewSendScreen should read from `getBusinessProfile()` — verify they do; no changes made here since they already use `getBusinessProfile()`

### Invoice Model
- Now has snapshot fields: `subtotal`, `discountAmount`, `taxAmount`, `totalAmount`, `termsFooterSnapshot`
- `void` status with `voidedAt` + `voidReason`
- `InvoiceScreen` computes totals locally (not from snapshot) — snapshots are for PDF/export use
- TODO: populate snapshot fields on invoice creation (in `EstimateDetailScreen` where invoices are created from estimates)

---

## What Is Ready for Natural Origins Internal Use
- [x] Estimate creation, draft save, reload, pricing engine
- [x] AI site media intake (Phase 1: MediaGrid fully wired)
- [x] AI analysis demo (Phase 0: DemoModal, no billing)
- [x] AI scan history with snapshot + revert
- [x] Negative discount line items
- [x] Customer picker (create, search, link, unlink)
- [x] Invoice lifecycle (draft → sent → paid → void)
- [x] Settings: business profile (incl. website), export prefixes
- [x] Credit status visible in Settings with Buy Credits entry point

## What Is Ready for Future Company Reuse
- [x] `OrgWorkspace` type stub (structural groundwork)
- [x] `UserRole` type
- [x] `SyncStatus` type
- [x] Firestore user-scoped collections (ready for `workspaceId` migration)
- [x] `checkAiAccess()` guard (shared across all AI features)
- [x] `AiCreditPack` / `AutoReloadSettings` types

## What Still Blocks Standalone Multi-Company Platform
- [ ] Replace uid() with workspaceId-scoped collection paths
- [ ] Authentication: role assignment at signup
- [ ] Billing: Stripe connected + subscription or per-workspace credit pools
- [ ] Real AI backend wired
- [ ] Sync state UI (saved_local / syncing / sync_failed indicators)
- [ ] Onboarding flow for new companies
- [ ] EstimateDetailScreen: populate invoice snapshot fields on create
- [ ] PDF generation tested end-to-end with business profile data
- [ ] Firestore security rules audit
