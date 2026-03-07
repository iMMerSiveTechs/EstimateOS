// ─── Invoice storage (Firestore-backed) ───────────────────────────────────
// users/{uid}/invoices/{invoiceId}

import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc,
  query, orderBy, where, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { Invoice } from '../models/types';

function uid(): string {
  const user = auth.currentUser;
  if (!user) throw new Error('InvoiceRepository: user is not signed in');
  return user.uid;
}

function col() { return collection(db, 'users', uid(), 'invoices'); }
function ref(id: string) { return doc(db, 'users', uid(), 'invoices', id); }

function deserialize(data: Record<string, any>): Invoice {
  const ts = (v: any) =>
    v instanceof Timestamp ? v.toDate().toISOString() : (v ?? new Date().toISOString());
  return {
    ...data,
    createdAt: ts(data.createdAt),
    updatedAt: ts(data.updatedAt),
    sentAt:    data.sentAt    ? ts(data.sentAt)    : undefined,
    paidAt:    data.paidAt    ? ts(data.paidAt)    : undefined,
    voidedAt:  data.voidedAt  ? ts(data.voidedAt)  : undefined,
    // Phase 12: payment events array (safe default)
    paymentEvents: data.paymentEvents ?? [],
    amountPaid:    data.amountPaid    ?? 0,
  } as Invoice;
}

export const InvoiceRepository = {
  async getInvoice(id: string): Promise<Invoice | null> {
    const snap = await getDoc(ref(id));
    return snap.exists() ? deserialize(snap.data()) : null;
  },

  async upsertInvoice(invoice: Invoice): Promise<void> {
    await setDoc(ref(invoice.id), { ...invoice, updatedAt: serverTimestamp() });
  },

  async listInvoices(): Promise<Invoice[]> {
    const q = query(col(), orderBy('updatedAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => deserialize(d.data()));
  },

  async listByEstimate(estimateId: string): Promise<Invoice[]> {
    const q = query(col(), where('estimateId', '==', estimateId));
    const snap = await getDocs(q);
    return snap.docs.map(d => deserialize(d.data()));
  },

  async listByCustomer(customerId: string): Promise<Invoice[]> {
    const q = query(col(), where('customerId', '==', customerId), orderBy('updatedAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => deserialize(d.data()));
  },

  async deleteInvoice(id: string): Promise<void> {
    await deleteDoc(ref(id));
  },
};
