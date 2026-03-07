/**
 * services/aiProvider.ts — AI provider adaptor boundary.
 *
 * Separates:
 *   - AI access guard (credit check, online check)        → domain/aiGuard.ts
 *   - AI provider call logic (this file)                   → service adaptor
 *   - AI result parsing / confidence mapping               → parseAiResponse()
 *   - AI failure classification                            → classifyAiError()
 *   - AI UI flow                                           → AiSiteAnalysisScreen
 *
 * Currently returns stub/demo results. When a real provider (Gemini, OpenAI,
 * custom backend) is connected, replace `callAiAnalysis()` internals without
 * touching the screen layer.
 */

import { SuggestedAdjustment, AiAnalysisRecord, AiFailureType } from '../models/types';
import { ServiceResult, ok, stubMode, providerError, blocked, offline } from './ServiceResult';
import { checkAiAccess, classifyAiError, AiAccessOptions, AiAccessResult } from '../domain/aiGuard';
import { isAiProviderReady } from './capabilities';
import { makeId } from '../domain/id';

// ─── Provider interface ─────────────────────────────────────────────────────
// Future providers implement this shape.

export interface AiAnalysisInput {
  imageUris: string[];
  focusPrompt?: string;
  verticalId?: string;
  serviceId?: string;
}

export interface AiAnalysisOutput {
  summary: string;
  adjustments: SuggestedAdjustment[];
  creditsUsed: number;
}

// ─── Guard + call ───────────────────────────────────────────────────────────

/**
 * Full AI analysis flow: guard → call → parse.
 *
 * Screens call this instead of doing guard + provider logic inline.
 */
export async function runAiAnalysis(
  input: AiAnalysisInput,
  guardOpts: AiAccessOptions,
): Promise<ServiceResult<AiAnalysisRecord>> {
  // 1. Guard
  const access: AiAccessResult = checkAiAccess(guardOpts);
  if (access.status === 'blocked') {
    if (access.failureType === 'offline') return offline(access.message);
    if (access.failureType === 'no_credits') return blocked('not_configured', access.message ?? 'No AI credits remaining.');
    if (access.failureType === 'missing_api_key') return blocked('not_configured', access.message ?? 'AI provider not configured.');
    return providerError(access.message ?? 'AI access blocked.');
  }

  // 2. Check provider readiness
  const providerReady = await isAiProviderReady();
  if (!providerReady) {
    // Phase 0/1: return stub result
    return stubAnalysis(input);
  }

  // 3. Call real provider (future: replace this block)
  try {
    const result = await callProvider(input);
    return ok(result);
  } catch (err) {
    const failureType = classifyAiError(err);
    return providerError(
      err instanceof Error ? err.message : 'AI analysis failed.',
      failureType,
    );
  }
}

// ─── Stub analysis (demo mode) ─────────────────────────────────────────────

function stubAnalysis(input: AiAnalysisInput): ServiceResult<AiAnalysisRecord> {
  const record: AiAnalysisRecord = {
    id: makeId(),
    imageCount: input.imageUris.length,
    focusPrompt: input.focusPrompt,
    verticalId: input.verticalId,
    summary: 'Demo analysis — no live AI provider connected. Connect a provider in Settings → Integrations to get real results.',
    suggestedAdjustments: [],
    creditsUsed: 0,
    createdAt: new Date().toISOString(),
  };
  return stubMode('Running in demo mode — connect an AI provider for real analysis.');
}

// ─── Provider call (placeholder) ────────────────────────────────────────────
// Replace this function body when wiring a real provider (Gemini, OpenAI, etc.)

async function callProvider(input: AiAnalysisInput): Promise<AiAnalysisRecord> {
  // TODO: Wire real provider here.
  // Expected flow:
  //   1. Upload images to provider or encode as base64
  //   2. Send prompt with vertical/service context
  //   3. Parse structured response into SuggestedAdjustment[]
  //   4. Map confidence scores
  //   5. Return AiAnalysisRecord
  throw new Error('AI provider not connected. This is a stub — wire a real provider.');
}

// ─── Confidence mapping ─────────────────────────────────────────────────────
// Normalizes provider-specific confidence scores to the app's 3-tier system.

export function mapConfidence(score: number): 'high' | 'medium' | 'low' {
  if (score >= 0.75) return 'high';
  if (score >= 0.45) return 'medium';
  return 'low';
}

/** Count low-confidence items that need operator review. */
export function countLowConfidence(adjustments: SuggestedAdjustment[]): number {
  return adjustments.filter(
    a => a.confidence === 'low' || (a.confidenceScore != null && a.confidenceScore < 0.5),
  ).length;
}
