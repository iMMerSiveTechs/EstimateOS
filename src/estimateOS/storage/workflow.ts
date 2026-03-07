// ─── Workflow storage: reminders, timeline events, intake drafts ──────────────
// users/{uid}/reminders/{id}
// users/{uid}/timeline/{id}
// users/{uid}/intakeDrafts/{id}

import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc,
  query, orderBy, where, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { Reminder, TimelineEvent, IntakeDraft } from '../models/types';
import { makeId } from '../domain/id';

function uid(): string {
  const user = auth.currentUser;
  if (!user) throw new Error('workflow: user is not signed in');
  return user.uid;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ts(v: any): string {
  return v instanceof Timestamp ? v.toDate().toISOString() : (v ?? new Date().toISOString());
}

// ─── Reminders ────────────────────────────────────────────────────────────────

function remCol() { return collection(db, 'users', uid(), 'reminders'); }
function remRef(id: string) { return doc(db, 'users', uid(), 'reminders', id); }

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
    await setDoc(remRef(reminder.id), { ...reminder, updatedAt: serverTimestamp() });
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

// ─── Timeline events ──────────────────────────────────────────────────────────

function tlCol() { return collection(db, 'users', uid(), 'timeline'); }

function deserTimeline(data: Record<string, any>): TimelineEvent {
  return { ...data, createdAt: ts(data.createdAt) } as TimelineEvent;
}

export const TimelineRepository = {
  async appendEvent(event: Omit<TimelineEvent, 'id' | 'createdAt'>): Promise<TimelineEvent> {
    const id = makeId();
    const now = new Date().toISOString();
    const full: TimelineEvent = { ...event, id, createdAt: now };
    await setDoc(doc(db, 'users', uid(), 'timeline', id), full);
    return full;
  },

  async listByCustomer(customerId: string): Promise<TimelineEvent[]> {
    const q = query(tlCol(), where('customerId', '==', customerId), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => deserTimeline(d.data()));
  },
};

// ─── Intake drafts ────────────────────────────────────────────────────────────

function intakeCol() { return collection(db, 'users', uid(), 'intakeDrafts'); }
function intakeRef(id: string) { return doc(db, 'users', uid(), 'intakeDrafts', id); }

function deserIntake(data: Record<string, any>): IntakeDraft {
  return {
    ...data,
    createdAt: ts(data.createdAt),
    updatedAt: ts(data.updatedAt),
  } as IntakeDraft;
}

export const IntakeDraftRepository = {
  async upsertDraft(draft: IntakeDraft): Promise<void> {
    await setDoc(intakeRef(draft.id), { ...draft, updatedAt: serverTimestamp() });
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
