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

import { SuggestedAdjustment, AiAnalysisRecord } from '../models/types';
import { ServiceResult, ok, stubMode, blocked, offline } from './ServiceResult';
import { checkAiAccess, AiAccessOptions, AiAccessResult } from '../domain/aiGuard';
import { isAiProviderReady } from './capabilities';
import { makeId } from '../domain/id';
import { getGenerativeModel } from 'firebase/ai';
import { ai } from '../firebase/config';
import * as FileSystem from 'expo-file-system';

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

  // 3. Call real provider; fall back to simulation on any failure so the
  //    app never dead-ends (quota exceeded, parse failure, network, etc.).
  try {
    const result = await callProvider(input);
    return ok(result);
  } catch {
    return stubAnalysis(input);
  }
}

// ─── Stub / fallback analysis ───────────────────────────────────────────────
// Used in Phase 0 (no provider configured) and as a graceful fallback when
// the real provider call fails (quota, parse error, network, etc.).

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
  return ok(record);
}

// ─── Provider call — Firebase AI Logic (Gemini) ──────────────────────────────
// Uses GoogleAIBackend (Gemini Developer API, free-tier on Spark plan).
// Switch to VertexAIBackend in firebase/config.ts when upgrading to Blaze.
//
// MODEL: Verify the current supported model ID in Firebase console → AI Logic.
// Use a stable alias (e.g. "gemini-2.5-flash-lite") rather than a dated
// preview suffix to avoid needing code changes when previews graduate.
const GEMINI_MODEL = 'gemini-2.5-flash-lite';

// Cap images per call to stay within free-tier token limits.
const MAX_IMAGES_PER_CALL = 6;

async function callProvider(input: AiAnalysisInput): Promise<AiAnalysisRecord> {
  if (!ai) throw new Error('Firebase AI not initialized.');

  const model = getGenerativeModel(ai, { model: GEMINI_MODEL });

  // Convert local file URIs → base64 inline data parts.
  const imageUris = input.imageUris.slice(0, MAX_IMAGES_PER_CALL);
  const imageParts = await Promise.all(
    imageUris.map(async (uri) => {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return { inlineData: { data: base64, mimeType: 'image/jpeg' as const } };
    }),
  );

  const prompt = buildGeminiPrompt(input);
  const result = await model.generateContent([...imageParts, { text: prompt }]);
  const responseText = result.response.text();

  return parseGeminiResponse(responseText, input);
}

// ─── Prompt builder ──────────────────────────────────────────────────────────

function buildGeminiPrompt(input: AiAnalysisInput): string {
  const lines = [
    'You are an expert estimating assistant for a field service company.',
    'Analyze the provided site photos and return a structured JSON response.',
  ];
  if (input.verticalId) lines.push(`Service vertical: ${input.verticalId}`);
  if (input.serviceId)  lines.push(`Service type: ${input.serviceId}`);
  if (input.focusPrompt) lines.push(`Operator note: ${input.focusPrompt}`);

  lines.push(`
Return ONLY a raw JSON object — no markdown, no code fences, no explanation:
{
  "summary": "Brief overall assessment (1-2 sentences)",
  "adjustments": [
    {
      "label": "Human-readable description of finding",
      "questionId": "optional intake question id this maps to",
      "suggestedValue": "optional suggested answer value",
      "confidence": "high | medium | low",
      "confidenceScore": 0.0,
      "note": "optional explanation",
      "evidence": "optional: what in the image supports this"
    }
  ]
}`);
  return lines.join('\n');
}

// ─── Response parser ─────────────────────────────────────────────────────────

function parseGeminiResponse(text: string, input: AiAnalysisInput): AiAnalysisRecord {
  // Strip markdown code fences if Gemini wraps the JSON despite instructions.
  const stripped = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  let parsed: { summary?: string; adjustments?: any[] } = {};
  try {
    parsed = JSON.parse(stripped);
  } catch {
    // Non-JSON response — use raw text as summary, no adjustments.
    parsed = { summary: stripped.slice(0, 300), adjustments: [] };
  }

  const VALID_CONFIDENCE = ['high', 'medium', 'low'] as const;
  const adjustments: SuggestedAdjustment[] = (parsed.adjustments ?? []).map((a: any) => ({
    label: String(a.label ?? 'Finding'),
    questionId:      a.questionId      ?? undefined,
    suggestedValue:  a.suggestedValue  ?? undefined,
    confidence: VALID_CONFIDENCE.includes(a.confidence)
      ? a.confidence
      : mapConfidence(Number(a.confidenceScore ?? 0.5)),
    confidenceScore: typeof a.confidenceScore === 'number' ? a.confidenceScore : undefined,
    note:     a.note     ?? undefined,
    evidence: a.evidence ?? undefined,
  }));

  return {
    id: makeId(),
    imageCount: input.imageUris.length,
    focusPrompt: input.focusPrompt,
    verticalId: input.verticalId,
    summary: String(parsed.summary ?? 'Analysis complete.'),
    suggestedAdjustments: adjustments,
    creditsUsed: 0,
    createdAt: new Date().toISOString(),
  };
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
