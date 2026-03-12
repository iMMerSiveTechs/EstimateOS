// ─── Timeline events storage (Customer OS) ────────────────────────────────────
// users/{uid}/timeline/{id}

import {
  collection, doc, getDocs, setDoc,
  query, orderBy, where, Timestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { TimelineEvent } from '../models/types';
import { makeId } from '../domain/id';

function uid(): string {
  const user = auth.currentUser;
  if (!user) throw new Error('timeline: user is not signed in');
  return user.uid;
}

function tlCol() { return collection(db, 'users', uid(), 'timeline'); }

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

function deserTimeline(data: Record<string, any>): TimelineEvent {
  return { ...data, createdAt: ts(data.createdAt) } as TimelineEvent;
}

export const TimelineRepository = {
  async appendEvent(event: Omit<TimelineEvent, 'id' | 'createdAt'>): Promise<TimelineEvent> {
    const id = makeId();
    const now = new Date().toISOString();
    const full: TimelineEvent = { ...event, id, createdAt: now };
    await setDoc(doc(db, 'users', uid(), 'timeline', id), deepStripUndefined(full));
    return full;
  },

  async listByCustomer(customerId: string): Promise<TimelineEvent[]> {
    const q = query(tlCol(), where('customerId', '==', customerId), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => deserTimeline(d.data()));
  },
};
