/**
 * services/pdfService.ts — PDF generation for estimates and invoices.
 *
 * Uses expo-print to render HTML → PDF file, expo-sharing to share/save.
 * Both packages degrade gracefully if not installed (falls back to text share).
 *
 * To install:  npx expo install expo-print expo-sharing
 */

import { Share } from 'react-native';
import { Estimate, Invoice, BusinessProfile, INVOICE_STATUS_LABELS } from '../models/types';

// Dynamic require — app won't crash if packages aren't installed yet
let Print: any = null;
let Sharing: any = null;
try { Print = require('expo-print'); } catch {}
try { Sharing = require('expo-sharing'); } catch {}

// ─── Public API ──────────────────────────────────────────────────────────────

export type PdfResult =
  | { ok: true; fileUri: string }
  | { ok: false; error: string };

/** Check whether PDF generation is available. */
export function isPdfAvailable(): boolean {
  return Print !== null;
}

/** Check whether native file sharing is available. */
export async function isSharingAvailable(): Promise<boolean> {
  if (!Sharing) return false;
  try { return await Sharing.isAvailableAsync(); } catch { return false; }
}

/** Generate a PDF for an estimate. Returns file URI on success. */
export async function generateEstimatePdf(
  estimate: Estimate,
  profile: BusinessProfile,
): Promise<PdfResult> {
  if (!Print) {
    return { ok: false, error: 'expo-print not installed. Run: npx expo install expo-print' };
  }
  try {
    const html = buildEstimateHtml(estimate, profile);
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    return { ok: true, fileUri: uri };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'PDF generation failed' };
  }
}

/** Generate a PDF for an invoice. Returns file URI on success. */
export async function generateInvoicePdf(
  invoice: Invoice,
  profile: BusinessProfile,
): Promise<PdfResult> {
  if (!Print) {
    return { ok: false, error: 'expo-print not installed. Run: npx expo install expo-print' };
  }
  try {
    const html = buildInvoiceHtml(invoice, profile);
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    return { ok: true, fileUri: uri };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'PDF generation failed' };
  }
}

/** Share a PDF file via native share sheet (save to files, AirDrop, etc). */
export async function sharePdf(fileUri: string, dialogTitle: string): Promise<void> {
  if (Sharing) {
    const available = await Sharing.isAvailableAsync();
    if (available) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/pdf',
        dialogTitle,
        UTI: 'com.adobe.pdf',
      });
      return;
    }
  }
  // Fallback — can't share file, tell user
  await Share.share({ title: dialogTitle, message: `${dialogTitle} — PDF saved locally.` });
}

// ─── HTML helpers ────────────────────────────────────────────────────────────

function esc(s: string | undefined | null): string {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtMoney(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string | undefined | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ─── Shared CSS ──────────────────────────────────────────────────────────────

const SHARED_CSS = `
  @page { margin: 0.6in; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    font-size: 12px; color: #1e293b; line-height: 1.5;
    padding: 0;
  }
  .header {
    display: flex; justify-content: space-between; align-items: flex-start;
    padding-bottom: 20px; border-bottom: 2px solid #1e3a5f; margin-bottom: 24px;
  }
  .header-left { max-width: 60%; }
  .header-right { text-align: right; }
  .biz-name { font-size: 20px; font-weight: 800; color: #1e3a5f; margin-bottom: 4px; }
  .biz-detail { font-size: 11px; color: #475569; line-height: 1.6; }
  .doc-type { font-size: 26px; font-weight: 800; color: #1e3a5f; letter-spacing: 1px; text-transform: uppercase; }
  .doc-number { font-size: 13px; color: #475569; margin-top: 4px; }
  .doc-date { font-size: 11px; color: #64748b; margin-top: 2px; }
  .status-badge {
    display: inline-block; padding: 3px 10px; border-radius: 4px;
    font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px;
    margin-top: 6px;
  }
  .section-title {
    font-size: 10px; font-weight: 700; color: #64748b; letter-spacing: 1.2px;
    text-transform: uppercase; margin-top: 24px; margin-bottom: 8px;
    border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;
  }
  .client-block { margin-bottom: 20px; }
  .client-name { font-size: 15px; font-weight: 700; color: #0f172a; }
  .client-detail { font-size: 11px; color: #475569; line-height: 1.6; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th {
    background: #f1f5f9; text-align: left; padding: 8px 10px;
    font-size: 10px; font-weight: 700; color: #475569; letter-spacing: 0.8px;
    text-transform: uppercase; border-bottom: 2px solid #e2e8f0;
  }
  th.right, td.right { text-align: right; }
  td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; font-size: 12px; color: #1e293b; }
  tr:nth-child(even) td { background: #fafbfc; }
  .totals-block { margin-left: auto; width: 260px; margin-top: 16px; }
  .totals-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 12px; }
  .totals-row.final {
    border-top: 2px solid #1e3a5f; margin-top: 4px; padding-top: 8px;
    font-size: 16px; font-weight: 800; color: #0f172a;
  }
  .totals-label { color: #475569; }
  .totals-value { font-weight: 600; color: #1e293b; }
  .notes-block { margin-top: 20px; padding: 12px; background: #f8fafc; border-radius: 4px; border: 1px solid #e2e8f0; }
  .notes-label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
  .notes-text { font-size: 11px; color: #334155; line-height: 1.6; white-space: pre-wrap; }
  .footer {
    margin-top: 32px; padding-top: 12px; border-top: 1px solid #e2e8f0;
    font-size: 10px; color: #94a3b8; text-align: center; line-height: 1.6;
  }
  .footer-terms { margin-bottom: 8px; font-size: 10px; color: #64748b; text-align: left; white-space: pre-wrap; }
`;

// ─── Status badge colors ─────────────────────────────────────────────────────

const EST_STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  draft:    { bg: '#f1f5f9', color: '#475569', label: 'Draft' },
  pending:  { bg: '#fef3c7', color: '#92400e', label: 'Pending' },
  accepted: { bg: '#d1fae5', color: '#065f46', label: 'Accepted' },
  rejected: { bg: '#fee2e2', color: '#991b1b', label: 'Rejected' },
};

const INV_STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  draft:          { bg: '#f1f5f9', color: '#475569' },
  sent:           { bg: '#fef3c7', color: '#92400e' },
  partially_paid: { bg: '#e0e7ff', color: '#3730a3' },
  paid:           { bg: '#d1fae5', color: '#065f46' },
  overdue:        { bg: '#fee2e2', color: '#991b1b' },
  void:           { bg: '#fee2e2', color: '#991b1b' },
};

