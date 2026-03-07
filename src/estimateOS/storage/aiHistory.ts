// ─── AI scan history (Firestore-backed) ───────────────────────────────────
// Stored under users/{uid}/aiHistory/{estimateId}/records/{recordId}.
// In Phase 0 (demo mode) these functions are NOT called — see
// AiSiteAnalysisScreen which guards writes behind the Phase flag.

import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
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

function deserialize(id: string, data: Record<string, any>): AiScanRecord {
  const ts = (v: any): string =>
    v instanceof Timestamp ? v.toDate().toISOString() : (v ?? new Date().toISOString());
  return {
    id,
    estimateId:       data.estimateId ?? '',
    createdAt:        ts(data.createdAt),
    summary:          data.summary ?? '',
    answersSnapshot:  data.answersSnapshot ?? {},
    evidenceByQuestion: data.evidenceByQuestion ?? {},
  };
}

export async function getAiHistory(estimateId: string): Promise<AiScanRecord[]> {
  const q = query(recordsCol(estimateId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => deserialize(d.id, d.data() as Record<string, any>));
}

export async function appendAiHistory(record: AiScanRecord): Promise<void> {
  const { id: _id, ...data } = record;
  await addDoc(recordsCol(record.estimateId), {
    ...data,
    createdAt: serverTimestamp(),
  });
}
