// ─── Intake drafts storage (Field OS) ─────────────────────────────────────────
// users/{uid}/intakeDrafts/{id}

import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc,
  query, orderBy, where, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { IntakeDraft } from '../models/types';
import { makeId } from '../domain/id';

function uid(): string {
  const user = auth.currentUser;
  if (!user) throw new Error('intakeDrafts: user is not signed in');
  return user.uid;
}

function intakeCol() { return collection(db, 'users', uid(), 'intakeDrafts'); }
function intakeRef(id: string) { return doc(db, 'users', uid(), 'intakeDrafts', id); }

function ts(v: any): string {
  return v instanceof Timestamp ? v.toDate().toISOString() : (v ?? new Date().toISOString());
}

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

function deserIntake(data: Record<string, any>): IntakeDraft {
  return {
    ...data,
    createdAt: ts(data.createdAt),
    updatedAt: ts(data.updatedAt),
  } as IntakeDraft;
}

export const IntakeDraftRepository = {
  async upsertDraft(draft: IntakeDraft): Promise<void> {
    await setDoc(intakeRef(draft.id), { ...deepStripUndefined(draft), updatedAt: serverTimestamp() });
  },

  async getDraft(id: string): Promise<IntakeDraft | null> {
    const snap = await getDoc(intakeRef(id));
    return snap.exists() ? deserIntake(snap.data()) : null;
  },

  async listDrafts(): Promise<IntakeDraft[]> {
    const q = query(intakeCol(), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => deserIntake(d.data()));
  },

  async listByStatus(status: IntakeDraft['status']): Promise<IntakeDraft[]> {
    const q = query(intakeCol(), where('status', '==', status), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => deserIntake(d.data()));
  },

  async deleteDraft(id: string): Promise<void> {
    await deleteDoc(intakeRef(id));
  },

  makeNew(): IntakeDraft {
    const now = new Date().toISOString();
    return {
      id: makeId(),
      customerName: '',
      phone: '',
      email: '',
      propertyAddress: '',
      serviceType: '',
      urgency: 'flexible',
      notes: '',
      status: 'new',
      followUpStatus: 'lead_new',
      createdAt: now,
      updatedAt: now,
    };
  },
};
