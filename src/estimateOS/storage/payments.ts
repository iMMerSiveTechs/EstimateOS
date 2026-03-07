// ─── Payments storage (Firestore-backed) ───────────────────────────────────
// Service payment module — customer payments for real-world service jobs.
// Separate from app monetization (RevenueCat/IAP, future module).
//
// Collections:
//   users/{uid}/paymentRequests/{id}
//   users/{uid}/paymentPlans/{id}

import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc,
  query, orderBy, where, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import {
  PaymentRequest, PaymentPlan, ServicePaymentRecord,
  ServicePaymentStatus, PaymentStageStatus,
} from '../models/types';
import { makeId } from '../domain/id';

function uid(): string {
  const user = auth.currentUser;
  if (!user) throw new Error('PaymentRepository: user is not signed in');
  return user.uid;
}

function reqCol()  { return collection(db, 'users', uid(), 'paymentRequests'); }
function reqRef(id: string) { return doc(db, 'users', uid(), 'paymentRequests', id); }
function planCol() { return collection(db, 'users', uid(), 'paymentPlans'); }
function planRef(id: string) { return doc(db, 'users', uid(), 'paymentPlans', id); }

function tsStr(v: any): string {
  return v instanceof Timestamp ? v.toDate().toISOString() : (v ?? new Date().toISOString());
}

function deserializeRequest(data: Record<string, any>): PaymentRequest {
  return {
    ...data,
    createdAt: tsStr(data.createdAt),
    updatedAt: tsStr(data.updatedAt),
  } as PaymentRequest;
}

function deserializePlan(data: Record<string, any>): PaymentPlan {
  return {
    ...data,
    createdAt: tsStr(data.createdAt),
    updatedAt: tsStr(data.updatedAt),
  } as PaymentPlan;
}

// ─── Payment Requests ─────────────────────────────────────────────────────

export const PaymentRequestRepository = {
  async get(id: string): Promise<PaymentRequest | null> {
    const snap = await getDoc(reqRef(id));
    return snap.exists() ? deserializeRequest(snap.data()) : null;
  },

  async upsert(req: PaymentRequest): Promise<void> {
    await setDoc(reqRef(req.id), { ...req, updatedAt: serverTimestamp() });
  },

  async listAll(): Promise<PaymentRequest[]> {
    const q = query(reqCol(), orderBy('updatedAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => deserializeRequest(d.data()));
  },

  async listByEstimate(estimateId: string): Promise<PaymentRequest[]> {
    const q = query(reqCol(), where('estimateId', '==', estimateId));
    const snap = await getDocs(q);
    return snap.docs.map(d => deserializeRequest(d.data()));
  },

  async listByCustomer(customerId: string): Promise<PaymentRequest[]> {
    const q = query(reqCol(), where('customerId', '==', customerId), orderBy('updatedAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => deserializeRequest(d.data()));
  },

  /** Record a payment against an existing request. Updates amountPaid and status. */
  async recordPayment(
    requestId: string,
    record: Omit<ServicePaymentRecord, 'id' | 'paymentRequestId'>,
  ): Promise<PaymentRequest | null> {
    const req = await this.get(requestId);
    if (!req) return null;

    const newRecord: ServicePaymentRecord = {
      ...record,
      id: makeId(),
      paymentRequestId: requestId,
    };
    const newAmountPaid = (req.amountPaid ?? 0) + record.amount;
    const newStatus: ServicePaymentStatus =
      newAmountPaid >= req.totalDue ? 'paid' : 'partially_paid';

    const updated: PaymentRequest = {
      ...req,
      amountPaid: newAmountPaid,
      payments: [...(req.payments ?? []), newRecord],
      status: newStatus,
      updatedAt: new Date().toISOString(),
    };
    await this.upsert(updated);
    return updated;
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(reqRef(id));
  },
};

// ─── Payment Plans ────────────────────────────────────────────────────────

export const PaymentPlanRepository = {
  async get(id: string): Promise<PaymentPlan | null> {
    const snap = await getDoc(planRef(id));
    return snap.exists() ? deserializePlan(snap.data()) : null;
  },

  async upsert(plan: PaymentPlan): Promise<void> {
    await setDoc(planRef(plan.id), { ...plan, updatedAt: serverTimestamp() });
  },

  async listAll(): Promise<PaymentPlan[]> {
    const q = query(planCol(), orderBy('updatedAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => deserializePlan(d.data()));
  },

  async listByEstimate(estimateId: string): Promise<PaymentPlan[]> {
    const q = query(planCol(), where('estimateId', '==', estimateId));
    const snap = await getDocs(q);
    return snap.docs.map(d => deserializePlan(d.data()));
  },

  async listByCustomer(customerId: string): Promise<PaymentPlan[]> {
    const q = query(planCol(), where('customerId', '==', customerId), orderBy('updatedAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => deserializePlan(d.data()));
  },

  /** Mark a payment stage as paid. Recomputes plan status. */
  async markStagePaid(planId: string, stageId: string): Promise<PaymentPlan | null> {
    const plan = await this.get(planId);
    if (!plan) return null;

    const stages = plan.stages.map(st =>
      st.id === stageId
        ? { ...st, status: 'paid' as PaymentStageStatus, paidAt: new Date().toISOString() }
        : st,
    );

    const allPaid = stages.every(st => st.status === 'paid');
    const updated: PaymentPlan = {
      ...plan,
      stages,
      status: allPaid ? 'completed' : 'active',
      updatedAt: new Date().toISOString(),
    };
    await this.upsert(updated);
    return updated;
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(planRef(id));
  },
};
