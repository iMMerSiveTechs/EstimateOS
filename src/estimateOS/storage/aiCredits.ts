// ─── AI credits + analysis history (Firestore-backed) ─────────────────────
// Credit balance: users/{uid}/credits/balance
// Analysis history: users/{uid}/analysisHistory/{recordId}
//
// In Phase 0 (demo), credits are never deducted.
// deductCredit() is wired for Phase 2 when the real AI backend goes live.

import {
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { CreditBalance, AnalysisRecord } from '../models/types';

function uid(): string {
  const user = auth.currentUser;
  if (!user) throw new Error('aiCredits: user is not signed in');
  return user.uid;
}

function balanceDoc() {
  return doc(db, 'users', uid(), 'credits', 'balance');
}

function historyCol() {
  return collection(db, 'users', uid(), 'analysisHistory');
}

export async function getCredits(): Promise<CreditBalance> {
  const snap = await getDoc(balanceDoc());
  if (!snap.exists()) {
    return { balance: 0, updatedAt: new Date().toISOString() };
  }
  const data = snap.data();
  return {
    balance: data.balance ?? 0,
    updatedAt:
      data.updatedAt?.toDate?.().toISOString?.() ?? new Date().toISOString(),
  };
}

// Atomically subtract 1 credit. Throws if balance is 0.
export async function deductCredit(): Promise<void> {
  const { balance } = await getCredits();
  if (balance <= 0) throw new Error('Insufficient AI credits');
  await setDoc(balanceDoc(), { balance: increment(-1), updatedAt: serverTimestamp() }, { merge: true });
}

// Add credits (e.g. after purchase / admin grant)
export async function addCredits(amount: number): Promise<void> {
  await setDoc(balanceDoc(), { balance: increment(amount), updatedAt: serverTimestamp() }, { merge: true });
}

export async function getAnalysisHistory(): Promise<AnalysisRecord[]> {
  const q = query(historyCol(), orderBy('analyzedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AnalysisRecord));
}

export async function appendAnalysisRecord(
  record: Omit<AnalysisRecord, 'id'>,
): Promise<void> {
  await addDoc(historyCol(), { ...record, analyzedAt: serverTimestamp() });
}
