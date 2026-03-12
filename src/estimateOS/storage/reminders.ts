// ─── Reminders storage (Field OS) ─────────────────────────────────────────────
// users/{uid}/reminders/{id}

import {
  collection, doc, getDocs, setDoc, deleteDoc,
  query, orderBy, where, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { Reminder } from '../models/types';
import { makeId } from '../domain/id';

function uid(): string {
  const user = auth.currentUser;
  if (!user) throw new Error('reminders: user is not signed in');
  return user.uid;
}

function remCol() { return collection(db, 'users', uid(), 'reminders'); }
function remRef(id: string) { return doc(db, 'users', uid(), 'reminders', id); }

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

function deserReminder(data: Record<string, any>): Reminder {
  return {
    ...data,
    createdAt: ts(data.createdAt),
    updatedAt: ts(data.updatedAt),
    completedAt: data.completedAt ? ts(data.completedAt) : undefined,
  } as Reminder;
}

export const ReminderRepository = {
  async upsertReminder(reminder: Reminder): Promise<void> {
    await setDoc(remRef(reminder.id), { ...deepStripUndefined(reminder), updatedAt: serverTimestamp() });
  },

  async listReminders(): Promise<Reminder[]> {
    const q = query(remCol(), orderBy('dueDate', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => deserReminder(d.data()));
  },

  async listByCustomer(customerId: string): Promise<Reminder[]> {
    const q = query(remCol(), where('customerId', '==', customerId), orderBy('dueDate', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => deserReminder(d.data()));
  },

  async listByEstimate(estimateId: string): Promise<Reminder[]> {
    const q = query(remCol(), where('estimateId', '==', estimateId), orderBy('dueDate', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => deserReminder(d.data()));
  },

  async listPending(): Promise<Reminder[]> {
    const q = query(remCol(), where('completed', '==', false), orderBy('dueDate', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => deserReminder(d.data()));
  },

  async completeReminder(id: string): Promise<void> {
    await setDoc(remRef(id), {
      completed: true,
      completedAt: new Date().toISOString(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  },

  async deleteReminder(id: string): Promise<void> {
    await deleteDoc(remRef(id));
  },

  makeNew(partial: Partial<Reminder>): Reminder {
    const now = new Date().toISOString();
    return {
      id: makeId(),
      type: 'estimate_followup',
      dueDate: now.slice(0, 10),
      note: '',
      completed: false,
      createdAt: now,
      updatedAt: now,
      ...partial,
    };
  },
};