// ─── Business header block ───────────────────────────────────────────────────

function businessHeaderHtml(profile: BusinessProfile, docType: string, docNumber: string, date: string, statusHtml: string): string {
  const details: string[] = [];
  if (profile.address) details.push(esc(profile.address));
  if (profile.phone) details.push(esc(profile.phone));
  if (profile.email) details.push(esc(profile.email));
  if (profile.website) details.push(esc(profile.website));

  return `
    <div class="header">
      <div class="header-left">
        <div class="biz-name">${esc(profile.businessName) || 'EstimateOS'}</div>
        <div class="biz-detail">${details.join('<br>')}</div>
      </div>
      <div class="header-right">
        <div class="doc-type">${esc(docType)}</div>
        <div class="doc-number">${esc(docNumber)}</div>
        <div class="doc-date">${esc(date)}</div>
        ${statusHtml}
      </div>
    </div>
  `;
}

// ─── Client block ────────────────────────────────────────────────────────────

function clientBlockHtml(customer: { name: string; phone?: string; email?: string; address?: string }): string {
  const details: string[] = [];
  if (customer.address) details.push(esc(customer.address));
  if (customer.phone) details.push(esc(customer.phone));
  if (customer.email) details.push(esc(customer.email));

  return `
    <div class="section-title">Prepared For</div>
    <div class="client-block">
      <div class="client-name">${esc(customer.name)}</div>
      <div class="client-detail">${details.join('<br>')}</div>
    </div>
  `;
}

// ─── Estimate HTML ───────────────────────────────────────────────────────────

