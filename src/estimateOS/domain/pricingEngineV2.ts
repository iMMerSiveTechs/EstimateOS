/**
 * pricingEngineV2.ts
 *
 * Enhanced, deterministic pricing engine.
 *
 * Key improvements over v1:
 *   - Every driver has a stable `id`, human-readable `explanation`, `triggeredBy`,
 *     and `editable` flag so the operator can override or disable individual lines.
 *   - Operator overrides (DriverOverrideMap) are applied after engine computation.
 *   - Manual line items (arbitrary operator additions, bucketed) are merged in.
 *   - Result is cached per (serviceId + answersHash + overridesHash) so
 *     repeated renders don't recompute.
 *   - All multipliers applied last, after adds, so order is fully deterministic.
 *   - NaN/negative clamped throughout.
 *
 * Rule evaluation order (per spec):
 *   1. flat_fee         (always applies)
 *   2. conditional_addon (trigger match)
 *   3. per_unit         (numeric answer × rate)
 *   4. tiered           (band lookup)
 *   5. adder            (legacy conditional)
 *   6. multiplier       (scales subtotal last)
 */

import {
  VerticalConfig, ServiceConfig, PricingRule, PriceRange,
  PriceDriver, BucketSummary, DriverBucket, DriverOverrideMap,
  LineItem,
} from '../models/types';

// ─── Public result type ───────────────────────────────────────────────────────

export interface PricingResultV2 {
  /** Final range after all rules, overrides, manual items, variance. */
  range:        PriceRange;
  /** Base service range (before rules) */
  baseRange:    PriceRange;
  /** All computed drivers (before overrides applied to totals). */
  drivers:      PriceDriver[];
  /** Bucket subtotals, computed from effective (override-aware) driver values. */
  buckets:      BucketSummary[];
  /** Whether any operator overrides are active. */
  hasOverrides: boolean;
}

// ─── Cache ────────────────────────────────────────────────────────────────────

interface CacheKey { serviceId: string; answersHash: string; overridesHash: string; manualHash: string; }
const _cache = new Map<string, { key: CacheKey; result: PricingResultV2 }>();
const MAX_CACHE = 20;

