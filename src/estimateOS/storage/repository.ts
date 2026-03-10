// ─── EstimateRepository (Firestore-backed) ────────────────────────────────
// All estimates are stored under users/{uid}/estimates/{estimateId}.
// Requires the user to be signed in; throws if auth.currentUser is null.

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { Estimate } from '../models/types';

// Firebase v11 rejects undefined values at any nesting level.
// Strip them recursively before every write (FieldValue sentinels are kept).
function deepStripUndefined(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (v !== null && typeof v === 'object' && !Array.isArray(v) && typeof v.toDate !== 'function' && typeof v._methodName === 'undefined') {
      out[k] = deepStripUndefined(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function uid(): string {
  const user = auth.currentUser;
  if (!user) throw new Error('EstimateRepository: user is not signed in');
  return user.uid;
}

function ensureDb() {
  if (!db) throw new Error('[EstimateRepository] Firestore not initialized — check Firebase config.');
  return db;
}

function estimatesCol() {
  return collection(ensureDb(), 'users', uid(), 'estimates');
}

function estimateDoc(estimateId: string) {
  return doc(ensureDb(), 'users', uid(), 'estimates', estimateId);
}

// Firestore stores dates as Timestamps; convert back to ISO strings on read
function deserialize(data: Record<string, any>): Estimate {
  return {
    ...data,
    createdAt:
      data.createdAt instanceof Timestamp
        ? data.createdAt.toDate().toISOString()
        : data.createdAt,
    updatedAt:
      data.updatedAt instanceof Timestamp
        ? data.updatedAt.toDate().toISOString()
        : data.updatedAt,
  } as Estimate;
}

export const EstimateRepository = {
  async getEstimate(id: string): Promise<Estimate | null> {
    const snap = await getDoc(estimateDoc(id));
    if (!snap.exists()) return null;
    return deserialize(snap.data());
  },

  async upsertEstimate(estimate: Estimate): Promise<void> {
    // Strip undefined at all nesting levels — Firebase v11 throws on undefined values.
    await setDoc(estimateDoc(estimate.id), {
      ...deepStripUndefined(estimate),
      updatedAt: serverTimestamp(),
    });
  },

  async listEstimates(): Promise<Estimate[]> {
    const q = query(estimatesCol(), orderBy('updatedAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => deserialize(d.data()));
  },

  async listByCustomer(customerId: string): Promise<Estimate[]> {
    const q = query(estimatesCol(), where('customerId', '==', customerId), orderBy('updatedAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => deserialize(d.data()));
  },

  async deleteEstimate(id: string): Promise<void> {
    await deleteDoc(estimateDoc(id));
  },
};