function buildEstimateHtml(estimate: Estimate, profile: BusinessProfile): string {
  const sc = EST_STATUS_COLORS[estimate.status] ?? EST_STATUS_COLORS.draft;
  const statusHtml = `<div class="status-badge" style="background:${sc.bg};color:${sc.color};">${sc.label}</div>`;

  const activeDrivers = estimate.drivers.filter(d => !d.disabled);
  const materials = estimate.materialLineItems ?? [];
  const materialsTotal = materials.reduce((s, m) => s + m.unitCost * m.quantity, 0);
  const rangeMin = (estimate.computedRange?.min ?? 0) + materialsTotal;
  const rangeMax = (estimate.computedRange?.max ?? 0) + materialsTotal;

  // Line items table
  let driversHtml = '';
  if (activeDrivers.length > 0) {
    const rows = activeDrivers.map(d => {
      const lo = d.overrideMin ?? d.minImpact;
      const hi = d.overrideMax ?? d.maxImpact;
      return `<tr><td>${esc(d.label)}</td><td class="right">$${fmtMoney(lo)} – $${fmtMoney(hi)}</td></tr>`;
    }).join('');
    driversHtml = `
      <div class="section-title">Line Items</div>
      <table>
        <thead><tr><th>Description</th><th class="right">Estimate Range</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  // Materials table
  let materialsHtml = '';
  if (materials.length > 0) {
    const rows = materials.map(m => {
      const total = m.unitCost * m.quantity;
      return `<tr>
        <td>${esc(m.name)}</td>
        <td class="right">${m.quantity} ${esc(m.unit)}</td>
        <td class="right">$${fmtMoney(m.unitCost)}</td>
        <td class="right">$${fmtMoney(total)}</td>
      </tr>`;
    }).join('');
    materialsHtml = `
      <div class="section-title">Materials</div>
      <table>
        <thead><tr><th>Material</th><th class="right">Qty</th><th class="right">Unit Price</th><th class="right">Total</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  // Totals
  let totalsHtml = `
    <div class="totals-block">
      <div class="totals-row">
        <span class="totals-label">Service Range</span>
        <span class="totals-value">$${fmtMoney(estimate.computedRange?.min ?? 0)} – $${fmtMoney(estimate.computedRange?.max ?? 0)}</span>
      </div>
  `;
  if (materialsTotal > 0) {
    totalsHtml += `
      <div class="totals-row">
        <span class="totals-label">Materials</span>
        <span class="totals-value">$${fmtMoney(materialsTotal)}</span>
      </div>
    `;
  }
  totalsHtml += `
      <div class="totals-row final">
        <span>Total Estimated Range</span>
        <span>$${fmtMoney(rangeMin)} – $${fmtMoney(rangeMax)}</span>
      </div>
    </div>
  `;

  // Disclaimer
  const disclaimerHtml = estimate.disclaimerText
    ? `<div class="notes-block"><div class="notes-label">Disclaimer</div><div class="notes-text">${esc(estimate.disclaimerText)}</div></div>`
    : '';

  // Footer with terms
  const termsHtml = profile.termsAndConditions
    ? `<div class="footer-terms">${esc(profile.termsAndConditions)}</div>`
    : '';

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>${SHARED_CSS}</style></head>
<body>
  ${businessHeaderHtml(profile, 'Estimate', estimate.estimateNumber ?? '', fmtDate(estimate.createdAt), statusHtml)}
  ${clientBlockHtml(estimate.customer)}
  ${driversHtml}
  ${materialsHtml}
  ${totalsHtml}
  ${disclaimerHtml}
  <div class="footer">
    ${termsHtml}
    Generated by EstimateOS
  </div>
</body></html>`;
}

// ─── Invoice HTML ────────────────────────────────────────────────────────────

function buildInvoiceHtml(invoice: Invoice, profile: BusinessProfile): string {
  const statusLabel = INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status;
  const sc = INV_STATUS_COLORS[invoice.status] ?? INV_STATUS_COLORS.draft;
  const statusHtml = `<div class="status-badge" style="background:${sc.bg};color:${sc.color};">${esc(statusLabel)}</div>`;

  const subtotal = invoice.lineItems.reduce((sum, li) => sum + li.unitCost * li.quantity, 0);
  const taxRate = invoice.taxRate ?? 0;
  const taxAmt = subtotal * taxRate;
  const discountAmt = invoice.discountAmount ?? 0;
  const total = subtotal + taxAmt - discountAmt;
  const amountPaid = invoice.amountPaid ?? 0;
  const remaining = Math.max(0, total - amountPaid);

  // Line items table
  const itemRows = invoice.lineItems.map(li => {
    const lineTotal = li.unitCost * li.quantity;
    return `<tr>
      <td>${esc(li.label)}</td>
      <td class="right">${li.quantity}</td>
      <td class="right">$${fmtMoney(li.unitCost)}</td>
      <td class="right">$${fmtMoney(lineTotal)}</td>
    </tr>`;
  }).join('');

  const itemsHtml = `
    <div class="section-title">Line Items</div>
    <table>
      <thead><tr><th>Description</th><th class="right">Qty</th><th class="right">Unit Price</th><th class="right">Amount</th></tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
  `;

  // Totals
  let totalsHtml = `
    <div class="totals-block">
      <div class="totals-row">
        <span class="totals-label">Subtotal</span>
        <span class="totals-value">$${fmtMoney(subtotal)}</span>
      </div>
  `;
  if (discountAmt > 0) {
    totalsHtml += `
      <div class="totals-row">
        <span class="totals-label">Discount</span>
        <span class="totals-value">-$${fmtMoney(discountAmt)}</span>
      </div>
    `;
  }
  if (taxRate > 0) {
    totalsHtml += `
      <div class="totals-row">
        <span class="totals-label">Tax (${Math.round(taxRate * 100)}%)</span>
        <span class="totals-value">$${fmtMoney(taxAmt)}</span>
      </div>
    `;
  }
  totalsHtml += `
      <div class="totals-row final">
        <span>Total</span>
        <span>$${fmtMoney(total)}</span>
      </div>
  `;
  if (amountPaid > 0) {
    totalsHtml += `
      <div class="totals-row" style="margin-top:4px;">
        <span class="totals-label" style="color:#16a34a;">Amount Paid</span>
        <span class="totals-value" style="color:#16a34a;">-$${fmtMoney(amountPaid)}</span>
      </div>
      <div class="totals-row" style="font-weight:700;font-size:14px;">
        <span style="color:${invoice.status === 'overdue' ? '#dc2626' : '#0f172a'};">Balance Due</span>
        <span style="color:${invoice.status === 'overdue' ? '#dc2626' : '#0f172a'};">$${fmtMoney(remaining)}</span>
      </div>
    `;
  }
  totalsHtml += '</div>';

  // Payment history
  let paymentHistoryHtml = '';
  const events = invoice.paymentEvents ?? [];
  if (events.length > 0) {
    const rows = events.map(evt => `<tr>
      <td>${fmtDate(evt.recordedAt)}</td>
      <td>${esc(evt.method) || '—'}</td>
      <td class="right">$${fmtMoney(evt.amount)}</td>
      <td>${esc(evt.note) || ''}</td>
    </tr>`).join('');
    paymentHistoryHtml = `
      <div class="section-title">Payment History</div>
      <table>
        <thead><tr><th>Date</th><th>Method</th><th class="right">Amount</th><th>Note</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  // Notes
  const notesHtml = invoice.notes
    ? `<div class="notes-block"><div class="notes-label">Notes</div><div class="notes-text">${esc(invoice.notes)}</div></div>`
    : '';

  // Payment terms block
  const termsRow = `<div style="margin-top:12px;font-size:11px;color:#475569;"><strong>Payment Terms:</strong> ${esc(invoice.paymentTerms)}</div>`;

  // Footer with business terms
  const businessTermsHtml = profile.termsAndConditions
    ? `<div class="footer-terms">${esc(profile.termsAndConditions)}</div>`
    : '';

  // Dates line in header-right
  let dateLines = `<div class="doc-date">${fmtDate(invoice.createdAt)}</div>`;
  if (invoice.dueDate) dateLines += `<div class="doc-date">Due: ${fmtDate(invoice.dueDate)}</div>`;
  if (invoice.sentAt) dateLines += `<div class="doc-date">Sent: ${fmtDate(invoice.sentAt)}</div>`;
  if (invoice.paidAt) dateLines += `<div class="doc-date">Paid: ${fmtDate(invoice.paidAt)}</div>`;

  // Build header manually for invoice (needs extra date lines)
  const bizDetails: string[] = [];
  if (profile.address) bizDetails.push(esc(profile.address));
  if (profile.phone) bizDetails.push(esc(profile.phone));
  if (profile.email) bizDetails.push(esc(profile.email));
  if (profile.website) bizDetails.push(esc(profile.website));

  const headerHtml = `
    <div class="header">
      <div class="header-left">
        <div class="biz-name">${esc(profile.businessName) || 'EstimateOS'}</div>
        <div class="biz-detail">${bizDetails.join('<br>')}</div>
      </div>
      <div class="header-right">
        <div class="doc-type">Invoice</div>
        <div class="doc-number">${esc(invoice.invoiceNumber)}</div>
        ${dateLines}
        ${statusHtml}
      </div>
    </div>
  `;

  // Client block for invoice says "Bill To"
  const clientDetails: string[] = [];
  if (invoice.customer.address) clientDetails.push(esc(invoice.customer.address));
  if (invoice.customer.phone) clientDetails.push(esc(invoice.customer.phone));
  if (invoice.customer.email) clientDetails.push(esc(invoice.customer.email));

  const clientHtml = `
    <div class="section-title">Bill To</div>
    <div class="client-block">
      <div class="client-name">${esc(invoice.customer.name)}</div>
      <div class="client-detail">${clientDetails.join('<br>')}</div>
    </div>
  `;

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>${SHARED_CSS}</style></head>
<body>
  ${headerHtml}
  ${clientHtml}
  ${itemsHtml}
  ${totalsHtml}
  ${termsRow}
  ${paymentHistoryHtml}
  ${notesHtml}
  <div class="footer">
    ${businessTermsHtml}
    Thank you for your business!
  </div>
</body></html>`;
}
