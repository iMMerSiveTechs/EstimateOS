# EstimateOS — CLAUDE.md

AI assistant guide for the EstimateOS codebase. Read this before making changes.

---

## Project Overview

**EstimateOS** is a React Native (Expo) mobile application for generating service/construction estimates. It combines a deterministic pricing engine with AI-powered site analysis via photo/video intake.

Primary use cases:
- Field operators capture site media and answer intake questions
- The pricing engine computes a low–high estimate range
- AI analysis (currently Phase 0/demo; backend not yet connected) pre-fills intake answers from photo/video evidence
- Operators can override individual price drivers or add manual line items

---

## Repository Layout

```
/EstimateOS
├── CLAUDE.md                          ← this file
├── src/
│   └── estimateOS/
│       ├── components/                # Shared UI components
│       │   ├── OverrideModal.tsx      # Per-driver price override sheet
│       │   ├── PricingSummaryCard.tsx # Live pricing panel
│       │   └── RuleBuilderModal.tsx   # 4-step wizard for adding pricing rules
│       ├── domain/
│       │   ├── pricingEngineV2.ts     # Core pricing logic (deterministic, cached)
│       │   └── id.ts                  # Unique ID generation (referenced, not in tree)
│       ├── media/
│       │   ├── MediaConstants.ts      # Upload limits and compression settings
│       │   ├── MediaGrid.tsx          # Photo/video grid UI
│       │   ├── MediaItemCard.tsx      # Individual media item card
│       │   ├── MediaJobQueue.ts       # Async processing queue (module-level state)
│       │   └── MediaPickerSheet.tsx   # Bottom sheet for media library access
│       ├── screens/
│       │   ├── AiSiteAnalysisScreen.tsx  # AI media intake + analysis (Phase 0/1)
│       │   └── NewEstimateScreen.tsx     # Estimate creation/editing screen
│       ├── config/
│       │   └── verticals.ts           # Built-in vertical configs (referenced)
│       ├── models/
│       │   └── types.ts               # All shared TypeScript interfaces/types
│       ├── storage/
│       │   ├── repository.ts          # EstimateRepository — CRUD for estimates
│       │   ├── aiHistory.ts           # AI scan history (AiScanRecord)
│       │   ├── aiCredits.ts           # Credit balance + analysis history
│       │   └── customVerticals.ts     # User-defined vertical storage
│       └── theme/
│           └── index.ts               # Design tokens: T, AI_D, radii, spacing
└── estimateos-updated.zip             # Archived snapshot (do not edit)
```

> **Note:** `config/`, `models/`, `storage/`, `theme/`, and `domain/id.ts` are referenced by imports but not present in the `src/estimateOS/` tree — they exist elsewhere in the broader Expo workspace that this source directory is part of.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Language | TypeScript (strict) |
| Framework | React Native via Expo |
| Navigation | `@react-navigation/native` |
| Image processing | `expo-image-manipulator` |
| Video thumbnails | `expo-video-thumbnails` |
| Media picker | `expo-image-picker` |
| State management | React hooks (`useState`, `useMemo`, `useCallback`, `useRef`) |
| Styling | `StyleSheet.create` (no external CSS library) |
| Animations | React Native `Animated` API |
| Persistence | Device storage via `EstimateRepository` (AsyncStorage or SQLite) |

---

## Architecture

### Layered Design

```
screens/          ← View layer. Route params in, navigation out.
components/       ← Reusable presentational components.
domain/           ← Pure business logic. No React, no I/O.
storage/          ← Data persistence adapters.
media/            ← Async media processing pipeline.
config/           ← Static vertical/service definitions.
models/types.ts   ← Shared TypeScript interfaces (single source of truth).
theme/            ← Design tokens (colors, radii, spacing).
```

### Key Design Patterns

**1. Deterministic Pricing Engine (`pricingEngineV2.ts`)**

Rules apply in a fixed order — never change this sequence:
1. `flat_fee` — always applies
2. `conditional_addon` — trigger match on answer
3. `per_unit` — numeric answer × rate (with optional cap)
4. `tiered` — band lookup on numeric answer
5. `adder` — legacy conditional
6. `multiplier` — scales the running subtotal last (always applied after all adds)

Key behaviors:
- All values clamped to `>= 0`, NaN coerced to 0.
- Prices rounded to nearest $5 (`round5`).
- Results cached in a module-level `Map` keyed by `serviceId|answersHash|overridesHash|manualHash` (max 20 entries, LRU eviction).
- Operator overrides (`DriverOverrideMap`) are immutable: use `applyOverride()` / `removeOverride()` / `clearOverrides()` — never mutate directly.

**2. Media Job Queue (`MediaJobQueue.ts`)**

Module-level singleton queue. Jobs progress through statuses: `queued → processing → ready | failed`.

