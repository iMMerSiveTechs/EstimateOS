// ─── InvoiceScreen ─────────────────────────────────────────────────────────
import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  SafeAreaView, Alert, ActivityIndicator, Share, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Invoice, InvoiceLineItem, InvoicePaymentEvent, INVOICE_STATUS_LABELS, CommIntent, TimelineEventType } from '../models/types';
import { InvoiceRepository } from '../storage/invoices';
import { getBusinessProfile } from '../storage/settings';
import { TimelineRepository } from '../storage/workflow';
import { createInvoicePaymentEvent } from '../services/paymentProvider';
import { generateInvoicePdf, sharePdf } from '../services/pdfService';
import { intentToTimelineEvent } from '../services/commProvider';
import { CommReviewModal } from '../components/CommReviewModal';
import { makeId } from '../domain/id';
import { T, radii } from '../theme';

// ─── Status badge ─────────────────────────────────────────────────────────

const INV_STATUS: Record<string, { bg: string; border: string; text: string }> = {
  draft:          { bg: T.surface,  border: T.border, text: T.sub     },
  sent:           { bg: T.amberLo,  border: T.amber,  text: T.amberHi },
  partially_paid: { bg: T.indigoLo, border: T.indigo, text: T.indigoHi },
  paid:           { bg: T.greenLo,  border: T.green,  text: T.greenHi },
  overdue:        { bg: T.redLo,    border: T.red,     text: T.red    },
  void:           { bg: T.redLo,    border: T.red,     text: T.red    },
};

