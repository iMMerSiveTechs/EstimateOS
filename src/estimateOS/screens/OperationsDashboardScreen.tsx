// ─── OperationsDashboardScreen ────────────────────────────────────────────────
// Phases 6, 7, 8: Ops overview, needs-attention, pipeline, ROI surfaces.
// Natural Origins proving ground — lightweight, action-oriented, local-first.
import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Estimate, Invoice, Customer, Reminder, IntakeDraft, FollowUpStatus, FOLLOW_UP_LABELS } from '../models/types';
import { EstimateRepository } from '../storage/repository';
import { InvoiceRepository } from '../storage/invoices';
import { CustomerRepository } from '../storage/customers';
import { ReminderRepository, IntakeDraftRepository } from '../storage/workflow';
import { getSettings } from '../storage/settings';
import { GettingStartedChecklist, useGettingStartedDismissed, ChecklistContext } from '../components/GettingStartedChecklist';
import { T, radii } from '../theme';

// ─── Color map for follow-up status (local — theme-based) ────────────────────
const FU_COLOR: Record<FollowUpStatus, { bg: string; border: string; text: string }> = {
  lead_new:              { bg: T.indigoLo,  border: T.indigo, text: T.indigoHi },
  quote_in_progress:     { bg: T.amberLo,   border: T.amber,  text: T.amberHi },
  quote_sent:            { bg: T.tealLo,    border: T.teal,   text: T.teal },
  follow_up_due:         { bg: T.redLo,     border: T.red,    text: T.red },
  awaiting_customer:     { bg: T.amberLo,   border: T.amber,  text: T.amberHi },
  appointment_scheduled: { bg: T.purpleLo,  border: T.purple, text: T.purple },
  won:                   { bg: T.greenLo,   border: T.green,  text: T.greenHi },
  lost:                  { bg: T.surface,   border: T.border, text: T.sub },
};

type NeedsAttentionItem =
  | { kind: 'estimate'; estimate: Estimate; reason: string }
  | { kind: 'invoice'; invoice: Invoice; reason: string }
  | { kind: 'reminder'; reminder: Reminder; reason: string }
  | { kind: 'intake'; draft: IntakeDraft; reason: string };

type PipelineBucket = { status: FollowUpStatus; label: string; count: number; bg: string; text: string };

function StatCard({ label, value, sub, color, onPress }: { label: string; value: string | number; sub?: string; color?: string; onPress?: () => void }) {
  return (
    <TouchableOpacity style={[stat.card, { borderColor: color ?? T.border }]} onPress={onPress} disabled={!onPress}>
      <Text style={[stat.value, { color: color ?? T.text }]}>{value}</Text>
      <Text style={stat.label}>{label}</Text>
      {sub ? <Text style={stat.sub}>{sub}</Text> : null}
    </TouchableOpacity>
  );
}
const stat = StyleSheet.create({
  card: { flex: 1, backgroundColor: T.surface, borderRadius: radii.lg, padding: 14, borderWidth: 1, alignItems: 'center' },
  value: { fontSize: 28, fontWeight: '800' },
  label: { color: T.textDim, fontSize: 12, fontWeight: '600', marginTop: 4, textAlign: 'center' },
  sub: { color: T.muted, fontSize: 11, marginTop: 2, textAlign: 'center' },
});

function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={sh.row}>
      <Text style={sh.txt}>{title}</Text>
      {action && <TouchableOpacity onPress={onAction}><Text style={sh.action}>{action}</Text></TouchableOpacity>}
    </View>
  );
}
const sh = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, marginBottom: 10 },
  txt: { color: T.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  action: { color: T.accent, fontSize: 13, fontWeight: '600' },
});

