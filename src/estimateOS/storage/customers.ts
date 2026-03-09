// ─── Customer storage (Firestore-backed) ──────────────────────────────────
// users/{uid}/customers/{customerId}

import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc,
  query, orderBy, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { Customer } from '../models/types';

function uid(): string {
  const user = auth.currentUser;
  if (!user) throw new Error('CustomerRepository: user is not signed in');
  return user.uid;
}

function col() { return collection(db, 'users', uid(), 'customers'); }
function ref(id: string) { return doc(db, 'users', uid(), 'customers', id); }

function deserialize(data: Record<string, any>): Customer {
  const ts = (v: any) =>
    v instanceof Timestamp ? v.toDate().toISOString() : (v ?? new Date().toISOString());
  return { ...data, createdAt: ts(data.createdAt), updatedAt: ts(data.updatedAt) } as Customer;
}

// Firestore rejects undefined at any nesting level. Recursively strip undefined
// while preserving FieldValue sentinels (serverTimestamp, increment, etc.).
function deepStripUndefined(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (
      v !== null &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      typeof v.toDate !== 'function' &&      // not a Firestore Timestamp
      typeof v._methodName === 'undefined'   // not a FieldValue sentinel
    ) {
      out[k] = deepStripUndefined(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export const CustomerRepository = {
  async getCustomer(id: string): Promise<Customer | null> {
    const snap = await getDoc(ref(id));
    return snap.exists() ? deserialize(snap.data()) : null;
  },

  async upsertCustomer(customer: Customer): Promise<void> {
    await setDoc(ref(customer.id), deepStripUndefined({ ...customer, updatedAt: serverTimestamp() }));
  },

  async listCustomers(): Promise<Customer[]> {
    const q = query(col(), orderBy('name', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => deserialize(d.data()));
  },

  async deleteCustomer(id: string): Promise<void> {
    await deleteDoc(ref(id));
  },
};
