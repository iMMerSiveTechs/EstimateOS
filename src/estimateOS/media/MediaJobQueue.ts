/**
 * MediaJobQueue.ts
 *
 * Local processing pipeline for media items before AI submission.
 *
 * Pipeline per kind:
 *   photo  → resize/compress to max 1536px using expo-image-manipulator
 *   video  → extract 8–12 frames using expo-video-thumbnails (graceful fallback
 *             if package not installed); treat frames as photos
 *
 * Design decisions:
 *   - Stores URIs only; never stores base64 blobs.
 *   - Processing is sequential per item to avoid memory pressure on device.
 *   - Simulated progress (0 → 40 → 80 → 100) keeps UI responsive.
 *   - All callbacks are optional; caller can subscribe via onUpdate.
 */

import * as ImageManipulator from 'expo-image-manipulator';
import {
  IMAGE_MAX_DIMENSION,
  IMAGE_COMPRESS_QUALITY,
  VIDEO_FRAME_COUNT,
  JobStatus,
  MediaKind,
} from './MediaConstants';
import { makeId } from '../domain/id';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MediaJob {
  id:        string;
  kind:      MediaKind;
  uri:       string;             // original URI from picker
  outputUri: string | null;      // processed URI (null until ready)
  status:    JobStatus;
  progress:  number;             // 0–100
  error?:    string;
  /** For video jobs: extracted frame URIs (populated after processing) */
  frames?:   string[];
}

type UpdateCallback = (jobs: MediaJob[]) => void;

// ─── Queue state ──────────────────────────────────────────────────────────────

let _jobs: MediaJob[] = [];
let _listener: UpdateCallback | null = null;
let _processing = false;

function notify() {
  _listener?.([..._jobs]);
}

function patchJob(id: string, patch: Partial<MediaJob>) {
  _jobs = _jobs.map(j => j.id === id ? { ...j, ...patch } : j);
  notify();
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Subscribe to job list updates. Returns an unsubscribe function. */
export function subscribeJobs(cb: UpdateCallback): () => void {
  _listener = cb;
  cb([..._jobs]);
  return () => { if (_listener === cb) _listener = null; };
}

/** Add one or more URIs to the queue and begin processing. */
export function enqueueMedia(items: Array<{ uri: string; kind: MediaKind }>): void {
  const newJobs: MediaJob[] = items.map(({ uri, kind }) => ({
    id:        makeId(),
    kind,
    uri,
    outputUri: null,
    status:    'queued',
    progress:  0,
  }));
  _jobs = [..._jobs, ...newJobs];
  notify();
  if (!_processing) processNext();
}

/** Remove a job by id. Idempotent. */
export function removeJob(id: string): void {
  _jobs = _jobs.filter(j => j.id !== id);
  notify();
}

/** Reorder jobs by supplying a new ordered id list. */
export function reorderJobs(orderedIds: string[]): void {
  const map = new Map(_jobs.map(j => [j.id, j]));
  const reordered = orderedIds.map(id => map.get(id)).filter(Boolean) as MediaJob[];
  // Append any jobs not in orderedIds at the end (safety)
  const inList = new Set(orderedIds);
  const extras = _jobs.filter(j => !inList.has(j.id));
  _jobs = [...reordered, ...extras];
  notify();
}

/** Move a job left/right in the list by one position. */
export function moveJob(id: string, direction: 'left' | 'right'): void {
  const idx = _jobs.findIndex(j => j.id === id);
  if (idx < 0) return;
  const newIdx = direction === 'left' ? idx - 1 : idx + 1;
  if (newIdx < 0 || newIdx >= _jobs.length) return;
  const next = [..._jobs];
  [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
  _jobs = next;
  notify();
}

/** Clear all jobs (e.g. on screen unmount or session reset). */
export function clearJobs(): void {
  _jobs = [];
  _processing = false;
  notify();
}

/** Snapshot of current jobs (synchronous). */
export function getJobs(): MediaJob[] {
  return [..._jobs];
}

// ─── Processing pipeline ──────────────────────────────────────────────────────

async function processNext(): Promise<void> {
  const next = _jobs.find(j => j.status === 'queued');
  if (!next) { _processing = false; return; }
  _processing = true;
  patchJob(next.id, { status: 'processing', progress: 10 });

  try {
    if (next.kind === 'photo') {
      await processPhoto(next.id, next.uri);
    } else {
      await processVideo(next.id, next.uri);
    }
  } catch (err: any) {
    patchJob(next.id, {
      status:   'failed',
      progress: 0,
      error:    err?.message ?? 'Processing failed',
    });
  }

  // Move to next queued item
  processNext();
}

async function simProgress(id: string, from: number, to: number): Promise<void> {
  const steps = 3;
  const delta = (to - from) / steps;
  for (let i = 1; i <= steps; i++) {
    await delay(120 + Math.random() * 80);
    patchJob(id, { progress: Math.round(from + delta * i) });
  }
}

async function processPhoto(id: string, uri: string): Promise<void> {
  patchJob(id, { progress: 20 });

  // Get image dimensions first so we only downscale, never upscale
  const [{ width: origW, height: origH }] =
    await ImageManipulator.manipulateAsync(uri, [], { base64: false });

  const maxDim = IMAGE_MAX_DIMENSION;
  const scaleFactor = Math.min(1, maxDim / Math.max(origW ?? maxDim, origH ?? maxDim));

  await simProgress(id, 20, 70);

  const result = await ImageManipulator.manipulateAsync(
    uri,
    scaleFactor < 1
      ? [{ resize: { width: Math.round((origW ?? maxDim) * scaleFactor) } }]
      : [],
    { compress: IMAGE_COMPRESS_QUALITY, format: ImageManipulator.SaveFormat.JPEG },
  );

  await simProgress(id, 70, 100);
  patchJob(id, { status: 'ready', progress: 100, outputUri: result.uri });
}

async function processVideo(id: string, uri: string): Promise<void> {
  patchJob(id, { progress: 10 });

  let frameUris: string[] = [];

  try {
    // expo-video-thumbnails — optional dep, graceful fallback
    const VideoThumbnails = await import('expo-video-thumbnails');

    // Spread evenly across video duration.
    // We don't know duration here so we sample at fixed time offsets (0, 3, 6… seconds).
    const timestamps = Array.from(
      { length: VIDEO_FRAME_COUNT },
      (_, i) => i * (30_000 / VIDEO_FRAME_COUNT), // ms, spread across 30s window
    );

    for (let i = 0; i < timestamps.length; i++) {
      patchJob(id, { progress: Math.round(10 + (i / timestamps.length) * 80) });
      try {
        const { uri: frameUri } = await VideoThumbnails.getThumbnailAsync(uri, {
          time: timestamps[i],
          quality: 0.8,
        });
        frameUris.push(frameUri);
      } catch {
        // Individual frame failure is non-fatal
      }
      await delay(60);
    }
  } catch {
    // expo-video-thumbnails not available — use raw video URI as fallback
    frameUris = [];
  }

  await simProgress(id, 90, 100);
  patchJob(id, {
    status:    'ready',
    progress:  100,
    outputUri: frameUris[0] ?? uri,  // first frame or raw URI
    frames:    frameUris.length ? frameUris : undefined,
  });
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
