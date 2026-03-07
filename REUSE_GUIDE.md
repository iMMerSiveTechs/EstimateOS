# EstimateOS — Reuse Guide

Internal dev doc for Phase 9 separation of concerns.
Last updated: 2026-03-07.

---

## Layer Architecture

EstimateOS has three conceptual layers. Code should live at the right layer.

### Layer 1 — Estimate OS Core (fully reusable, vertical-agnostic)

These modules have no Natural Origins or roofing-specific logic. They can be
packaged and reused in any future contractor app as-is.

| Module | Path | Notes |
|---|---|---|
| Pricing engine | `domain/pricingEngineV2.ts` | Pure deterministic logic, no React |
| Type system | `models/types.ts` | All shared interfaces |
| Customer storage | `storage/customers.ts` | Generic CRUD |
| Estimate storage | `storage/repository.ts` | Generic CRUD |
| Invoice storage | `storage/invoices.ts` | Generic CRUD |
| AI scan history | `storage/aiHistory.ts` | Generic, vertical-agnostic |
| AI credits | `storage/aiCredits.ts` | Generic |
| Workflow storage | `storage/workflow.ts` | Reminders, timeline, intake drafts |
| Comm templates storage | `storage/commTemplates.ts` | Generic structure; defaults are roofing-flavored |
| Media pipeline | `media/MediaJobQueue.ts` | Generic async queue |
| Media components | `media/MediaGrid.tsx`, `media/MediaItemCard.tsx` | Generic grid UI |
| Theme tokens | `theme/index.ts` | Visual language — swap for rebrand |
| ID generation | `domain/id.ts` | Utility |

### Layer 2 — Contractor Generic (reusable with minor configuration)

These modules encode patterns common to all field-service contractors.
They are not roofing-specific but may have Natural Origins defaults today.

| Module | Path | What to adapt |
|---|---|---|
| `IntakeScreen` | `screens/IntakeScreen.tsx` | `SERVICE_TYPES` array — swap for vertical |
| `OperationsDashboardScreen` | `screens/OperationsDashboardScreen.tsx` | Pipeline labels; quick-action destinations |
| `FollowUpPanel` | `components/FollowUpPanel.tsx` | No changes needed — fully generic |
| `ReminderSheet` | `components/ReminderSheet.tsx` | No changes needed |
| `CommReviewModal` | `components/CommReviewModal.tsx` | No changes needed |
| `CommTemplatesScreen` | `screens/CommTemplatesScreen.tsx` | Defaults seeded are roofing-worded |
| `OnboardingScreen` | `screens/OnboardingScreen.tsx` | Company info; vertical list; prefix defaults |
| `PricingSummaryCard` | `components/PricingSummaryCard.tsx` | Vertical-aware via `VerticalConfig` |
| `RuleBuilderModal` | `components/RuleBuilderModal.tsx` | Vertical-aware via `VerticalConfig` |

### Layer 3 — Natural Origins / Roofing Specific

These are branded, roofing-specific, or Natural Origins operational choices.
Do not pull these into the core layer.

| What | Where | Notes |
|---|---|---|
| Roofing verticals config | `config/verticals.ts` | `ROOFING_VERTICAL`, `ALL_VERTICALS` |
| Roofing intake questions | Defined inside `config/verticals.ts` | Specific to roof types |
| Roofing pricing rules | Defined inside `config/verticals.ts` | Flat fee, per-square, conditionals |
| Default comm templates (body text) | `storage/commTemplates.ts → DEFAULT_COMM_TEMPLATES` | Copy is roofing-voiced |
| Default intake service types | `screens/IntakeScreen.tsx → SERVICE_TYPES` | Roofing job types |
| Natural Origins business profile | `storage/settings.ts` (company name, logo, etc.) | Per-install config |
| Natural Origins branding | `theme/index.ts` colors, `assets/` | Swap color tokens for rebrand |

---

## What Is Reusable Now (Phase 9 output)

The following can be taken and used in a new contractor app with minimal changes:

- **Entire pricing engine** — just wire up `VerticalConfig` + `IntakeQuestion` arrays for the new vertical
- **Customer → Estimate → Invoice lifecycle** — all storage + screens are vertical-agnostic
- **Follow-up workflow** — `FollowUpPanel`, `ReminderSheet`, `CommReviewModal`, `storage/workflow.ts`
- **Intake flow** — swap `SERVICE_TYPES` constant in `IntakeScreen.tsx`
- **Ops dashboard** — works with any set of estimates/invoices/customers/reminders
- **Communication templates** — replace `DEFAULT_COMM_TEMPLATES` body text for new vertical's voice
- **Onboarding** — swap vertical list; everything else is generic business profile setup
- **Media pipeline** — fully generic

---

## What Is Still Roofing-Specific

- `config/verticals.ts` — all pricing rules, intake questions, and service definitions are roofing
- Default comm template body text (roofing language) — easy to override per install
- `IntakeScreen.tsx → SERVICE_TYPES` — currently hard-coded to roofing jobs
- Any Natural Origins branding in settings/assets

---

## What Still Needs Adaptation for Another Vertical

1. **`config/verticals.ts`** — add a new `VerticalConfig` object with services, pricing rules, and intake questions for the new vertical (e.g., HVAC, landscaping)
2. **`IntakeScreen.tsx → SERVICE_TYPES`** — parameterize this via vertical config or a screen prop
3. **Comm template defaults** — create a vertical-specific set of `DEFAULT_COMM_TEMPLATES` (or let each install seed its own)
4. **Business profile** — update `settings.ts` for new company name, logo, license info
5. **`OnboardingScreen.tsx → VERTICALS`** — add the new vertical with `available: true`

---

## What Must Be Done Before Real Multi-Company / Standalone Estimate OS Launch

Phase 10 lays groundwork. The following are still required before a true multi-company launch:

1. **Auth + workspace scoping** — move Firestore paths from `users/{uid}/...` to `workspaces/{workspaceId}/...`; current single-user path works fine for now
2. **Billing / subscription layer** — credits, plan limits, feature gating
3. **Invite flow** — add team members to a workspace
4. **AI backend integration** — replace Phase 0 demo in `AiSiteAnalysisScreen` with real API call
5. **Per-workspace vertical config** — let admins create/edit their own vertical config in-app
6. **Onboarding wire-up** — integrate `OnboardingScreen` into the root navigator with the `isOnboardingComplete()` gate
7. **Comm delivery** — templates currently copy/share only; real SMS/email delivery (Twilio, SendGrid) would be added as an optional backend

---

## Natural Origins Remains the Proving Ground

> Do not extract layers into separate npm packages or repos until Natural Origins
> has validated them through real operational use. Premature packaging adds
> maintenance cost without proven benefit.

Once a module is stable and unchanged through 3+ operational phases, it is a
good candidate for extraction.
