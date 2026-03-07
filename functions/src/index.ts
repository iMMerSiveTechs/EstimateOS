// ─── EstimateOS Cloud Functions ────────────────────────────────────────────
import * as admin from 'firebase-admin';
import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';

admin.initializeApp();
const db = admin.firestore();

// ─── Types (mirrored from models/types.ts for the server side) ────────────

interface AiObservation {
  questionId: string;
  suggestedValue: string | number | boolean | string[] | null;
  confidence: number;
  evidence?: string;
}

interface AnalyzeMediaRequest {
  estimateId: string;
  mediaUrls: string[];
  focusNote?: string;
}

interface AnalyzeMediaResponse {
  observations: AiObservation[];
  overallConfidence: number;
  summary: string;
}

// ─── analyzeMedia ──────────────────────────────────────────────────────────
// HTTPS Callable function. Call from the app with:
//   const fn = httpsCallable(functions, 'analyzeMedia');
//   const result = await fn({ estimateId, mediaUrls, focusNote });
//
// TODO (Phase 2): Replace the stub body below with a real AI API call.
//   Options:
//     - Anthropic Claude: import Anthropic from '@anthropic-ai/sdk'
//       and call client.messages.create() with image_url blocks.
//     - OpenAI Vision: import OpenAI from 'openai'
//       and use model 'gpt-4o' with image_url content.
//     - Google Gemini: import { GoogleGenerativeAI } from '@google/generative-ai'
//       and use gemini-1.5-flash with image parts.
//   Store the API key in Firebase Secret Manager:
//     firebase functions:secrets:set AI_API_KEY
//   Then add `secrets: ['AI_API_KEY']` to the onCall options.

export const analyzeMedia = onCall(
  { region: 'us-central1', enforceAppCheck: false },
  async (request: CallableRequest<AnalyzeMediaRequest>): Promise<AnalyzeMediaResponse> => {
    // Auth guard — only signed-in users can call this
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in to use AI analysis.');
    }

    const { estimateId, mediaUrls, focusNote } = request.data;
    const uid = request.auth.uid;

    if (!estimateId || !Array.isArray(mediaUrls) || mediaUrls.length === 0) {
      throw new HttpsError('invalid-argument', 'estimateId and mediaUrls are required.');
    }

    // Check credit balance
    const balanceRef = db.doc(`users/${uid}/credits/balance`);
    const balanceSnap = await balanceRef.get();
    const balance: number = balanceSnap.exists() ? (balanceSnap.data()?.balance ?? 0) : 0;
    if (balance <= 0) {
      throw new HttpsError('resource-exhausted', 'Insufficient AI credits.');
    }

    // ── TODO: Replace this stub with a real AI API call ──────────────────
    // Example with Anthropic (install @anthropic-ai/sdk in functions/):
    //
    // import Anthropic from '@anthropic-ai/sdk';
    // const client = new Anthropic({ apiKey: process.env.AI_API_KEY });
    //
    // const imageContent = mediaUrls.map(url => ({
    //   type: 'image' as const,
    //   source: { type: 'url' as const, url },
    // }));
    //
    // const message = await client.messages.create({
    //   model: 'claude-opus-4-6',
    //   max_tokens: 1024,
    //   messages: [{
    //     role: 'user',
    //     content: [
    //       ...imageContent,
    //       { type: 'text', text: buildAnalysisPrompt(focusNote) },
    //     ],
    //   }],
    // });
    //
    // const observations = parseAiResponse(message.content[0]);
    // ── End TODO ────────────────────────────────────────────────────────

    // Stub response — returns a plausible structure so the app can be tested
    // end-to-end without a live AI key.
    const stubObservations: AiObservation[] = [
      {
        questionId: 'stub_question',
        suggestedValue: 'AI backend not yet connected',
        confidence: 0,
        evidence: focusNote
          ? `Focus note received: "${focusNote}". ${mediaUrls.length} image(s) provided.`
          : `${mediaUrls.length} image(s) provided. Wire in an AI API to get real observations.`,
      },
    ];

    // Deduct 1 credit atomically
    await balanceRef.set(
      { balance: admin.firestore.FieldValue.increment(-1), updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true },
    );

    // Log the analysis record
    await db.collection(`users/${uid}/analysisHistory`).add({
      estimateId,
      analyzedAt: admin.firestore.FieldValue.serverTimestamp(),
      mediaCount: mediaUrls.length,
      creditsUsed: 1,
      status: 'success',
    });

    return {
      observations: stubObservations,
      overallConfidence: 0,
      summary: 'Stub response — connect an AI Vision API to get real analysis.',
    };
  },
);

// ─── onNewUser ─────────────────────────────────────────────────────────────
// Automatically creates a credits document with a starter balance
// when a new user is created in Firebase Auth.
// Triggered by writing to users/{uid} (handled in AuthContext after signUp).
// Alternative: use Firebase Auth triggers via functions/v2/identity.

export const initUserCredits = onDocumentCreated(
  'users/{uid}/credits/balance',
  async (event) => {
    // Only set if the doc was just created without a balance field
    const data = event.data?.data();
    if (data && data.balance !== undefined) return;

    await event.data?.ref.set({
      balance: 3, // 3 free starter credits
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  },
);