- Photos: resized/compressed via `expo-image-manipulator` (max 1536px, quality 0.82).
- Videos: 10 frames extracted via `expo-video-thumbnails`.
- Processing is sequential to avoid memory pressure.
- Progress is simulated for responsive UX.
- Optional dependencies degrade gracefully.

**3. Vertical + Service Configuration**

`VerticalConfig` holds:
- `id`, `name`, `icon`, `currency`, `variancePct`
- `services[]` — each with `baseMin`/`baseMax` and `id`
- `pricingRules[]` — typed `PricingRule` objects
- `intakeQuestions[]` — typed `IntakeQuestion` objects
- `disclaimerText`

Custom verticals are stored separately and merged at runtime via `mergeVerticals(ALL_VERTICALS, custom)`.

**4. AI Analysis Phases**

| Phase | Status | Description |
|---|---|---|
| Phase 0 | Active | DemoModal — no billing, no history writes, simulated results |
| Phase 1 | Active | Production `MediaGrid` via `MediaJobQueue` fully wired |
| Phase 2+ | Planned | Real AI backend, credit deduction, production history writes |

When the AI backend is connected, replace `runAnalysis()` in `AiSiteAnalysisScreen` (currently shows `DemoModal`) with the real API call. The `applyToEstimate()` function is already production-ready.

---

## Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Components | PascalCase | `OverrideModal`, `MediaGrid` |
| Functions/hooks | camelCase | `computePricingV2`, `useToast` |
| Constants | UPPER_SNAKE_CASE | `MAX_PHOTOS`, `IMAGE_MAX_DIMENSION` |
| Private module state | underscore prefix | `_cache`, `_processing` |
| Styles object | `const s = StyleSheet.create({})` | short alias per file |
| AI metadata keys | `__ai_` prefix or `AI_META_PREFIX` constant | `questionId + '__ai_confidence'` |
| Driver IDs | `<type>_<index>` or `manual_<idx>` | `flat_fee_0`, `manual_3` |

---

## Type System

All shared types live in `models/types.ts`. Key interfaces:

```typescript
VerticalConfig       // Top-level vertical definition
ServiceConfig        // Service within a vertical
PricingRule          // One rule (type discriminated union)
IntakeQuestion       // A form question with type and options
Estimate             // The saved estimate record
PriceDriver          // A computed pricing line with override support
DriverOverrideMap    // Record<driverId, DriverOverride>
DriverOverride       // { driverId, min?, max?, disabled? }
BucketSummary        // Grouped subtotals by DriverBucket
LineItem             // Arbitrary manual line item
AiScanRecord         // History entry for an AI scan applied to an estimate
AnswerValue          // string | number | boolean | string[] | null
```

`DriverBucket` enum: `'labor' | 'materials' | 'access' | 'disposal_fees' | 'risk' | 'other'`

---

## Media Configuration Constants

Defined in `MediaConstants.ts`:

```typescript
MAX_PHOTOS           = 12
MAX_VIDEOS           = 1
MAX_VIDEO_SECONDS    = 30
IMAGE_MAX_DIMENSION  = 1536   // px
IMAGE_COMPRESS_QUALITY = 0.82
VIDEO_FRAME_COUNT    = 10
```

Do not hardcode these values inline — always reference `MediaConstants`.

---

## Theme System

Import from `../theme`:

```typescript
import { T, AI_D, radii, spacing, GlassPanel, GlowButton, Chip, FieldLabel, SectionHeader } from '../theme';
```

- `T` — main design token object: `T.bg`, `T.surface`, `T.card`, `T.text`, `T.textDim`, `T.sub`, `T.muted`, `T.border`, `T.accent`, `T.accentLo`, `T.accentHi`, `T.green`, `T.greenLo`, `T.greenHi`, `T.amber`, `T.amberLo`, `T.amberHi`, `T.red`, `T.redLo`, `T.redHi`, `T.indigo`, `T.indigoLo`, `T.indigoHi`, `T.teal`, `T.tealLo`, `T.tealHi`, `T.purple`, `T.purpleLo`
- `AI_D` — AI screen-specific dark palette variant
- `radii` — `radii.sm`, `.md`, `.lg`, `.xl`, `.xxl`
- `spacing` — spacing scale values

Always use theme tokens. Never hardcode color hex values (except `'#fff'` and `'rgba(...)'` for overlays where tokens are not applicable).

---

## Component Patterns

### Screen components

```typescript
export function MyScreen({ route, navigation }: any) {
  // route.params typed inline or cast
  // useFocusEffect for data refresh on screen focus
  // useMemo for expensive computations (like computePricingV2)
  // StyleSheet.create at bottom of file, const s = StyleSheet.create({})
}
```

### Modals / bottom sheets

