/**
 * storage/pilotTools.ts — Safe pilot/testing tools for internal use.
 *
 * Provides:
 *   - seedSampleData()  — creates a small set of realistic sample records
 *   - clearPilotData()  — deletes all user data (with confirmation handled by caller)
 *
 * These are admin tools for pilot testing. They are NOT exposed to end users
 * in production — they live under Settings → Pilot Tools.
 */

import { makeId } from '../domain/id';
import { CustomerRepository } from './customers';
import { EstimateRepository } from './repository';
import { InvoiceRepository } from './invoices';
import { ReminderRepository, IntakeDraftRepository } from './workflow';
import { CommTemplateRepository, DEFAULT_COMM_TEMPLATES } from './commTemplates';
import {
  Customer, Estimate, Invoice, IntakeDraft, Reminder,
} from '../models/types';

// ─── Sample data seeding ────────────────────────────────────────────────────

export async function seedSampleData(): Promise<{ customers: number; estimates: number; invoices: number; reminders: number }> {
  const now = new Date().toISOString();
  const yesterday = new Date(Date.now() - 86400000).toISOString();
  const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  // Customers
  const customers: Customer[] = [
    { id: makeId(), name: 'Maria Garcia', phone: '(512) 555-0142', email: 'maria@example.com', address: '1234 Oak Valley Dr, Austin TX 78745', followUpStatus: 'quote_sent', createdAt: threeDaysAgo, updatedAt: yesterday },
    { id: makeId(), name: 'James Wilson', phone: '(512) 555-0198', address: '567 Cedar Ridge Ln, Round Rock TX 78681', followUpStatus: 'lead_new', createdAt: yesterday, updatedAt: yesterday },
    { id: makeId(), name: 'Priya Patel', phone: '(512) 555-0267', email: 'priya.p@example.com', address: '890 Elm Creek Blvd, Pflugerville TX 78660', followUpStatus: 'follow_up_due', nextActionAt: tomorrow, nextActionNote: 'Check if she got HOA approval', createdAt: threeDaysAgo, updatedAt: now },
  ];

  for (const c of customers) await CustomerRepository.upsertCustomer(c);

  // Estimates
  const estimates: Estimate[] = [
    {
      id: makeId(), status: 'pending', estimateNumber: 'EST-0001',
      customerId: customers[0].id,
      customer: { name: customers[0].name, phone: customers[0].phone, email: customers[0].email, address: customers[0].address },
      verticalId: 'roofing', serviceId: 'roof_replacement',
      intakeAnswers: {}, lineItems: [], drivers: [],
      computedRange: { min: 8500, max: 12000, currency: 'USD' },
      photos: [], followUpStatus: 'quote_sent',
      createdAt: threeDaysAgo, updatedAt: yesterday,
    },
    {
      id: makeId(), status: 'draft', estimateNumber: 'EST-0002',
      customerId: customers[2].id,
      customer: { name: customers[2].name, phone: customers[2].phone, email: customers[2].email, address: customers[2].address },
      verticalId: 'roofing', serviceId: 'roof_repair',
      intakeAnswers: {}, lineItems: [], drivers: [],
      computedRange: { min: 1200, max: 2400, currency: 'USD' },
      photos: [], followUpStatus: 'follow_up_due',
      createdAt: yesterday, updatedAt: now,
    },
  ];

  for (const e of estimates) await EstimateRepository.upsertEstimate(e);

  // Invoice
  const invoices: Invoice[] = [
    {
      id: makeId(), invoiceNumber: 'INV-0001',
      estimateId: estimates[0].id, customerId: customers[0].id,
      customer: { name: customers[0].name, phone: customers[0].phone, email: customers[0].email, address: customers[0].address },
      status: 'sent',
      lineItems: [
        { id: makeId(), label: 'Roof replacement — tear-off + install', unitCost: 9500, quantity: 1 },
        { id: makeId(), label: 'Flashing and ridge vent', unitCost: 850, quantity: 1 },
      ],
      taxRate: 0, paymentTerms: 'Due on completion',
      createdAt: yesterday, updatedAt: now,
    },
  ];

  for (const inv of invoices) await InvoiceRepository.upsertInvoice(inv);

  // Reminders
  const reminders: Reminder[] = [
    {
      id: makeId(), customerId: customers[2].id, customerName: customers[2].name,
      estimateId: estimates[1].id,
      type: 'estimate_followup', dueDate: tomorrow,
      note: 'Follow up on roof repair estimate — check HOA approval',
      completed: false, createdAt: now, updatedAt: now,
    },
    {
      id: makeId(), customerId: customers[1].id, customerName: customers[1].name,
      type: 'callback', dueDate: nextWeek,
      note: 'Call back about inspection scheduling',
      completed: false, createdAt: now, updatedAt: now,
    },
  ];

  for (const r of reminders) await ReminderRepository.upsertReminder(r);

  // Ensure default comm templates exist
  await CommTemplateRepository.seedDefaults();

  return { customers: customers.length, estimates: estimates.length, invoices: invoices.length, reminders: reminders.length };
}

// ─── Clear pilot data ─────────────────────────────────────────────────────────

export async function clearPilotData(): Promise<void> {
  // Clear all user-created records
  const [customers, estimates, invoices, reminders, drafts] = await Promise.all([
    CustomerRepository.listCustomers(),
    EstimateRepository.listEstimates(),
    InvoiceRepository.listInvoices(),
    ReminderRepository.listPending(),
    IntakeDraftRepository.listByStatus('new'),
  ]);

  await Promise.all([
    ...customers.map(c => CustomerRepository.deleteCustomer(c.id)),
    ...estimates.map(e => EstimateRepository.deleteEstimate(e.id)),
    ...invoices.map(i => InvoiceRepository.deleteInvoice(i.id)),
    ...reminders.map(r => ReminderRepository.deleteReminder(r.id)),
    ...drafts.map(d => IntakeDraftRepository.deleteIntakeDraft(d.id)),
  ]);
}
