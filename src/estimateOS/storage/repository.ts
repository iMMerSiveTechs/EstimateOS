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
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { Estimate } from '../models/types';

function uid(): string {
  const user = auth.currentUser;
  if (!user) throw new Error('EstimateRepository: user is not signed in');
  return user.uid;
}

function estimatesCol() {
  return collection(db, 'users', uid(), 'estimates');
}

function estimateDoc(estimateId: string) {
  return doc(db, 'users', uid(), 'estimates', estimateId);
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
    await setDoc(estimateDoc(estimate.id), {
      ...estimate,
      updatedAt: serverTimestamp(),
    });
  },

  async listEstimates(): Promise<Estimate[]> {
    const q = query(estimatesCol(), orderBy('updatedAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => deserialize(d.data()));
  },

  async deleteEstimate(id: string): Promise<void> {
    await deleteDoc(estimateDoc(id));
  },
};
