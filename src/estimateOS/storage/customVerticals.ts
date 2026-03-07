// ─── Custom verticals (Firestore-backed) ──────────────────────────────────
// User-created verticals stored under users/{uid}/customVerticals/{verticalId}.
// mergeVerticals() is a pure function kept separate from the async I/O.

import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { VerticalConfig } from '../models/types';

function uid(): string {
  const user = auth.currentUser;
  if (!user) throw new Error('customVerticals: user is not signed in');
  return user.uid;
}

function verticalsCol() {
  return collection(db, 'users', uid(), 'customVerticals');
}

export async function loadCustomVerticals(): Promise<VerticalConfig[]> {
  const snap = await getDocs(verticalsCol());
  return snap.docs.map((d) => ({ ...d.data(), id: d.id } as VerticalConfig));
}

export async function saveCustomVertical(vertical: VerticalConfig): Promise<void> {
  const ref = doc(verticalsCol(), vertical.id);
  await setDoc(ref, { ...vertical, isCustom: true, updatedAt: serverTimestamp() });
}

export async function deleteCustomVertical(verticalId: string): Promise<void> {
  await deleteDoc(doc(verticalsCol(), verticalId));
}

// Pure merge — built-in verticals + user-created, custom ones override by id
export function mergeVerticals(
  builtIn: VerticalConfig[],
  custom: VerticalConfig[],
): VerticalConfig[] {
  const map = new Map<string, VerticalConfig>(builtIn.map((v) => [v.id, v]));
  for (const v of custom) {
    map.set(v.id, v);
  }
  return Array.from(map.values());
}
