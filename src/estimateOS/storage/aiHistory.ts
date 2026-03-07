// ─── AI scan history (Firestore-backed) ───────────────────────────────────
// Stored under users/{uid}/aiHistory/{estimateId}/records/{recordId}.
// In Phase 0 (demo mode) these functions are NOT called — see
// AiSiteAnalysisScreen which guards writes behind the Phase flag.

import {
  collection,
  doc,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { AiScanRecord } from '../models/types';

function uid(): string {
  const user = auth.currentUser;
  if (!user) throw new Error('aiHistory: user is not signed in');
  return user.uid;
}

function recordsCol(estimateId: string) {
  return collection(db, 'users', uid(), 'aiHistory', estimateId, 'records');
}

export async function getAiHistory(estimateId: string): Promise<AiScanRecord[]> {
  const q = query(recordsCol(estimateId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AiScanRecord));
}

export async function appendAiHistory(record: AiScanRecord): Promise<void> {
  const { id: _id, ...data } = record;
  await addDoc(recordsCol(record.estimateId), {
    ...data,
    createdAt: serverTimestamp(),
  });
}