function hashObj(obj: unknown): string {
  return JSON.stringify(obj, Object.keys(obj as any).sort());
}
function cacheKeyStr(k: CacheKey): string {
  return `${k.serviceId}|${k.answersHash}|${k.overridesHash}|${k.manualHash}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function round5(n: number): number { return Math.round(n / 5) * 5; }
function clamp(n: number): number  { return Math.max(0, isFinite(n) ? n : 0); }

function matchesAnswer(
  rule: PricingRule,
  answer: string | number | boolean | string[] | undefined | null,
): boolean {
  if (answer === undefined || answer === null) return false;
  const trigger = rule.triggerValue ?? rule.answerValue;
  if (Array.isArray(answer)) return answer.includes(String(trigger));
  if (typeof trigger === 'number') {
    const num = Number(answer);
    if (isNaN(num)) return false;
    return trigger === 3 ? num >= 3 : num === trigger;
  }
  if (typeof trigger === 'boolean') return answer === trigger || answer === String(trigger);
  return String(answer) === String(trigger);
}

function groupByBucket(drivers: PriceDriver[]): BucketSummary[] {
  const map = new Map<DriverBucket, BucketSummary>();
  for (const d of drivers) {
    if (d.disabled) continue;
    const eff = effectiveDriver(d);
    const existing = map.get(d.bucket);
    if (existing) {
      existing.totalMin += eff.minImpact;
      existing.totalMax += eff.maxImpact;
      existing.drivers.push(d);
    } else {
      map.set(d.bucket, { bucket: d.bucket, totalMin: eff.minImpact, totalMax: eff.maxImpact, drivers: [d] });
    }
  }
  const ORDER: DriverBucket[] = ['labor', 'materials', 'access', 'disposal_fees', 'risk', 'other'];
  return ORDER.map(b => map.get(b)).filter(Boolean) as BucketSummary[];
}

/** Returns the effective (override-aware) min/max for display/totals. */
function effectiveDriver(d: PriceDriver): { minImpact: number; maxImpact: number } {
  return {
    minImpact: d.disabled ? 0 : (d.overrideMin ?? d.minImpact),
    maxImpact: d.disabled ? 0 : (d.overrideMax ?? d.maxImpact),
  };
}

// ─── Rule → driver builder ────────────────────────────────────────────────────

function makeDriver(
  id: string,
  label: string,
  minImpact: number,
  maxImpact: number,
  bucket: DriverBucket,
  triggeredBy: string,
  explanation: string,
  overrides?: DriverOverrideMap,
): PriceDriver {
  const ov = overrides?.[id];
  return {
    id,
    label,
    minImpact: clamp(minImpact),
    maxImpact: clamp(maxImpact),
    bucket,
    triggeredBy,
    explanation,
    editable: true,
    overrideMin: ov?.min,
    overrideMax: ov?.max,
    disabled:    ov?.disabled,
  };
}

// ─── Main engine ──────────────────────────────────────────────────────────────

export function computePricingV2(
  config:    VerticalConfig,
  service:   ServiceConfig,
  answers:   Record<string, string | number | boolean | string[] | null>,
  overrides: DriverOverrideMap = {},
  manualItems: LineItem[] = [],
): PricingResultV2 {
  // ── Cache check ─────────────────────────────────────────────────────────────
  const cacheKey: CacheKey = {
    serviceId:    service.id,
    answersHash:  hashObj(answers),
    overridesHash:hashObj(overrides),
    manualHash:   hashObj(manualItems),
  };
  const cached = _cache.get(cacheKeyStr(cacheKey));
  if (cached) return cached.result;

  const drivers: PriceDriver[] = [];

  // ── Base driver (always present, not editable — base price) ─────────────────
  drivers.push({
    id: 'base',
    label: `${service.name} — Base`,
    minImpact: clamp(service.baseMin),
    maxImpact: clamp(service.baseMax),
    bucket: 'labor',
    triggeredBy: 'Service selection',
    explanation: `Starting price for ${service.name}.`,
    editable: false,
  });

  let runMin = service.baseMin;
  let runMax = service.baseMax;

  // Separate multipliers to apply last
  const multipliers: PricingRule[] = [];

  const ruleOrder: Array<PricingRule['type']> = [
    'flat_fee', 'conditional_addon', 'per_unit', 'tiered', 'adder',
  ];

  const byType = (t: PricingRule['type']) => config.pricingRules.filter(r => r.type === t);

  // ── flat_fee ─────────────────────────────────────────────────────────────────
  for (const [ruleIdx, rule] of byType('flat_fee').entries()) {
    const id = `flat_fee_${ruleIdx}`;
    const addMin = clamp(rule.valueMin);
    const addMax = clamp(rule.valueMax);
    if (addMax > 0 || addMin > 0) {
      drivers.push(makeDriver(
        id, rule.label, addMin, addMax, rule.bucket ?? 'other',
        'Always applied',
        `${rule.label} is a fixed fee included with every ${service.name} estimate.`,
        overrides,
      ));
      runMin += addMin; runMax += addMax;
    }
  }

  // ── conditional_addon ────────────────────────────────────────────────────────
  for (const [ruleIdx, rule] of byType('conditional_addon').entries()) {
    const answer = answers[rule.questionId];
    if (matchesAnswer(rule, answer as any)) {
      const id = `conditional_${ruleIdx}`;
      const addMin = clamp(rule.valueMin);
      const addMax = clamp(rule.valueMax);
      const trigger = rule.triggerValue ?? String(rule.answerValue);
      drivers.push(makeDriver(
        id, rule.label, addMin, addMax, rule.bucket ?? 'other',
        `Answer "${trigger}" on "${rule.questionId}"`,
        `${rule.label} applies because the answer to "${rule.questionId}" is "${trigger}".`,
        overrides,
      ));
      runMin += addMin; runMax += addMax;
    }
  }

  // ── per_unit ──────────────────────────────────────────────────────────────────
  for (const [ruleIdx, rule] of byType('per_unit').entries()) {
    const rawAnswer = answers[rule.questionId];
    const units = clamp(Number(rawAnswer));
    if (units > 0) {
      const id = `per_unit_${ruleIdx}`;
      const cap = rule.unitCap ?? Infinity;
      const eff = Math.min(units, cap);
      const addMin = clamp((rule.unitMin ?? 0) * eff);
      const addMax = clamp((rule.unitMax ?? 0) * eff);
      const unitLabel = rule.unitLabel ?? 'units';
      drivers.push(makeDriver(
        id, `${rule.label} (${eff} ${unitLabel})`,
        addMin, addMax, rule.bucket ?? 'labor',
        `${units} ${unitLabel} entered`,
        `$${rule.unitMin ?? 0}–$${rule.unitMax ?? 0} per ${unitLabel} × ${eff} ${unitLabel}${cap < Infinity ? ` (capped at ${cap})` : ''}.`,
        overrides,
      ));
      runMin += addMin; runMax += addMax;
    }
  }

  // ── tiered ───────────────────────────────────────────────────────────────────
  for (const [ruleIdx, rule] of byType('tiered').entries()) {
    const rawAnswer = answers[rule.questionId];
    const num = Number(rawAnswer);
    if (!isNaN(num) && rule.tieredData?.length) {
      for (const tier of rule.tieredData) {
        if (num >= tier.minValue && (num < tier.maxValue || tier.maxValue === Infinity)) {
          const id = `tiered_${ruleIdx}`;
          const addMin = clamp(tier.addMin);
          const addMax = clamp(tier.addMax);
          drivers.push(makeDriver(
            id, `${rule.label} — ${tier.label}`,
            addMin, addMax, rule.bucket ?? 'other',
            `Value ${num} falls in tier "${tier.label}" (${tier.minValue}–${tier.maxValue === Infinity ? '∞' : tier.maxValue})`,
            `${tier.label} tier applies because the value ${num} is in range ${tier.minValue}–${tier.maxValue === Infinity ? '∞' : tier.maxValue}.`,
            overrides,
          ));
          runMin += addMin; runMax += addMax;
          break;
        }
      }
    }
  }

  // ── adder (legacy) ────────────────────────────────────────────────────────────
  for (const [ruleIdx, rule] of byType('adder').entries()) {
    const answer = answers[rule.questionId];
    if (matchesAnswer(rule, answer as any)) {
      const id = `adder_${ruleIdx}`;
      const addMin = clamp(rule.valueMin);
      const addMax = clamp(rule.valueMax);
      drivers.push(makeDriver(
        id, rule.label, addMin, addMax, rule.bucket ?? 'other',
        `Answer "${rule.answerValue}" on "${rule.questionId}"`,
        `${rule.label} applies when the answer to "${rule.questionId}" is "${rule.answerValue}".`,
        overrides,
      ));
      runMin += addMin; runMax += addMax;
    }
  }

  // ── multiplier (applied last) ─────────────────────────────────────────────────
  for (const [ruleIdx, rule] of byType('multiplier').entries()) {
    const answer = answers[rule.questionId];
    if (matchesAnswer(rule, answer as any)) {
      const id = `multiplier_${ruleIdx}`;
      const fMin = clamp(rule.valueMin);
      const fMax = clamp(rule.valueMax);
      const impactMin = runMin * (fMin - 1);
      const impactMax = runMax * (fMax - 1);
      drivers.push(makeDriver(
        id, rule.label,
        clamp(impactMin), clamp(impactMax),
        rule.bucket ?? 'risk',
        `Answer "${rule.answerValue}" on "${rule.questionId}"`,
        `${rule.label} applies a ×${fMin}–×${fMax} multiplier to the running subtotal because "${rule.questionId}" is "${rule.answerValue}".`,
        overrides,
      ));
      runMin *= fMin; runMax *= fMax;
    }
  }

  // ── Manual line items → drivers ───────────────────────────────────────────────
  // Manual items intentionally allow negative values (discounts / credits).
  // We do NOT clamp to 0 here — the operator is explicitly overriding the total.
  for (const item of manualItems) {
    const id = `manual_${item.id}`;
    const ov = overrides?.[id];
    const itemMin = isFinite(item.min) ? item.min : 0;
    const itemMax = isFinite(item.max) ? item.max : 0;
    drivers.push({
      id,
      label: item.label,
      minImpact: itemMin,
      maxImpact: itemMax,
      bucket: (item as any).bucket ?? 'other',
      triggeredBy: 'Manual entry',
      explanation: item.note ?? 'Manually added line item.',
      editable: true,
      overrideMin: ov?.min,
      overrideMax: ov?.max,
      disabled:    ov?.disabled,
    });
    runMin += itemMin;
    runMax += itemMax;
  }

  // ── Apply effective overrides to running totals ───────────────────────────────
  // Recompute totals using override-aware values
  let effMin = 0;
  let effMax = 0;
  for (const d of drivers) {
    const eff = effectiveDriver(d);
    effMin += eff.minImpact;
    effMax += eff.maxImpact;
  }

  // ── Apply variance band ───────────────────────────────────────────────────────
  // Do NOT clamp to 0 here: operator manual discounts can legitimately produce
  // negative totals (e.g. full credit on a job). Clamp only for NaN/Infinity.
  const v = config.variancePct;
  const safeEffMin = isFinite(effMin) ? effMin : 0;
  const safeEffMax = isFinite(effMax) ? effMax : 0;
  const finalMin = safeEffMin * (1 - v / 2);
  const finalMax = safeEffMax * (1 + v / 2);

  const result: PricingResultV2 = {
    range: {
      min: round5(finalMin),
      max: round5(finalMax),
      currency: config.currency,
    },
    baseRange: {
      min: service.baseMin,
      max: service.baseMax,
      currency: config.currency,
    },
    drivers,
    buckets: groupByBucket(drivers),
    hasOverrides: Object.keys(overrides).length > 0,
  };

  // ── Cache ─────────────────────────────────────────────────────────────────────
  if (_cache.size >= MAX_CACHE) {
    const firstKey = _cache.keys().next().value;
    if (firstKey) _cache.delete(firstKey);
  }
  _cache.set(cacheKeyStr(cacheKey), { key: cacheKey, result });

  return result;
}

/** Apply a single override to a DriverOverrideMap (immutable update). */
export function applyOverride(
  overrides: DriverOverrideMap,
  driverId: string,
  patch: { min?: number; max?: number; disabled?: boolean },
): DriverOverrideMap {
  const existing = overrides[driverId] ?? { driverId };
  return { ...overrides, [driverId]: { ...existing, ...patch } };
}

/** Remove a single override. */
export function removeOverride(overrides: DriverOverrideMap, driverId: string): DriverOverrideMap {
  const next = { ...overrides };
  delete next[driverId];
  return next;
}

/** Clear all overrides. */
export function clearOverrides(): DriverOverrideMap { return {}; }