function StatusBadge({ status }: { status: string }) {
  const c = INV_STATUS[status] ?? INV_STATUS.draft;
  const label = INVOICE_STATUS_LABELS[status as keyof typeof INVOICE_STATUS_LABELS] ?? status;
  return (
    <View style={[sb.wrap, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text style={[sb.txt, { color: c.text }]}>{label}</Text>
    </View>
  );
}
const sb = StyleSheet.create({
  wrap: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  txt:  { fontSize: 12, fontWeight: '700' },
});

function SectionHeader({ title }: { title: string }) {
  return <Text style={shdr.txt}>{title}</Text>;
}
const shdr = StyleSheet.create({ txt: { color: T.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginTop: 28, marginBottom: 10 } });

// ─── Record Payment Modal ─────────────────────────────────────────────────

const PAYMENT_METHODS = ['Cash', 'Check', 'Card', 'Transfer', 'Other'];

function RecordPaymentModal({ visible, remaining, onClose, onSave }: {
  visible: boolean;
  remaining: number;
  onClose: () => void;
  onSave: (event: Omit<InvoicePaymentEvent, 'id'>) => void;
}) {
  const [amountInput, setAmountInput] = useState('');
  const [method, setMethod] = useState('');
  const [note, setNote] = useState('');
  const [amtErr, setAmtErr] = useState('');

  const reset = () => { setAmountInput(''); setMethod(''); setNote(''); setAmtErr(''); };

  const handleSave = () => {
    const amt = parseFloat(amountInput);
    if (!amountInput.trim() || isNaN(amt) || amt <= 0) { setAmtErr('Enter a valid amount'); return; }
    if (amt > remaining + 0.01) { setAmtErr(`Max amount is $${remaining.toFixed(2)}`); return; }
    onSave({ amount: amt, method: method.trim() || undefined, note: note.trim() || undefined, recordedAt: new Date().toISOString() });
    reset();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { reset(); onClose(); }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={rp.overlay}>
          <View style={rp.sheet}>
            <Text style={rp.title}>Record Payment</Text>
            <Text style={rp.sub}>Remaining balance: ${remaining.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>

            <Text style={rp.label}>Amount *</Text>
            <TextInput
              style={[rp.input, amtErr ? rp.inputErr : null]}
              value={amountInput}
              onChangeText={t => { setAmountInput(t); setAmtErr(''); }}
              placeholder="0.00"
              placeholderTextColor={T.muted}
              keyboardType="decimal-pad"
              autoFocus
            />
            {amtErr ? <Text style={rp.err}>{amtErr}</Text> : null}

            <Text style={rp.label}>Payment Method</Text>
            <View style={rp.methodRow}>
              {PAYMENT_METHODS.map(m => (
                <TouchableOpacity
                  key={m}
                  style={[rp.methodChip, method === m && rp.methodChipActive]}
                  onPress={() => setMethod(prev => prev === m ? '' : m)}
                >
                  <Text style={[rp.methodTxt, method === m && rp.methodTxtActive]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={rp.label}>Note (optional)</Text>
            <TextInput style={rp.input} value={note} onChangeText={setNote} placeholder="Check #, reference, etc." placeholderTextColor={T.muted} />

            <View style={rp.btnRow}>
              <TouchableOpacity style={rp.cancelBtn} onPress={() => { reset(); onClose(); }}>
                <Text style={rp.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={rp.saveBtn} onPress={handleSave}>
                <Text style={rp.saveTxt}>Record</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
const rp = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: T.bg, borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, padding: 24, paddingBottom: 40, borderWidth: 1, borderColor: T.border },
  title: { color: T.text, fontSize: 18, fontWeight: '800', marginBottom: 4 },
  sub: { color: T.sub, fontSize: 13, marginBottom: 16 },
  label: { color: T.textDim, fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: radii.sm, color: T.text, padding: 12, fontSize: 15 },
  inputErr: { borderColor: T.red },
  err: { color: T.red, fontSize: 12, marginTop: 4 },
  methodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  methodChip: { borderWidth: 1, borderColor: T.border, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  methodChipActive: { backgroundColor: T.accent, borderColor: T.accent },
  methodTxt: { color: T.sub, fontSize: 13 },
  methodTxtActive: { color: '#fff', fontWeight: '700' },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: T.border, borderRadius: radii.md, padding: 14, alignItems: 'center' },
  cancelTxt: { color: T.sub, fontWeight: '600', fontSize: 15 },
  saveBtn: { flex: 1, backgroundColor: T.green, borderRadius: radii.md, padding: 14, alignItems: 'center' },
  saveTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

// ─── Main screen ──────────────────────────────────────────────────────────

export function InvoiceScreen({ route, navigation }: any) {
  const { invoiceId } = route?.params ?? {};
  const [invoice, setInvoice]   = useState<Invoice | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [taxInput, setTaxInput] = useState('0');
  const [terms, setTerms]       = useState('Due on receipt');
  const [notes, setNotes]       = useState('');
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [showComm, setShowComm] = useState(false);
  const [commIntent, setCommIntent] = useState<CommIntent>('invoice_send');
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const load = useCallback(async () => {
    if (!invoiceId) return;
    setLoading(true);
    try {
      const inv = await InvoiceRepository.getInvoice(invoiceId);
      if (inv) {
        setInvoice(inv);
        setTaxInput(String(Math.round(inv.taxRate * 100)));
        setTerms(inv.paymentTerms);
        setNotes(inv.notes ?? '');
      }
    } finally { setLoading(false); }
  }, [invoiceId]);

  useFocusEffect(load);

  if (loading) return <SafeAreaView style={s.safe}><ActivityIndicator style={{ marginTop: 60 }} color={T.accent} /></SafeAreaView>;
  if (!invoice) return <SafeAreaView style={s.safe}><Text style={s.notFound}>Invoice not found.</Text></SafeAreaView>;

  const canEdit  = invoice.status === 'draft';
  const isVoided = invoice.status === 'void';
  const canReceivePayment = invoice.status === 'sent' || invoice.status === 'partially_paid' || invoice.status === 'overdue';

  const subtotal    = invoice.lineItems.reduce((sum, li) => sum + li.unitCost * li.quantity, 0);
  const taxRate     = Math.min(1, Math.max(0, Number(taxInput) / 100 || 0));
  const taxAmt      = subtotal * taxRate;
  const discountAmt = invoice.discountAmount ?? 0;
  const total       = subtotal + taxAmt - discountAmt;
  const amountPaid  = invoice.amountPaid ?? 0;
  const remaining   = Math.max(0, total - amountPaid);

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const save = async (patch: Partial<Invoice> = {}) => {
    const updated: Invoice = { ...invoice, ...patch, taxRate, paymentTerms: terms, notes: notes.trim() || undefined, updatedAt: new Date().toISOString() };
    setInvoice(updated);
    await InvoiceRepository.upsertInvoice(updated);
  };

  const markStatus = async (status: Invoice['status']) => {
    setSaving(true);
    const now = new Date().toISOString();
    try {
      await save({
        status,
        sentAt: status === 'sent' ? now : invoice.sentAt,
        paidAt: status === 'paid' ? now : invoice.paidAt,
      });
      if (invoice.customerId && (status === 'sent' || status === 'paid')) {
        await TimelineRepository.appendEvent({
          customerId: invoice.customerId,
          invoiceId: invoice.id,
          estimateId: invoice.estimateId,
          type: status === 'paid' ? 'status_changed' : 'quote_sent',
          note: status === 'sent' ? `Invoice ${invoice.invoiceNumber} sent` : `Invoice ${invoice.invoiceNumber} marked paid`,
        });
      }
    } finally { setSaving(false); }
  };

  const handleRecordPayment = async (event: Omit<InvoicePaymentEvent, 'id'>) => {
    if (!invoice) return;
    const newEvent = createInvoicePaymentEvent(event.amount, event.method, event.note);
    const newAmountPaid = amountPaid + event.amount;
    const newStatus: Invoice['status'] = newAmountPaid >= total - 0.01 ? 'paid' : 'partially_paid';
    const updated: Invoice = {
      ...invoice,
      amountPaid: newAmountPaid,
      paymentEvents: [...(invoice.paymentEvents ?? []), newEvent],
      status: newStatus,
      paidAt: newStatus === 'paid' ? new Date().toISOString() : invoice.paidAt,
      updatedAt: new Date().toISOString(),
    };
    setInvoice(updated);
    await InvoiceRepository.upsertInvoice(updated);
    setShowRecordPayment(false);

    if (invoice.customerId) {
      await TimelineRepository.appendEvent({
        customerId: invoice.customerId,
        invoiceId: invoice.id,
        type: 'payment_received',
        note: `$${fmt(event.amount)} received${event.method ? ` via ${event.method}` : ''}`,
      });
    }
  };

  const markOverdue = async () => {
    await save({ status: 'overdue' });
  };

  const updateLineItem = (idx: number, field: keyof InvoiceLineItem, value: string) => {
    const items = [...invoice.lineItems];
    items[idx] = { ...items[idx], [field]: field === 'label' ? value : Math.max(0, Number(value) || 0) };
    setInvoice(prev => prev ? { ...prev, lineItems: items } : prev);
  };

  const addLineItem = () => {
    const items = [...invoice.lineItems, { id: makeId(), label: 'New item', unitCost: 0, quantity: 1 }];
    setInvoice(prev => prev ? { ...prev, lineItems: items } : prev);
  };

  const removeLineItem = (idx: number) => {
    setInvoice(prev => prev ? { ...prev, lineItems: prev.lineItems.filter((_, i) => i !== idx) } : prev);
  };

  const handleExportPdf = async () => {
    setGeneratingPdf(true);
    try {
      const profile = await getBusinessProfile();
      const result = await generateInvoicePdf(invoice, profile);
      if (result.ok) {
        setPdfUri(result.fileUri);
        await sharePdf(result.fileUri, `Invoice ${invoice.invoiceNumber}`);
      } else {
        Alert.alert('PDF Error', result.error);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not generate PDF.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleSendInvoice = async () => {
    setGeneratingPdf(true);
    try {
      const profile = await getBusinessProfile();
      const result = await generateInvoicePdf(invoice, profile);
      if (result.ok) {
        setPdfUri(result.fileUri);
      }
    } catch { /* PDF optional — continue without */ }
    setGeneratingPdf(false);
    setCommIntent('invoice_send');
    setShowComm(true);
  };

  const handlePaymentReminder = async () => {
    setGeneratingPdf(true);
    try {
      const profile = await getBusinessProfile();
      const result = await generateInvoicePdf(invoice, profile);
      if (result.ok) {
        setPdfUri(result.fileUri);
      }
    } catch { /* PDF optional */ }
    setGeneratingPdf(false);
    setCommIntent('payment_reminder');
    setShowComm(true);
  };

  const handleCommSent = async () => {
    const eventType = intentToTimelineEvent(commIntent) as TimelineEventType;
    if (commIntent === 'invoice_send' && invoice.status === 'draft') {
      await markStatus('sent');
    }
    if (invoice.customerId) {
      await TimelineRepository.appendEvent({
        customerId: invoice.customerId,
        invoiceId: invoice.id,
        estimateId: invoice.estimateId,
        type: eventType,
        note: commIntent === 'invoice_send'
          ? `Invoice ${invoice.invoiceNumber} sent`
          : `Payment reminder for ${invoice.invoiceNumber}`,
      });
    }
    setShowComm(false);
    setPdfUri(null);
  };

  const handleShareText = async () => {
    const { businessName } = await getBusinessProfile();
    const lines = invoice.lineItems.map(li => `  ${li.label}: $${fmt(li.unitCost * li.quantity)}`).join('\n');
    const text = [
      `INVOICE ${invoice.invoiceNumber}`,
      `From: ${businessName || 'EstimateOS'}`,
      `To: ${invoice.customer.name}`,
      `Date: ${new Date(invoice.createdAt).toLocaleDateString()}`,
      `Terms: ${invoice.paymentTerms}`,
      '',
      'LINE ITEMS:',
      lines,
      '',
      `Subtotal: $${fmt(subtotal)}`,
      discountAmt > 0 ? `Discount: -$${fmt(discountAmt)}` : null,
      taxRate > 0 ? `Tax (${Math.round(taxRate * 100)}%): $${fmt(taxAmt)}` : null,
      `TOTAL: $${fmt(total)}`,
      amountPaid > 0 ? `Paid: $${fmt(amountPaid)}` : null,
      amountPaid > 0 ? `Balance Due: $${fmt(remaining)}` : null,
      invoice.notes ? `\nNotes: ${invoice.notes}` : null,
    ].filter(Boolean).join('\n');

    await Share.share({ title: `Invoice ${invoice.invoiceNumber}`, message: text });
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={s.headerCard}>
          <View style={s.headerTop}>
            <StatusBadge status={invoice.status} />
            <Text style={s.invNum}>{invoice.invoiceNumber}</Text>
          </View>
          <Text style={s.customerName}>{invoice.customer.name}</Text>
          {invoice.customer.address && <Text style={s.customerSub}>{invoice.customer.address}</Text>}
          <Text style={s.invDate}>Issued: {new Date(invoice.createdAt).toLocaleDateString()}</Text>
          {invoice.sentAt && <Text style={s.invDate}>Sent: {new Date(invoice.sentAt).toLocaleDateString()}</Text>}
          {invoice.paidAt && <Text style={s.invDate}>Paid: {new Date(invoice.paidAt).toLocaleDateString()}</Text>}
          {invoice.voidedAt && <Text style={[s.invDate, { color: T.red }]}>Voided: {new Date(invoice.voidedAt).toLocaleDateString()}{invoice.voidReason ? ` — ${invoice.voidReason}` : ''}</Text>}
          {invoice.estimateNumber && <Text style={s.invEstRef}>Ref: {invoice.estimateNumber}</Text>}
        </View>

        {/* Payment balance tracker (if any payments recorded or partially paid) */}
        {(amountPaid > 0 || invoice.status === 'overdue') && (
          <View style={s.balanceCard}>
            <View style={s.balanceRow}>
              <Text style={s.balanceLabel}>Total</Text>
              <Text style={s.balanceAmt}>${fmt(total)}</Text>
            </View>
            <View style={s.balanceRow}>
              <Text style={s.balancePaidLabel}>Amount Paid</Text>
              <Text style={s.balancePaidAmt}>–${fmt(amountPaid)}</Text>
            </View>
            <View style={[s.balanceRow, s.balanceRowFinal]}>
              <Text style={s.balanceDueLabel}>Balance Due</Text>
              <Text style={[s.balanceDueAmt, invoice.status === 'overdue' ? { color: T.red } : null]}>
                ${fmt(remaining)}
              </Text>
            </View>
            {/* Progress bar */}
            {total > 0 && (
              <View style={s.progressTrack}>
                <View style={[s.progressBar, { width: `${Math.min(100, (amountPaid / total) * 100)}%` as any }]} />
              </View>
            )}
          </View>
        )}

        {/* Line Items */}
        <SectionHeader title="Line Items" />
        {invoice.lineItems.map((li, idx) => (
          <View key={li.id} style={s.lineRow}>
            {canEdit ? (
              <>
                <TextInput style={[s.lineInput, { flex: 2 }]} value={li.label} onChangeText={v => updateLineItem(idx, 'label', v)} onBlur={() => save()} />
                <TextInput style={[s.lineInput, { width: 70 }]} value={String(li.quantity)} onChangeText={v => updateLineItem(idx, 'quantity', v)} keyboardType="numeric" onBlur={() => save()} />
                <TextInput style={[s.lineInput, { width: 90 }]} value={String(li.unitCost)} onChangeText={v => updateLineItem(idx, 'unitCost', v)} keyboardType="numeric" onBlur={() => save()} />
                <TouchableOpacity onPress={() => removeLineItem(idx)}>
                  <Text style={s.lineDel}>✕</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={[s.lineLabel, { flex: 2 }]} numberOfLines={1}>{li.label}</Text>
                <Text style={s.lineQty}>×{li.quantity}</Text>
                <Text style={s.lineTotal}>${fmt(li.unitCost * li.quantity)}</Text>
              </>
            )}
          </View>
        ))}
        {canEdit && (
          <TouchableOpacity style={s.addLineBtn} onPress={addLineItem}>
            <Text style={s.addLineTxt}>+ Add Line Item</Text>
          </TouchableOpacity>
        )}

        {/* Tax + Terms */}
        <SectionHeader title="Tax & Payment" />
        <View style={s.taxRow}>
          <Text style={s.taxLabel}>Tax rate (%)</Text>
          {canEdit ? (
            <TextInput style={s.taxInput} value={taxInput} onChangeText={setTaxInput} keyboardType="numeric" onBlur={() => save()} />
          ) : (
            <Text style={s.taxValue}>{Math.round(taxRate * 100)}%</Text>
          )}
        </View>
        <Text style={s.fieldLabel}>Payment terms</Text>
        {canEdit ? (
          <TextInput style={s.input} value={terms} onChangeText={setTerms} onBlur={() => save()} placeholder="e.g. Due on receipt, Net 30" placeholderTextColor={T.muted} />
        ) : (
          <Text style={s.fieldValue}>{terms}</Text>
        )}
        <Text style={s.fieldLabel}>Notes</Text>
        {canEdit ? (
          <TextInput style={[s.input, s.inputMulti]} value={notes} onChangeText={setNotes} onBlur={() => save()} placeholder="Optional notes…" placeholderTextColor={T.muted} multiline numberOfLines={3} textAlignVertical="top" />
        ) : (
          notes ? <Text style={s.fieldValue}>{notes}</Text> : <Text style={s.fieldEmpty}>No notes</Text>
        )}

        {/* Totals */}
        <View style={s.totalsCard}>
          <View style={s.totalRow}><Text style={s.totalLabel}>Subtotal</Text><Text style={s.totalAmt}>${fmt(subtotal)}</Text></View>
          {discountAmt > 0 && <View style={s.totalRow}><Text style={s.totalLabel}>Discount</Text><Text style={s.totalAmt}>–${fmt(discountAmt)}</Text></View>}
          {taxRate > 0 && <View style={s.totalRow}><Text style={s.totalLabel}>Tax ({Math.round(taxRate * 100)}%)</Text><Text style={s.totalAmt}>${fmt(taxAmt)}</Text></View>}
          <View style={[s.totalRow, s.totalRowFinal]}><Text style={s.totalFinalLabel}>Total</Text><Text style={s.totalFinalAmt}>${fmt(total)}</Text></View>
        </View>

        {/* Payment history */}
        {(invoice.paymentEvents ?? []).length > 0 && (
          <>
            <SectionHeader title={`Payment History (${invoice.paymentEvents!.length})`} />
            {invoice.paymentEvents!.map((evt) => (
              <View key={evt.id} style={s.paymentEventRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.paymentEventAmt}>+${fmt(evt.amount)}</Text>
                  <Text style={s.paymentEventMeta}>
                    {new Date(evt.recordedAt).toLocaleDateString()}
                    {evt.method ? ` · ${evt.method}` : ''}
                    {evt.note ? ` · ${evt.note}` : ''}
                  </Text>
                </View>
                <View style={s.paymentEventDot} />
              </View>
            ))}
          </>
        )}

        {/* Actions */}
        <SectionHeader title="Actions" />
        <TouchableOpacity style={s.shareBtn} onPress={handleSendInvoice} disabled={generatingPdf}>
          {generatingPdf ? <ActivityIndicator color={T.text} /> : <Text style={s.shareBtnTxt}>📤 Send Invoice</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={[s.shareBtn, { marginTop: 10 }]} onPress={handleExportPdf} disabled={generatingPdf}>
          {generatingPdf ? <ActivityIndicator color={T.text} /> : <Text style={s.shareBtnTxt}>📄 Export PDF</Text>}
        </TouchableOpacity>

        {/* Payment reminder (when sent/partially_paid/overdue) */}
        {canReceivePayment && (
          <TouchableOpacity style={[s.actionBtn, s.actionBtnAmber, { marginTop: 10 }]} onPress={handlePaymentReminder} disabled={generatingPdf}>
            <Text style={[s.actionBtnTxt, { color: T.amberHi }]}>💬 Send Payment Reminder</Text>
          </TouchableOpacity>
        )}

        {/* Draft → Sent (manual status, if not using Send Invoice flow) */}
        {invoice.status === 'draft' && (
          <TouchableOpacity style={[s.actionBtn, { marginTop: 10 }]} onPress={() => markStatus('sent')} disabled={saving}>
            {saving ? <ActivityIndicator color={T.accent} /> : <Text style={s.actionBtnTxt}>Mark as Sent</Text>}
          </TouchableOpacity>
        )}

        {/* Record partial / full payment */}
        {canReceivePayment && (
          <TouchableOpacity style={[s.actionBtn, s.actionBtnGreen, { marginTop: 10 }]} onPress={() => setShowRecordPayment(true)} disabled={saving}>
            <Text style={[s.actionBtnTxt, { color: '#fff' }]}>💵 Record Payment</Text>
          </TouchableOpacity>
        )}

        {/* Quick mark fully paid (when sent/overdue and no partial yet) */}
        {(invoice.status === 'sent' || invoice.status === 'overdue') && amountPaid === 0 && (
          <TouchableOpacity style={[s.actionBtn, { marginTop: 10 }]} onPress={() => markStatus('paid')} disabled={saving}>
            {saving ? <ActivityIndicator color={T.accent} /> : <Text style={s.actionBtnTxt}>Mark as Fully Paid ✓</Text>}
          </TouchableOpacity>
        )}

        {/* Mark overdue (when sent) */}
        {invoice.status === 'sent' && (
          <TouchableOpacity style={[s.actionBtn, s.actionBtnAmber, { marginTop: 10 }]} onPress={markOverdue} disabled={saving}>
            <Text style={[s.actionBtnTxt, { color: T.amberHi }]}>⚠️ Mark as Overdue</Text>
          </TouchableOpacity>
        )}

        {/* Void */}
        {(invoice.status === 'draft' || invoice.status === 'sent' || invoice.status === 'overdue') && (
          <TouchableOpacity style={[s.deleteBtn, { marginTop: 10 }]} onPress={() => Alert.alert(
            'Void Invoice',
            'Voiding marks this invoice as cancelled. It will not be deleted.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Void', style: 'destructive', onPress: async () => {
                const now = new Date().toISOString();
                await save({ status: 'void', voidedAt: now });
              }},
            ]
          )} disabled={saving}>
            <Text style={s.deleteBtnTxt}>Void Invoice</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={[s.deleteBtn, { marginTop: 10 }]} onPress={() => Alert.alert('Delete Invoice', 'Delete this invoice?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: async () => { await InvoiceRepository.deleteInvoice(invoiceId); navigation.goBack(); }},
        ])}>
          <Text style={s.deleteBtnTxt}>Delete Invoice</Text>
        </TouchableOpacity>

      </ScrollView>

      <RecordPaymentModal
        visible={showRecordPayment}
        remaining={remaining}
        onClose={() => setShowRecordPayment(false)}
        onSave={handleRecordPayment}
      />

      <CommReviewModal
        visible={showComm}
        intent={commIntent}
        vars={{
          customer_name: invoice.customer.name,
          address: invoice.customer.address,
          invoice_number: invoice.invoiceNumber,
          invoice_total: `$${fmt(total)}`,
          payment_terms: invoice.paymentTerms,
          balance_due: remaining > 0 ? `$${fmt(remaining)}` : undefined,
        }}
        recipientEmail={invoice.customer.email}
        attachments={pdfUri ? [pdfUri] : undefined}
        attachmentLabel={pdfUri ? `Invoice ${invoice.invoiceNumber} PDF` : undefined}
        onClose={() => { setShowComm(false); setPdfUri(null); }}
        onSent={handleCommSent}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  scroll: { padding: 20, paddingBottom: 60 },
  notFound: { color: T.sub, fontSize: 16, textAlign: 'center', marginTop: 60 },
  headerCard: { backgroundColor: T.surface, borderRadius: radii.lg, padding: 16, borderWidth: 1, borderColor: T.border },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  invNum: { color: T.sub, fontSize: 12 },
  customerName: { color: T.text, fontSize: 20, fontWeight: '700' },
  customerSub: { color: T.sub, fontSize: 13, marginTop: 2 },
  invDate: { color: T.muted, fontSize: 12, marginTop: 3 },
  invEstRef: { color: T.muted, fontSize: 12, marginTop: 3, fontStyle: 'italic' },
  // Balance tracker
  balanceCard: { backgroundColor: T.surface, borderRadius: radii.lg, padding: 16, borderWidth: 1, borderColor: T.border, marginTop: 12, gap: 8 },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  balanceRowFinal: { borderTopWidth: 1, borderTopColor: T.border, paddingTop: 8, marginTop: 4 },
  balanceLabel: { color: T.textDim, fontSize: 14 },
  balanceAmt: { color: T.text, fontSize: 14, fontWeight: '600' },
  balancePaidLabel: { color: T.green, fontSize: 14 },
  balancePaidAmt: { color: T.green, fontSize: 14, fontWeight: '600' },
  balanceDueLabel: { color: T.text, fontSize: 15, fontWeight: '700' },
  balanceDueAmt: { color: T.text, fontSize: 18, fontWeight: '800' },
  progressTrack: { height: 6, backgroundColor: T.border, borderRadius: 3, overflow: 'hidden', marginTop: 4 },
  progressBar: { height: '100%', backgroundColor: T.green, borderRadius: 3 },
  // Line items
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: T.border },
  lineInput: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: radii.sm, color: T.text, padding: 8, fontSize: 13 },
  lineLabel: { color: T.textDim, fontSize: 14 },
  lineQty: { color: T.sub, fontSize: 13, width: 35 },
  lineTotal: { color: T.text, fontSize: 14, fontWeight: '600', width: 80, textAlign: 'right' },
  lineDel: { color: T.red, fontSize: 16, paddingLeft: 4 },
  addLineBtn: { borderWidth: 1, borderColor: T.border, borderStyle: 'dashed', borderRadius: radii.md, padding: 12, alignItems: 'center', marginTop: 8 },
  addLineTxt: { color: T.sub, fontSize: 14 },
  // Tax & payment
  taxRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  taxLabel: { color: T.textDim, fontSize: 14 },
  taxInput: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: radii.sm, color: T.text, padding: 8, fontSize: 14, width: 80, textAlign: 'center' },
  taxValue: { color: T.text, fontSize: 14, fontWeight: '600' },
  fieldLabel: { color: T.textDim, fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  fieldValue: { color: T.text, fontSize: 14 },
  fieldEmpty: { color: T.muted, fontSize: 14, fontStyle: 'italic' },
  input: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: radii.sm, color: T.text, padding: 12, fontSize: 15 },
  inputMulti: { minHeight: 80, paddingTop: 10 },
  // Totals
  totalsCard: { backgroundColor: T.surface, borderRadius: radii.lg, padding: 16, borderWidth: 1, borderColor: T.border, marginTop: 16, gap: 10 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalRowFinal: { borderTopWidth: 1, borderTopColor: T.border, paddingTop: 10, marginTop: 4 },
  totalLabel: { color: T.textDim, fontSize: 14 },
  totalAmt: { color: T.text, fontSize: 14, fontWeight: '600' },
  totalFinalLabel: { color: T.text, fontSize: 16, fontWeight: '700' },
  totalFinalAmt: { color: T.text, fontSize: 20, fontWeight: '800' },
  // Payment history
  paymentEventRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.surface, borderRadius: radii.md, padding: 12, borderWidth: 1, borderColor: T.border, marginBottom: 8 },
  paymentEventAmt: { color: T.green, fontSize: 15, fontWeight: '700' },
  paymentEventMeta: { color: T.sub, fontSize: 12, marginTop: 2 },
  paymentEventDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: T.green },
  // Actions
  shareBtn: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: radii.md, padding: 14, alignItems: 'center' },
  shareBtnTxt: { color: T.text, fontWeight: '600', fontSize: 15 },
  actionBtn: { borderWidth: 1, borderColor: T.accent, borderRadius: radii.md, padding: 14, alignItems: 'center' },
  actionBtnGreen: { backgroundColor: T.green, borderColor: T.green },
  actionBtnAmber: { borderColor: T.amber, backgroundColor: T.amberLo },
  actionBtnTxt: { color: T.accent, fontWeight: '700', fontSize: 15 },
  deleteBtn: { borderWidth: 1, borderColor: T.redLo, borderRadius: radii.md, padding: 14, alignItems: 'center' },
  deleteBtnTxt: { color: T.red, fontWeight: '600', fontSize: 15 },
});
