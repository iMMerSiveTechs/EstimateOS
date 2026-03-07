// ─── Firebase Storage media upload ────────────────────────────────────────
// Uploads a processed MediaJob's local URI to Firebase Storage.
// Called AFTER the job reaches 'ready' status in MediaJobQueue.
// Existing local processing (resize, compression, thumbnails) is unchanged.
//
// Storage path: users/{uid}/estimates/{estimateId}/media/{filename}

import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  UploadTaskSnapshot,
} from 'firebase/storage';
import { auth, storage } from '../firebase/config';
import { MediaJob } from './MediaJobQueue';

export interface UploadResult {
  remoteUrl: string;
  storagePath: string;
}

function uid(): string {
  const user = auth.currentUser;
  if (!user) throw new Error('MediaUploadService: user is not signed in');
  return user.uid;
}

// Convert a local file URI to a Blob for upload
async function uriToBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  return response.blob();
}

function storagePath(estimateId: string, filename: string): string {
  return `users/${uid()}/estimates/${estimateId}/media/${filename}`;
}

function filenameFromUri(uri: string): string {
  const parts = uri.split('/');
  const raw = parts[parts.length - 1] ?? 'media';
  // Strip query strings if any
  return raw.split('?')[0] ?? raw;
}

/**
 * Upload a single MediaJob's local URI to Firebase Storage.
 *
 * @param job          The MediaJob to upload (must have a localUri)
 * @param estimateId   The estimate this media belongs to
 * @param onProgress   Optional callback — receives 0–100 progress value
 * @returns            { remoteUrl, storagePath }
 */
export async function uploadMediaJob(
  job: MediaJob,
  estimateId: string,
  onProgress?: (pct: number) => void,
): Promise<UploadResult> {
  const uri = job.localUri;
  if (!uri) throw new Error(`MediaJob ${job.id} has no localUri`);

  const filename = filenameFromUri(uri);
  const path = storagePath(estimateId, `${job.id}_${filename}`);
  const storageRef = ref(storage, path);

  const blob = await uriToBlob(uri);

  return new Promise<UploadResult>((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, blob);

    task.on(
      'state_changed',
      (snapshot: UploadTaskSnapshot) => {
        if (onProgress) {
          const pct = Math.round(
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
          );
          onProgress(pct);
        }
      },
      (error) => reject(error),
      async () => {
        try {
          const remoteUrl = await getDownloadURL(task.snapshot.ref);
          resolve({ remoteUrl, storagePath: path });
        } catch (e) {
          reject(e);
        }
      },
    );
  });
}

/**
 * Upload all ready jobs for an estimate in parallel (max 3 concurrent).
 * Returns a map of jobId → UploadResult.
 */
export async function uploadAllJobs(
  jobs: MediaJob[],
  estimateId: string,
  onJobProgress?: (jobId: string, pct: number) => void,
): Promise<Map<string, UploadResult>> {
  const readyJobs = jobs.filter((j) => j.status === 'ready' && j.localUri);
  const results = new Map<string, UploadResult>();

  // Process in chunks of 3 to avoid overwhelming the network
  const chunkSize = 3;
  for (let i = 0; i < readyJobs.length; i += chunkSize) {
    const chunk = readyJobs.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (job) => {
        const result = await uploadMediaJob(
          job,
          estimateId,
          onJobProgress ? (pct) => onJobProgress(job.id, pct) : undefined,
        );
        results.set(job.id, result);
      }),
    );
  }

  return results;
}