- Use React Native `Modal` with `transparent` + `animationType="slide"` for sheets
- Use `animationType="fade"` for overlay dialogs
- Always handle `onRequestClose` (Android back button)
- Use `KeyboardAvoidingView` with `behavior={Platform.OS === 'ios' ? 'padding' : undefined}`
- Bottom sheets: `justifyContent: 'flex-end'` on overlay, full-width sheet with rounded top corners using `radii.xxl`

### Inline toast

Use the `useToast()` hook pattern from `NewEstimateScreen` — it returns `{ show, Toast }`. Mount `<Toast />` at the bottom of the screen's JSX.

### Validation

- Field-level errors: `Record<string, string>` map, cleared on change
- Display error text below the input with `T.red` color
- Banner-level errors: use the `errorBanner` pattern for summary validation state

---

## State Management Rules

1. `useState` for component-level state. No global state library.
2. `useMemo` for derived values — wrap `computePricingV2` calls always.
3. `useCallback` for event handlers passed as props or used in `useFocusEffect`.
4. `useRef` for values that should not trigger re-renders (e.g., `editingIdRef`).
5. `useFocusEffect` (from `@react-navigation/native`) for data that should refresh on screen focus.
6. **Never mutate state directly.** Use functional updates or immutable helpers (`applyOverride`, `removeOverride`).

---

## Estimate Lifecycle

```
draft     → created with Save Draft (customer name optional, no validation)
pending   → created with Calculate Range (customer name required, required fields validated)
           → navigates to EstimateDetail screen
```

Estimates are upserted (not inserted) via `EstimateRepository.upsertEstimate()`. The `editingIdRef` pattern ensures repeated saves update the same record.

---

## AI Scan History

When AI results are applied to an estimate:
1. Pre-application answers snapshot is saved (excluding `__ai_` metadata keys and data URIs).
2. Applied answers are written back to the estimate with `__ai_confidence` and `__ai_source` metadata keys.
3. An `AiScanRecord` is appended via `appendAiHistory()`.
4. Operators can revert to any snapshot from `AiScanHistorySection` in `NewEstimateScreen`.

The `AI_META_PREFIX` constant (`'__ai_'`) must be used when filtering metadata keys — never hardcode the string.

---

## Development Conventions

### Do
- Keep domain logic in `domain/` — no React imports, no async I/O
- Co-locate styles with the component file using `const s = StyleSheet.create({})`
- Guard array indices: use `Math.min(idx, arr.length - 1)` pattern when index state might be stale after data reload
- Use `Intl`/`toLocaleString('en-US')` for currency display (not manual formatting)
- Use `clamp()` on all numeric pricing values
- Keep processing sequential in the media queue to avoid memory pressure

### Don't
- Don't add `console.log` without removing before commit
- Don't hardcode magic numbers — use constants from `MediaConstants.ts` or the theme
- Don't mutate `DriverOverrideMap` or `answers` objects directly
- Don't render without null-guarding (`if (!vertical) return null`)
- Don't use `any` type unless interfacing with untyped third-party data
- Don't write to `aiHistory` or deduct credits in Phase 0 (demo mode)
- Don't change rule evaluation order in `pricingEngineV2.ts`

---

## File-by-File Quick Reference

| File | Purpose | Key exports |
|---|---|---|
| `domain/pricingEngineV2.ts` | Pricing computation | `computePricingV2`, `applyOverride`, `removeOverride`, `clearOverrides`, `PricingResultV2` |
| `screens/NewEstimateScreen.tsx` | Estimate creation/edit | `NewEstimateScreen` |
| `screens/AiSiteAnalysisScreen.tsx` | AI media analysis | `AiSiteAnalysisScreen` |
| `components/PricingSummaryCard.tsx` | Live pricing display | `PricingSummaryCard` |
| `components/OverrideModal.tsx` | Driver price override | `OverrideModal` |
| `components/RuleBuilderModal.tsx` | Pricing rule wizard | `RuleBuilderModal` |
| `media/MediaJobQueue.ts` | Async media pipeline | `enqueueMedia`, `getJobs`, `clearJobs`, `MediaJob` |
| `media/MediaGrid.tsx` | Media upload grid UI | `MediaGrid` |
| `media/MediaItemCard.tsx` | Single media item | `MediaItemCard` |
| `media/MediaPickerSheet.tsx` | Media picker bottom sheet | `MediaPickerSheet` |
| `media/MediaConstants.ts` | Upload/compression limits | `MAX_PHOTOS`, `MAX_VIDEOS`, etc. |

---

## Git Workflow

- Active development branch: `claude/claude-md-mmfmsilvl965qjok-XccPH`
- Main branch: `master`
- Use descriptive commit messages explaining *why*, not just *what*
- Push with: `git push -u origin <branch-name>`
