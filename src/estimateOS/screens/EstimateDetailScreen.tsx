// ─── EstimateDetailScreen ─────────────────────────────────────────────────
import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, Alert, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Estimate, Invoice, MaterialLineItem, AiScanRecord, AI_META_PREFIX, AnswerValue, FollowUpStatus } from '../models/types';
import { EstimateRepository } from '../storage/repository';
import { InvoiceRepository } from '../storage/invoices';
import { getAiHistory } from '../storage/aiHistory';
import { nextInvoiceNumber } from '../storage/settings';
import { makeId } from '../domain/id';
import { TimelineRepository } from '../storage/workflow';
import { MaterialsSection } from '../components/MaterialsSection';
import { FollowUpPanel } from '../components/FollowUpPanel';
import { ReminderSheet } from '../components/ReminderSheet';
import { CommReviewModal } from '../components/CommReviewModal';
import { T, radii } from '../theme';

const STATUS_STYLE: Record<string, { bg: string; border: string; text: string; label: string }> = {
  draft:    { bg: T.surface,  border: T.border, text: T.sub,     label: 'Draft' },
  pending:  { bg: T.amberLo,  border: T.amber,  text: T.amberHi, label: 'Pending' },
  accepted: { bg: T.greenLo,  border: T.green,  text: T.greenHi, label: 'Accepted' },
  rejected: { bg: T.redLo,    border: T.red,    text: T.red,     label: 'Rejected' },
};

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_STYLE[status] ?? STATUS_STYLE.draft;
  return (
    <View style={[sb.wrap, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text style={[sb.txt, { color: c.text }]}>{c.label}</Text>
    </View>
  );
}
const sb = StyleSheet.create({
  wrap: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  txt:  { fontSize: 12, fontWeight: '700' },
});

function SectionHeader({ title }: { title: string }) {
  return <Text style={sh.txt}>{title}</Text>;
}
const sh = StyleSheet.create({
  txt: { color: T.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginTop: 28, marginBottom: 10 },
});

function AiScanHistorySection({ history, onRevert }: { history: AiScanRecord[]; onRevert: (r: AiScanRecord) => void }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? history : history.slice(0, 2);
  return (
    <View>
      {shown.map(rec => {
        const date = new Date(rec.createdAt);
        return (
          <View key={rec.id} style={aih.card}>
            <View style={aih.row}>
              <View style={{ flex: 1 }}>
                <Text style={aih.date}>{date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                <Text style={aih.summary} numberOfLines={2}>{rec.summary}</Text>
              </View>
              <TouchableOpacity style={aih.btn} onPress={() => Alert.alert('Revert Answers', 'Replace current answers with this AI snapshot?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Revert', style: 'destructive', onPress: () => onRevert(rec) },
              ])}>
                <Text style={aih.btnTxt}>Revert</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
      {history.length > 2 && (
        <TouchableOpacity onPress={() => setExpanded(e => !e)}>
          <Text style={aih.more}>{expanded ? 'Show less' : `View all ${history.length} scans`}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
const aih = StyleSheet.create({
  card: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: radii.md, padding: 12, marginBottom: 8 },
  row:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  date: { color: T.sub, fontSize: 11, marginBottom: 3 },
  summary: { color: T.textDim, fontSize: 12, lineHeight: 17 },
  btn: { backgroundColor: T.redLo, borderWidth: 1, borderColor: T.red, borderRadius: radii.sm, paddingHorizontal: 10, paddingVertical: 6 },
  btnTxt: { color: T.red, fontSize: 12, fontWeight: '700' },
  more: { color: T.sub, fontSize: 13, textAlign: 'center', paddingVertical: 8 },
});

export function EstimateDetailScreen({ route, navigation }: any) {
  const { estimateId } = route?.params ?? {};
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [aiHistory, setAiHistory] = useState<AiScanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const [showComm, setShowComm] = useState(false);

  const load = useCallback(async () => {
    if (!estimateId) return;
    setLoading(true);
    try {
      const [est, invs, hist] = await Promise.all([
        EstimateRepository.getEstimate(estimateId),
        InvoiceRepository.listByEstimate(estimateId),
        getAiHistory(estimateId),
      ]);
      setEstimate(est);
      setInvoices(invs);
      setAiHistory(hist);
    } finally {
      setLoading(false);
    }
  }, [estimateId]);

  useFocusEffect(load);

  if (loading) {
    return <SafeAreaView style={s.safe}><ActivityIndicator style={{ marginTop: 60 }} color={T.accent} /></SafeAreaView>;
  }
  if (!estimate) {
    return <SafeAreaView style={s.safe}><Text style={s.notFound}>Estimate not found.</Text></SafeAreaView>;
  }

  const { computedRange: range, customer } = estimate;
  const hasOverrides = Object.keys(estimate.driverOverrides ?? {}).length > 0;
  const materialsTotal = (estimate.materialLineItems ?? []).reduce((s, m) => s + m.unitCost * m.quantity, 0);
  const priceMin = (range?.min ?? 0) + materialsTotal;
  const priceMax = (range?.max ?? 0) + materialsTotal;

  const handleCreateInvoice = async () => {
    setSaving(true);
    try {
      const num = await nextInvoiceNumber();
      const inv: Invoice = {
        id: makeId(),
        invoiceNumber: num,
        estimateId: estimate.id,
        customerId: estimate.customerId,
        customer: estimate.customer,
        status: 'draft',
        lineItems: estimate.drivers
          .filter(d => !d.disabled)
          .map(d => ({
            id: d.id,
            label: d.label,
            unitCost: Math.round(((d.overrideMin ?? d.minImpact) + (d.overrideMax ?? d.maxImpact)) / 2),
            quantity: 1,
          })),
        taxRate: 0,
        paymentTerms: 'Due on receipt',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await InvoiceRepository.upsertInvoice(inv);
      if (estimate.customerId) {
        await TimelineRepository.appendEvent({
          customerId: estimate.customerId,
          estimateId: estimate.id,
          invoiceId: inv.id,
          type: 'invoice_created',
          note: `Invoice ${inv.invoiceNumber} created`,
        });
      }
      navigation.navigate('Invoice', { invoiceId: inv.id });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMaterials = async (items: MaterialLineItem[]) => {
    const updated = { ...estimate, materialLineItems: items, updatedAt: new Date().toISOString() };
    setEstimate(updated as Estimate);
    await EstimateRepository.upsertEstimate(updated as Estimate);
  };

  const handleRevert = async (record: AiScanRecord) => {
    const cleaned: Record<string, AnswerValue> = {};
    for (const [k, v] of Object.entries(record.answersSnapshot)) {
      if (!k.startsWith(AI_META_PREFIX)) cleaned[k] = v;
    }
    const updated = { ...estimate, intakeAnswers: cleaned, updatedAt: new Date().toISOString() };
    setEstimate(updated as Estimate);
    await EstimateRepository.upsertEstimate(updated as Estimate);
  };

  const handleDelete = () => {
    Alert.alert('Delete Estimate', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await EstimateRepository.deleteEstimate(estimate.id);
        navigation.goBack();
      }},
    ]);
  };

  const handleStatusChange = async (status: Estimate['status']) => {
    const updated = { ...estimate, status, updatedAt: new Date().toISOString() };
    setEstimate(updated as Estimate);
    await EstimateRepository.upsertEstimate(updated as Estimate);
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll}>

        {/* Header card */}
        <View style={s.headerCard}>
          <View style={s.headerTop}>
            <StatusBadge status={estimate.status} />
            {estimate.estimateNumber && <Text style={s.estNum}>{estimate.estimateNumber}</Text>}
          </View>
          <Text style={s.customerName}>{customer.name}</Text>
          {customer.address && <Text style={s.customerSub}>{customer.address}</Text>}
          {customer.phone && <Text style={s.customerSub}>{customer.phone}</Text>}
        </View>

        {/* Price range */}
        <SectionHeader title="Estimated Range" />
        <View style={s.priceCard}>
          <Text style={s.priceRange}>
            ${priceMin.toLocaleString('en-US')} – ${priceMax.toLocaleString('en-US')}
          </Text>
          {hasOverrides && <Text style={s.edited}>Edited</Text>}
          {materialsTotal > 0 && (
            <Text style={s.priceSub}>Includes ${materialsTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })} materials</Text>
          )}
        </View>

        {/* Status actions */}
        <SectionHeader title="Status" />
        <View style={s.statusRow}>
          {(['draft', 'pending', 'accepted', 'rejected'] as Estimate['status'][]).map(st => {
            const c = STATUS_STYLE[st];
            const active = estimate.status === st;
            return (
              <TouchableOpacity
                key={st}
                style={[s.statusBtn, active && { backgroundColor: c.bg, borderColor: c.border }]}
                onPress={() => handleStatusChange(st)}
              >
                <Text style={[s.statusBtnTxt, active && { color: c.text }]}>{c.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Follow-up panel */}
        <SectionHeader title="Follow-up" />
        <FollowUpPanel
          status={estimate.followUpStatus}
          nextActionAt={estimate.nextActionAt}
          nextActionNote={estimate.nextActionNote}
          onStatusChange={async (status: FollowUpStatus) => {
            const updated = { ...estimate, followUpStatus: status, updatedAt: new Date().toISOString() };
            setEstimate(updated as Estimate);
            await EstimateRepository.upsertEstimate(updated as Estimate);
            if (estimate.customerId) await TimelineRepository.appendEvent({ customerId: estimate.customerId, estimateId: estimate.id, type: 'status_changed', note: `Follow-up → ${status}` });
          }}
          onNextActionChange={async (date, note) => {
            const updated = { ...estimate, nextActionAt: date, nextActionNote: note, updatedAt: new Date().toISOString() };
            setEstimate(updated as Estimate);
            await EstimateRepository.upsertEstimate(updated as Estimate);
          }}
          onMarkContacted={async () => {
            const now = new Date().toISOString();
            const updated = { ...estimate, lastContactAt: now, updatedAt: now };
            setEstimate(updated as Estimate);
            await EstimateRepository.upsertEstimate(updated as Estimate);
          }}
        />

        {/* Quick comms */}
        <View style={s.commRow}>
          <TouchableOpacity style={s.commBtn} onPress={() => setShowReminder(true)}>
            <Text style={s.commBtnTxt}>⏰ Reminder</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.commBtn} onPress={() => setShowComm(true)}>
            <Text style={s.commBtnTxt}>✉️ Send Message</Text>
          </TouchableOpacity>
        </View>


        {/* Line items */}
        {estimate.drivers.length > 0 && (
          <>
            <SectionHeader title={`Line Items (${estimate.drivers.filter(d => !d.disabled).length})`} />
            {estimate.drivers.filter(d => !d.disabled).map(d => (
              <View key={d.id} style={s.driverRow}>
                <Text style={s.driverLabel} numberOfLines={1}>{d.label}</Text>
                <Text style={s.driverAmt}>
                  ${(d.overrideMin ?? d.minImpact).toLocaleString('en-US')}–${(d.overrideMax ?? d.maxImpact).toLocaleString('en-US')}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* Materials */}
        <SectionHeader title="Materials" />
        <MaterialsSection items={estimate.materialLineItems ?? []} onChange={handleSaveMaterials} />

        {/* Invoices */}
        {invoices.length > 0 && (
          <>
            <SectionHeader title={`Invoices (${invoices.length})`} />
            {invoices.map(inv => (
              <TouchableOpacity key={inv.id} style={s.invoiceRow} onPress={() => navigation.navigate('Invoice', { invoiceId: inv.id })}>
                <View style={{ flex: 1 }}>
                  <Text style={s.invoiceNum}>{inv.invoiceNumber}</Text>
                  <Text style={s.invoiceSub}>{inv.status.charAt(0).toUpperCase() + inv.status.slice(1)} · {inv.paymentTerms}</Text>
                </View>
                <Text style={s.invoiceArrow}>›</Text>
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* AI Scan History */}
        {aiHistory.length > 0 && (
          <>
            <SectionHeader title="AI Scan History" />
            <AiScanHistorySection history={aiHistory} onRevert={handleRevert} />
          </>
        )}

        {/* Actions */}
        <SectionHeader title="Actions" />
        <View style={s.actions}>
          <TouchableOpacity style={s.actionBtn} onPress={() => navigation.navigate('NewEstimate', { estimateId: estimate.id })}>
            <Text style={s.actionIcon}>✏️</Text>
            <Text style={s.actionTxt}>Edit Estimate</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionBtn} onPress={handleCreateInvoice} disabled={saving}>
            {saving ? <ActivityIndicator size="small" color={T.accent} /> : <Text style={s.actionIcon}>🧾</Text>}
            <Text style={s.actionTxt}>Create Invoice</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionBtn} onPress={() => navigation.navigate('ReviewSend', { estimateId: estimate.id })}>
            <Text style={s.actionIcon}>📤</Text>
            <Text style={s.actionTxt}>Review & Send</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.actionBtn, s.actionBtnDanger]} onPress={handleDelete}>
            <Text style={s.actionIcon}>🗑️</Text>
            <Text style={[s.actionTxt, { color: T.red }]}>Delete</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      <ReminderSheet
        visible={showReminder}
        initial={{
          estimateId: estimate.id,
          customerId: estimate.customerId,
          customerName: estimate.customer.name,
          type: 'estimate_followup',
        }}
        onClose={() => setShowReminder(false)}
        onSaved={() => setShowReminder(false)}
      />

      <CommReviewModal
        visible={showComm}
        templateType="estimate_followup"
        vars={{
          customer_name: estimate.customer.name,
          address: estimate.customer.address,
          estimate_number: estimate.estimateNumber,
          price_range: estimate.computedRange
            ? `$${estimate.computedRange.min.toLocaleString('en-US')} – $${estimate.computedRange.max.toLocaleString('en-US')}`
            : undefined,
        }}
        onClose={() => setShowComm(false)}
        onSent={async () => {
          const updated = { ...estimate, followUpStatus: 'quote_sent' as FollowUpStatus, quoteSentAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
          setEstimate(updated as Estimate);
          await EstimateRepository.upsertEstimate(updated as Estimate);
          if (estimate.customerId) await TimelineRepository.appendEvent({ customerId: estimate.customerId, estimateId: estimate.id, type: 'quote_sent' });
          setShowComm(false);
        }}
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
  estNum: { color: T.sub, fontSize: 12 },
  customerName: { color: T.text, fontSize: 22, fontWeight: '700' },
  customerSub: { color: T.sub, fontSize: 13, marginTop: 3 },

  priceCard: { backgroundColor: T.surface, borderRadius: radii.lg, padding: 16, borderWidth: 1, borderColor: T.border, alignItems: 'center' },
  priceRange: { color: T.text, fontSize: 26, fontWeight: '800' },
  edited: { color: T.amberHi, fontSize: 12, fontWeight: '600', marginTop: 4 },
  priceSub: { color: T.sub, fontSize: 12, marginTop: 4 },

  statusRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  statusBtn: { borderWidth: 1, borderColor: T.border, borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 8 },
  statusBtnTxt: { color: T.sub, fontSize: 13, fontWeight: '600' },

  driverRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.border },
  driverLabel: { color: T.textDim, fontSize: 14, flex: 1, marginRight: 10 },
  driverAmt: { color: T.text, fontSize: 13, fontWeight: '600' },

  invoiceRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.surface, borderRadius: radii.md, padding: 14, borderWidth: 1, borderColor: T.border, marginBottom: 8 },
  invoiceNum: { color: T.text, fontSize: 15, fontWeight: '600' },
  invoiceSub: { color: T.sub, fontSize: 12, marginTop: 2 },
  invoiceArrow: { color: T.sub, fontSize: 20 },

  actions: { gap: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: T.surface, borderRadius: radii.md, padding: 16, borderWidth: 1, borderColor: T.border },
  actionBtnDanger: { borderColor: T.redLo },
  actionIcon: { fontSize: 20 },
  actionTxt: { color: T.text, fontSize: 15, fontWeight: '600' },
  commRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  commBtn: { flex: 1, backgroundColor: T.surface, borderRadius: radii.md, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: T.border },
  commBtnTxt: { color: T.text, fontSize: 13, fontWeight: '600' },
});
