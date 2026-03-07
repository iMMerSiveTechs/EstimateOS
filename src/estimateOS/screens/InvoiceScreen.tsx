// ─── InvoiceScreen ─────────────────────────────────────────────────────────
import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  SafeAreaView, Alert, ActivityIndicator, Share,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Invoice, InvoiceLineItem } from '../models/types';
import { InvoiceRepository } from '../storage/invoices';
import { getBusinessProfile } from '../storage/settings';
import { TimelineRepository } from '../storage/workflow';
import { makeId } from '../domain/id';
import { T, radii } from '../theme';

const INV_STATUS: Record<string, { bg: string; border: string; text: string; label: string }> = {
  draft: { bg: T.surface,  border: T.border, text: T.sub,     label: 'Draft' },
  sent:  { bg: T.amberLo,  border: T.amber,  text: T.amberHi, label: 'Sent' },
  paid:  { bg: T.greenLo,  border: T.green,  text: T.greenHi, label: 'Paid' },
  void:  { bg: T.redLo,    border: T.red,    text: T.red,     label: 'Void' },
};

function StatusBadge({ status }: { status: string }) {
  const c = INV_STATUS[status] ?? INV_STATUS.draft;
  return (
    <View style={[sb.wrap, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text style={[sb.txt, { color: c.text }]}>{c.label}</Text>
    </View>
  );
}
const sb = StyleSheet.create({
  wrap: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  txt: { fontSize: 12, fontWeight: '700' },
});

function SectionHeader({ title }: { title: string }) {
  return <Text style={sh.txt}>{title}</Text>;
}
const sh = StyleSheet.create({ txt: { color: T.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginTop: 28, marginBottom: 10 } });

export function InvoiceScreen({ route, navigation }: any) {
  const { invoiceId } = route?.params ?? {};
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [taxInput, setTaxInput] = useState('0');
  const [terms, setTerms] = useState('Due on receipt');
  const [notes, setNotes] = useState('');

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

  const subtotal = invoice.lineItems.reduce((sum, li) => sum + li.unitCost * li.quantity, 0);
  const taxRate = Math.min(1, Math.max(0, Number(taxInput) / 100 || 0));
  const taxAmt = subtotal * taxRate;
  const total = subtotal + taxAmt;

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
      await save({ status, sentAt: status === 'sent' ? now : invoice.sentAt, paidAt: status === 'paid' ? now : invoice.paidAt });
      // Record timeline event when status changes meaningfully
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

  const handleShare = async () => {
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
      taxRate > 0 ? `Tax (${Math.round(taxRate * 100)}%): $${fmt(taxAmt)}` : null,
      `TOTAL: $${fmt(total)}`,
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
        </View>

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
          {taxRate > 0 && <View style={s.totalRow}><Text style={s.totalLabel}>Tax ({Math.round(taxRate * 100)}%)</Text><Text style={s.totalAmt}>${fmt(taxAmt)}</Text></View>}
          <View style={[s.totalRow, s.totalRowFinal]}><Text style={s.totalFinalLabel}>Total</Text><Text style={s.totalFinalAmt}>${fmt(total)}</Text></View>
        </View>

        {/* Actions */}
        <SectionHeader title="Actions" />
        <TouchableOpacity style={s.shareBtn} onPress={handleShare}>
          <Text style={s.shareBtnTxt}>📤 Share / Export</Text>
        </TouchableOpacity>
        {invoice.status === 'draft' && (
          <TouchableOpacity style={[s.actionBtn, { marginTop: 10 }]} onPress={() => markStatus('sent')} disabled={saving}>
            {saving ? <ActivityIndicator color={T.accent} /> : <Text style={s.actionBtnTxt}>Mark as Sent</Text>}
          </TouchableOpacity>
        )}
        {invoice.status === 'sent' && (
          <TouchableOpacity style={[s.actionBtn, s.actionBtnGreen, { marginTop: 10 }]} onPress={() => markStatus('paid')} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={[s.actionBtnTxt, { color: '#fff' }]}>Mark as Paid ✓</Text>}
          </TouchableOpacity>
        )}
        {(invoice.status === 'draft' || invoice.status === 'sent') && (
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
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: T.border },
  lineInput: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: radii.sm, color: T.text, padding: 8, fontSize: 13 },
  lineLabel: { color: T.textDim, fontSize: 14 },
  lineQty: { color: T.sub, fontSize: 13, width: 35 },
  lineTotal: { color: T.text, fontSize: 14, fontWeight: '600', width: 80, textAlign: 'right' },
  lineDel: { color: T.red, fontSize: 16, paddingLeft: 4 },
  addLineBtn: { borderWidth: 1, borderColor: T.border, borderStyle: 'dashed', borderRadius: radii.md, padding: 12, alignItems: 'center', marginTop: 8 },
  addLineTxt: { color: T.sub, fontSize: 14 },
  taxRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  taxLabel: { color: T.textDim, fontSize: 14 },
  taxInput: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: radii.sm, color: T.text, padding: 8, fontSize: 14, width: 80, textAlign: 'center' },
  taxValue: { color: T.text, fontSize: 14, fontWeight: '600' },
  fieldLabel: { color: T.textDim, fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  fieldValue: { color: T.text, fontSize: 14 },
  fieldEmpty: { color: T.muted, fontSize: 14, fontStyle: 'italic' },
  input: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: radii.sm, color: T.text, padding: 12, fontSize: 15 },
  inputMulti: { minHeight: 80, paddingTop: 10 },
  totalsCard: { backgroundColor: T.surface, borderRadius: radii.lg, padding: 16, borderWidth: 1, borderColor: T.border, marginTop: 16, gap: 10 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalRowFinal: { borderTopWidth: 1, borderTopColor: T.border, paddingTop: 10, marginTop: 4 },
  totalLabel: { color: T.textDim, fontSize: 14 },
  totalAmt: { color: T.text, fontSize: 14, fontWeight: '600' },
  totalFinalLabel: { color: T.text, fontSize: 16, fontWeight: '700' },
  totalFinalAmt: { color: T.text, fontSize: 20, fontWeight: '800' },
  shareBtn: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: radii.md, padding: 14, alignItems: 'center' },
  shareBtnTxt: { color: T.text, fontWeight: '600', fontSize: 15 },
  actionBtn: { borderWidth: 1, borderColor: T.accent, borderRadius: radii.md, padding: 14, alignItems: 'center' },
  actionBtnGreen: { backgroundColor: T.green, borderColor: T.green },
  actionBtnTxt: { color: T.accent, fontWeight: '700', fontSize: 15 },
  deleteBtn: { borderWidth: 1, borderColor: T.redLo, borderRadius: radii.md, padding: 14, alignItems: 'center' },
  deleteBtnTxt: { color: T.red, fontWeight: '600', fontSize: 15 },
});