export function OperationsDashboardScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [drafts, setDrafts] = useState<IntakeDraft[]>([]);
  const [hasProfile, setHasProfile] = useState(false);
  const { dismissed: checklistDismissed, dismiss: dismissChecklist } = useGettingStartedDismissed();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ests, invs, custs, rems, intakes, settings] = await Promise.all([
        EstimateRepository.listEstimates(),
        InvoiceRepository.listInvoices(),
        CustomerRepository.listCustomers(),
        ReminderRepository.listPending(),
        IntakeDraftRepository.listByStatus('new'),
        getSettings(),
      ]);
      setEstimates(ests);
      setInvoices(invs);
      setCustomers(custs);
      setReminders(rems);
      setDrafts(intakes);
      setHasProfile(!!settings.businessProfile.businessName?.trim());
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(load);

  if (loading) return <SafeAreaView style={s.safe}><ActivityIndicator style={{ marginTop: 60 }} color={T.accent} /></SafeAreaView>;

  // ─── Derived metrics ───────────────────────────────────────────────────────
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const openEstimates = estimates.filter(e => e.status === 'draft' || e.status === 'pending');
  const sentEstimates = estimates.filter(e => e.followUpStatus === 'quote_sent');
  const wonEstimates  = estimates.filter(e => e.followUpStatus === 'won');
  const outstandingInvoices = invoices.filter(i => i.status === 'sent');
  const overdueReminders = reminders.filter(r => r.dueDate < todayStr);
  const followUpsDue = [
    ...estimates.filter(e => e.followUpStatus === 'follow_up_due'),
    ...customers.filter(c => c.followUpStatus === 'follow_up_due'),
  ];
  const awaitingCustomer = [
    ...estimates.filter(e => e.followUpStatus === 'awaiting_customer'),
    ...customers.filter(c => c.followUpStatus === 'awaiting_customer'),
  ];

  // Pipeline counts
  const pipelineBuckets: PipelineBucket[] = [
    { status: 'lead_new',              label: 'New Leads',  count: drafts.length,                         bg: T.indigoLo,  text: T.indigoHi },
    { status: 'quote_in_progress',     label: 'In Progress',count: openEstimates.length,                  bg: T.amberLo,   text: T.amberHi },
    { status: 'quote_sent',            label: 'Quote Sent', count: sentEstimates.length,                  bg: T.tealLo,    text: T.teal },
    { status: 'follow_up_due',         label: 'Follow-up',  count: followUpsDue.length,                   bg: T.redLo,     text: T.red },
    { status: 'awaiting_customer',     label: 'Awaiting',   count: awaitingCustomer.length,               bg: T.amberLo,   text: T.amberHi },
    { status: 'won',                   label: 'Won',        count: wonEstimates.length,                   bg: T.greenLo,   text: T.greenHi },
  ];

  // Needs attention
  const needsAttention: NeedsAttentionItem[] = [];

  // Overdue reminders
  overdueReminders.slice(0, 5).forEach(r =>
    needsAttention.push({ kind: 'reminder', reminder: r, reason: `Overdue: ${r.note || r.type}` })
  );

  // Follow-up due estimates
  estimates.filter(e => e.followUpStatus === 'follow_up_due').slice(0, 3).forEach(e =>
    needsAttention.push({ kind: 'estimate', estimate: e, reason: 'Follow-up overdue' })
  );

  // Unsent invoices (draft, no send)
  invoices.filter(i => i.status === 'draft').slice(0, 3).forEach(i =>
    needsAttention.push({ kind: 'invoice', invoice: i, reason: 'Invoice not sent yet' })
  );

  // Uncontacted leads
  drafts.filter(d => !d.lastContactAt).slice(0, 3).forEach(d =>
    needsAttention.push({ kind: 'intake', draft: d, reason: 'New lead — no contact yet' })
  );

  // ─── ROI estimate (best-effort) ────────────────────────────────────────────
  const totalWonValue = wonEstimates.reduce((s, e) =>
    s + Math.round(((e.computedRange?.min ?? 0) + (e.computedRange?.max ?? 0)) / 2), 0);

  const conversionRate = estimates.length > 0
    ? Math.round((wonEstimates.length / estimates.length) * 100)
    : null;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll}>

        {/* Quick action strip */}
        <View style={s.quickActions}>
          <TouchableOpacity style={s.quickBtn} onPress={() => navigation.navigate('Intake')}>
            <Text style={s.quickIcon}>📋</Text>
            <Text style={s.quickTxt}>New Lead</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.quickBtn} onPress={() => navigation.navigate('NewEstimate')}>
            <Text style={s.quickIcon}>📝</Text>
            <Text style={s.quickTxt}>New Estimate</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.quickBtn} onPress={() => navigation.navigate('CustomersTab')}>
            <Text style={s.quickIcon}>👥</Text>
            <Text style={s.quickTxt}>Customers</Text>
          </TouchableOpacity>
        </View>

        {/* Summary stats */}
        <SectionHeader title="Overview" />
        <View style={s.statRow}>
          <StatCard label="Open Estimates" value={openEstimates.length} color={openEstimates.length > 0 ? T.amber : undefined} />
          <StatCard label="Follow-ups Due" value={followUpsDue.length} color={followUpsDue.length > 0 ? T.red : undefined} />
          <StatCard label="Invoices Out" value={outstandingInvoices.length} color={outstandingInvoices.length > 0 ? T.accent : undefined} />
        </View>
        <View style={[s.statRow, { marginTop: 10 }]}>
          <StatCard label="New Leads" value={drafts.length} />
          <StatCard label="Reminders Due" value={overdueReminders.length} color={overdueReminders.length > 0 ? T.red : undefined} />
          <StatCard label="Won" value={wonEstimates.length} color={wonEstimates.length > 0 ? T.green : undefined} sub={totalWonValue > 0 ? `~$${(totalWonValue / 1000).toFixed(1)}k avg` : undefined} />
        </View>

        {/* Pipeline */}
        <SectionHeader title="Pipeline" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.pipelineScroll}>
          {pipelineBuckets.map(b => (
            <View key={b.status} style={[s.pipelineCard, { backgroundColor: b.bg, borderColor: b.text + '44' }]}>
              <Text style={[s.pipelineCount, { color: b.text }]}>{b.count}</Text>
              <Text style={[s.pipelineLabel, { color: b.text }]}>{b.label}</Text>
            </View>
          ))}
        </ScrollView>

        {/* ROI surface */}
        {(conversionRate !== null || totalWonValue > 0) && (
          <>
            <SectionHeader title="Results So Far" />
            <View style={s.roiCard}>
              {conversionRate !== null && (
                <View style={s.roiStat}>
                  <Text style={s.roiValue}>{conversionRate}%</Text>
                  <Text style={s.roiLabel}>Conversion rate</Text>
                </View>
              )}
              {totalWonValue > 0 && (
                <View style={[s.roiStat, { borderLeftWidth: 1, borderLeftColor: T.border, paddingLeft: 20 }]}>
                  <Text style={[s.roiValue, { color: T.green }]}>${totalWonValue.toLocaleString('en-US')}</Text>
                  <Text style={s.roiLabel}>Total won (avg midpoint)</Text>
                </View>
              )}
            </View>
            <Text style={s.roiNote}>
              * Metrics are best-effort using app activity. Tracking improves as you use the app.
            </Text>
          </>
        )}

        {/* Needs Attention */}
        {needsAttention.length > 0 && (
          <>
            <SectionHeader title={`Needs Attention (${needsAttention.length})`} />
            {needsAttention.map((item, i) => {
              if (item.kind === 'reminder') {
                return (
                  <View key={i} style={s.attentionRow}>
                    <View style={[s.attentionDot, { backgroundColor: T.redLo, borderColor: T.red }]}>
                      <Text style={{ fontSize: 12 }}>⏰</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.attentionTitle}>{item.reminder.customerName ?? 'Reminder'}</Text>
                      <Text style={s.attentionReason}>{item.reason}</Text>
                    </View>
                  </View>
                );
              }
              if (item.kind === 'estimate') {
                return (
                  <TouchableOpacity key={i} style={s.attentionRow} onPress={() => navigation.navigate('EstimateDetail', { estimateId: item.estimate.id })}>
                    <View style={[s.attentionDot, { backgroundColor: T.redLo, borderColor: T.red }]}>
                      <Text style={{ fontSize: 12 }}>📋</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.attentionTitle}>{item.estimate.customer.name} — {item.estimate.estimateNumber ?? 'Estimate'}</Text>
                      <Text style={s.attentionReason}>{item.reason}</Text>
                    </View>
                    <Text style={s.arrow}>›</Text>
                  </TouchableOpacity>
                );
              }
              if (item.kind === 'invoice') {
                return (
                  <TouchableOpacity key={i} style={s.attentionRow} onPress={() => navigation.navigate('Invoice', { invoiceId: item.invoice.id })}>
                    <View style={[s.attentionDot, { backgroundColor: T.amberLo, borderColor: T.amber }]}>
                      <Text style={{ fontSize: 12 }}>🧾</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.attentionTitle}>{item.invoice.customer.name} — {item.invoice.invoiceNumber}</Text>
                      <Text style={s.attentionReason}>{item.reason}</Text>
                    </View>
                    <Text style={s.arrow}>›</Text>
                  </TouchableOpacity>
                );
              }
              if (item.kind === 'intake') {
                return (
                  <TouchableOpacity key={i} style={s.attentionRow} onPress={() => navigation.navigate('Intake')}>
                    <View style={[s.attentionDot, { backgroundColor: T.indigoLo, borderColor: T.indigo }]}>
                      <Text style={{ fontSize: 12 }}>👤</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.attentionTitle}>{item.draft.customerName}</Text>
                      <Text style={s.attentionReason}>{item.reason}</Text>
                    </View>
                    <Text style={s.arrow}>›</Text>
                  </TouchableOpacity>
                );
              }
              return null;
            })}
          </>
        )}

        {/* Getting Started Checklist — shown until dismissed or all done */}
        {checklistDismissed === false && !loading && (
          <GettingStartedChecklist
            context={{
              hasBusinessProfile: hasProfile,
              hasCustomer: customers.length > 0,
              hasEstimate: estimates.length > 0,
              hasInvoice: invoices.length > 0,
              hasReminder: reminders.length > 0,
              hasIntake: drafts.length > 0,
            }}
            navigation={navigation}
            onDismiss={dismissChecklist}
          />
        )}

        {needsAttention.length === 0 && !loading && (() => {
          const isFirstRun = estimates.length === 0 && customers.length === 0 && invoices.length === 0;
          if (isFirstRun && checklistDismissed !== false) {
            return (
              <View style={s.firstRunCard}>
                <Text style={s.firstRunTitle}>Welcome to EstimateOS</Text>
                <Text style={s.firstRunSub}>
                  Start by capturing a lead or creating your first estimate.
                  This dashboard will fill in as you use the app.
                </Text>
                <TouchableOpacity style={s.firstRunBtn} onPress={() => navigation.navigate('Intake')}>
                  <Text style={s.firstRunBtnTxt}>Capture First Lead →</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.firstRunBtn, { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border }]} onPress={() => navigation.navigate('NewEstimate')}>
                  <Text style={[s.firstRunBtnTxt, { color: T.text }]}>Or Start an Estimate →</Text>
                </TouchableOpacity>
              </View>
            );
          }
          if (!isFirstRun) {
            return (
              <View style={s.allClearCard}>
                <Text style={s.allClearIcon}>✓</Text>
                <Text style={s.allClearTxt}>All caught up</Text>
                <Text style={s.allClearSub}>No overdue follow-ups or pending actions.</Text>
              </View>
            );
          }
          return null;
        })()}

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  scroll: { padding: 20, paddingBottom: 60 },
  quickActions: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  quickBtn: { flex: 1, backgroundColor: T.surface, borderRadius: radii.md, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: T.border },
  quickIcon: { fontSize: 22, marginBottom: 4 },
  quickTxt: { color: T.text, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  statRow: { flexDirection: 'row', gap: 10 },
  pipelineScroll: { marginHorizontal: -20, paddingHorizontal: 20 },
  pipelineCard: { borderRadius: radii.lg, padding: 14, borderWidth: 1, marginRight: 10, minWidth: 90, alignItems: 'center' },
  pipelineCount: { fontSize: 28, fontWeight: '800' },
  pipelineLabel: { fontSize: 11, fontWeight: '600', marginTop: 4, textAlign: 'center' },
  roiCard: { backgroundColor: T.surface, borderRadius: radii.lg, padding: 16, borderWidth: 1, borderColor: T.border, flexDirection: 'row', gap: 20 },
  roiStat: { flex: 1 },
  roiValue: { color: T.text, fontSize: 26, fontWeight: '800' },
  roiLabel: { color: T.sub, fontSize: 12, marginTop: 4 },
  roiNote: { color: T.muted, fontSize: 11, marginTop: 8, lineHeight: 16, fontStyle: 'italic' },
  attentionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: T.surface, borderRadius: radii.md, padding: 14, borderWidth: 1, borderColor: T.border, marginBottom: 8 },
  attentionDot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  attentionTitle: { color: T.text, fontSize: 14, fontWeight: '600' },
  attentionReason: { color: T.sub, fontSize: 12, marginTop: 2 },
  arrow: { color: T.sub, fontSize: 20 },
  allClearCard: { marginTop: 20, alignItems: 'center', padding: 40 },
  allClearIcon: { color: T.green, fontSize: 36, fontWeight: '800', marginBottom: 8 },
  allClearTxt: { color: T.text, fontSize: 18, fontWeight: '700' },
  allClearSub: { color: T.sub, fontSize: 13, marginTop: 6, textAlign: 'center' },
  firstRunCard: { marginTop: 20, backgroundColor: T.surface, borderRadius: radii.xl, padding: 28, borderWidth: 1, borderColor: T.border, alignItems: 'center', gap: 12 },
  firstRunTitle: { color: T.text, fontSize: 20, fontWeight: '800' },
  firstRunSub: { color: T.sub, fontSize: 14, textAlign: 'center', lineHeight: 21 },
  firstRunBtn: { width: '100%', backgroundColor: T.accent, borderRadius: radii.lg, paddingVertical: 14, alignItems: 'center' },
  firstRunBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
