// ─── Communication templates storage ─────────────────────────────────────────
// users/{uid}/commTemplates/{id}
// Falls back to bundled defaults when no user templates exist.

import {
  collection, doc, getDocs, setDoc, deleteDoc,
  serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { CommTemplate, CommTemplateType } from '../models/types';
import { makeId } from '../domain/id';

function uid(): string {
  const user = auth.currentUser;
  if (!user) throw new Error('commTemplates: user is not signed in');
  return user.uid;
}

function col() { return collection(db, 'users', uid(), 'commTemplates'); }
function ref(id: string) { return doc(db, 'users', uid(), 'commTemplates', id); }

function ts(v: any): string {
  return v instanceof Timestamp ? v.toDate().toISOString() : (v ?? new Date().toISOString());
}

function deserialize(data: Record<string, any>): CommTemplate {
  return { ...data, updatedAt: ts(data.updatedAt) } as CommTemplate;
}

// ─── Bundled defaults ─────────────────────────────────────────────────────────

const NOW = new Date().toISOString();

export const DEFAULT_COMM_TEMPLATES: CommTemplate[] = [
  {
    id: 'default_estimate_send',
    name: 'Send Estimate',
    type: 'estimate_send',
    subject: 'Your estimate — {estimate_number}',
    body: `Hi {customer_name},

Thank you for the opportunity to provide an estimate for your property at {address}.

Your estimated range: {price_range}

Please find the full estimate details attached. If you have any questions or would like to discuss the scope of work, please don't hesitate to reach out.

We look forward to working with you.

Best regards,
{business_name}`,
    isDefault: true,
    updatedAt: NOW,
  },
  {
    id: 'default_invoice_send',
    name: 'Send Invoice',
    type: 'invoice_send',
    subject: 'Invoice from {business_name} — {invoice_number}',
    body: `Hi {customer_name},

Please find your invoice attached for the work completed at {address}.

Invoice: {invoice_number}
Total: {invoice_total}

Payment terms: {payment_terms}

If you have any questions about this invoice, please don't hesitate to contact us.

Thank you for your business,
{business_name}`,
    isDefault: true,
    updatedAt: NOW,
  },
  {
    id: 'default_estimate_followup',
    name: 'Estimate Follow-up',
    type: 'estimate_followup',
    subject: 'Following up on your estimate — {estimate_number}',
    body: `Hi {customer_name},

I wanted to follow up on the estimate we prepared for your property at {address}.

Your estimate range: {price_range}

Please let me know if you have any questions or if you'd like to move forward. We're happy to walk you through the scope of work in detail.

Best,
{business_name}`,
    isDefault: true,
    updatedAt: NOW,
  },
  {
    id: 'default_appointment_reminder',
    name: 'Appointment Reminder',
    type: 'appointment_reminder',
    subject: 'Reminder: Your upcoming appointment',
    body: `Hi {customer_name},

This is a friendly reminder about your upcoming appointment at {address}.

If you need to reschedule or have any questions before we arrive, please don't hesitate to reach out.

Thank you,
{business_name}`,
    isDefault: true,
    updatedAt: NOW,
  },
  {
    id: 'default_checkin',
    name: 'Check-in',
    type: 'checkin',
    subject: 'Checking in — {customer_name}',
    body: `Hi {customer_name},

I just wanted to check in to see if you have any questions about your estimate or if you're ready to move forward.

We're here whenever you're ready.

Best,
{business_name}`,
    isDefault: true,
    updatedAt: NOW,
  },
  {
    id: 'default_invoice_reminder',
    name: 'Invoice Reminder',
    type: 'invoice_reminder',
    subject: 'Invoice ready — {business_name}',
    body: `Hi {customer_name},

This is a friendly reminder that your invoice is ready for review.

If you have any questions about the charges or payment options, please feel free to reach out.

Thank you for your business,
{business_name}`,
    isDefault: true,
    updatedAt: NOW,
  },
  {
    id: 'default_payment_reminder',
    name: 'Payment Reminder',
    type: 'payment_reminder',
    subject: 'Payment reminder — {invoice_number}',
    body: `Hi {customer_name},

This is a friendly reminder that your invoice {invoice_number} has a remaining balance of {balance_due}.

Please let us know if you have any questions about the invoice or need to discuss payment arrangements.

Thank you,
{business_name}`,
    isDefault: true,
    updatedAt: NOW,
  },
  {
    id: 'default_missed_call',
    name: 'Missed Call Callback',
    type: 'missed_call',
    subject: 'Returning your call — {business_name}',
    body: `Hi {customer_name},

I noticed I missed your call and wanted to follow up as quickly as possible.

Please call or text us back at your convenience, or reply to this message and we'll get right back to you.

Thank you,
{business_name}`,
    isDefault: true,
    updatedAt: NOW,
  },
];

// ─── Repository ────────────────────────────────────────────────────────────────

export const CommTemplateRepository = {
  /** Load user templates, falling back to defaults if none saved yet. */
  async listTemplates(): Promise<CommTemplate[]> {
    try {
      const snap = await getDocs(col());
      if (snap.empty) return [...DEFAULT_COMM_TEMPLATES];
      return snap.docs.map(d => deserialize(d.data()));
    } catch {
      return [...DEFAULT_COMM_TEMPLATES];
    }
  },

  async upsertTemplate(template: CommTemplate): Promise<void> {
    await setDoc(ref(template.id), { ...template, updatedAt: serverTimestamp() });
  },

  async deleteTemplate(id: string): Promise<void> {
    await deleteDoc(ref(id));
  },

  /** Seed all defaults if none exist (call once on first use). */
  async seedDefaults(): Promise<void> {
    try {
      const snap = await getDocs(col());
      if (!snap.empty) return;
      for (const t of DEFAULT_COMM_TEMPLATES) {
        await setDoc(ref(t.id), { ...t, updatedAt: serverTimestamp() });
      }
    } catch { /* non-fatal */ }
  },

  makeNew(type: CommTemplateType = 'checkin'): CommTemplate {
    return {
      id: makeId(),
      name: '',
      type,
      subject: '',
      body: '',
      isDefault: false,
      updatedAt: new Date().toISOString(),
    };
  },
};

// ─── Template merge-field filler ──────────────────────────────────────────────

export interface CommTemplateVars {
  customer_name?: string;
  business_name?: string;
  estimate_number?: string;
  price_range?: string;
  address?: string;
  invoice_number?: string;
  invoice_total?: string;
  payment_terms?: string;
  balance_due?: string;
}

export function fillCommTemplate(
  body: string,
  vars: CommTemplateVars,
): string {
  return body.replace(/\{(\w+)\}/g, (_, key) => (vars as Record<string, string>)[key] ?? `{${key}}`);
}
