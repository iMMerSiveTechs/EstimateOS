// ─── CustomerDetailScreen ─────────────────────────────────────────────────
import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  SafeAreaView, Alert, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  Customer, Estimate, Invoice, FollowUpStatus,
  PreferredContact, PREFERRED_CONTACT_LABELS,
} from '../models/types';
import { CustomerRepository } from '../storage/customers';
import { EstimateRepository } from '../storage/repository';
import { InvoiceRepository } from '../storage/invoices';
import { TimelineRepository } from '../storage/workflow';
import { FollowUpPanel } from '../components/FollowUpPanel';
import { ReminderSheet } from '../components/ReminderSheet';
import { CommReviewModal } from '../components/CommReviewModal';
import { T, radii } from '../theme';

function SectionHeader({ title }: { title: string }) {
  return <Text style={sh.txt}>{title}</Text>;
}
const sh = StyleSheet.create({ txt: { color: T.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginTop: 28, marginBottom: 10 } });

const CONTACT_OPTIONS: PreferredContact[] = ['any', 'phone', 'email', 'text'];

export function CustomerDetailScreen({ route, navigation }: any) {
  const { customerId } = route?.params ?? {};
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const [showComm, setShowComm] = useState(false);

  // Edit form state
  const [name, setName]                   = useState('');
  const [companyName, setCompanyName]     = useState('');
  const [phone, setPhone]                 = useState('');
  const [email, setEmail]                 = useState('');
  const [address, setAddress]             = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [preferredContact, setPreferredContact] = useState<PreferredContact>('any');
  const [tagsInput, setTagsInput]         = useState('');  // comma-separated
  const [notes, setNotes]                 = useState('');
  const [nameErr, setNameErr]             = useState('');

  const load = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    try {
      const [c, allEsts, invs] = await Promise.all([
        CustomerRepository.getCustomer(customerId),
        EstimateRepository.listEstimates(),
        InvoiceRepository.listByCustomer(customerId),
      ]);
      setCustomer(c);
      setEstimates(allEsts.filter(e => e.customerId === customerId));
      setInvoices(invs);
    } finally { setLoading(false); }
  }, [customerId]);

  useFocusEffect(load);

  const startEdit = () => {
    if (!customer) return;
    setName(customer.name);
    setCompanyName(customer.companyName ?? '');
    setPhone(customer.phone ?? '');
    setEmail(customer.email ?? '');
    setAddress(customer.address ?? '');
    setBillingAddress(customer.billingAddress ?? '');
    setPreferredContact(customer.preferredContact ?? 'any');
    setTagsInput((customer.tags ?? []).join(', '));
    setNotes(customer.notes ?? '');
    setNameErr('');
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!name.trim()) { setNameErr('Name is required'); return; }
    if (!customer) return;
    setSaving(true);
    try {
      const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
      const updated: Customer = {
        ...customer,
        name: name.trim(),
        companyName: companyName.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        billingAddress: billingAddress.trim() || undefined,
        preferredContact: preferredContact !== 'any' ? preferredContact : undefined,
        tags: tags.length > 0 ? tags : undefined,
        notes: notes.trim() || undefined,
        updatedAt: new Date().toISOString(),
      };
      await CustomerRepository.upsertCustomer(updated);
      setCustomer(updated);
      setEditing(false);
    } finally { setSaving(false); }
  };

  const handleDelete = () => {
    Alert.alert('Delete Customer', 'This will not delete linked estimates or invoices.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await CustomerRepository.deleteCustomer(customerId);
        navigation.goBack();
      }},
    ]);
  };

  if (loading) return <SafeAreaView style={s.safe}><ActivityIndicator style={{ marginTop: 60 }} color={T.accent} /></SafeAreaView>;
  if (!customer) return <SafeAreaView style={s.safe}><Text style={s.notFound}>Customer not found.</Text></SafeAreaView>;

  // ── Edit form ─────────────────────────────────────────────────────────────
  if (editing) {
    return (
      <SafeAreaView style={s.safe}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.editHeader}>
            <TouchableOpacity onPress={() => setEditing(false)}><Text style={s.cancel}>Cancel</Text></TouchableOpacity>
            <Text style={s.editTitle}>Edit Customer</Text>
            <TouchableOpacity onPress={saveEdit} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color={T.accent} /> : <Text style={s.saveBtn}>Save</Text>}
            </TouchableOpacity>
          </View>

          <Text style={s.label}>Name *</Text>
          <TextInput style={[s.input, nameErr ? s.inputErr : null]} value={name} onChangeText={t => { setName(t); setNameErr(''); }} placeholder="Full name" placeholderTextColor={T.muted} autoCapitalize="words" />
          {nameErr ? <Text style={s.err}>{nameErr}</Text> : null}

          <Text style={s.label}>Company / Business Name</Text>
          <TextInput style={s.input} value={companyName} onChangeText={setCompanyName} placeholder="Acme Corp (optional)" placeholderTextColor={T.muted} autoCapitalize="words" />

          <Text style={s.label}>Phone</Text>
          <TextInput style={s.input} value={phone} onChangeText={setPhone} placeholder="(555) 555-5555" placeholderTextColor={T.muted} keyboardType="phone-pad" />

          <Text style={s.label}>Email</Text>
          <TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="email@example.com" placeholderTextColor={T.muted} keyboardType="email-address" autoCapitalize="none" />

          <Text style={s.label}>Service Address</Text>
          <TextInput style={[s.input, s.inputMulti]} value={address} onChangeText={setAddress} placeholder="Street, City, State ZIP" placeholderTextColor={T.muted} multiline numberOfLines={2} textAlignVertical="top" />

          <Text style={s.label}>Billing Address</Text>
          <TextInput style={[s.input, s.inputMulti]} value={billingAddress} onChangeText={setBillingAddress} placeholder="If different from service address" placeholderTextColor={T.muted} multiline numberOfLines={2} textAlignVertical="top" />

          <Text style={s.label}>Preferred Contact</Text>
          <View style={s.contactRow}>
            {CONTACT_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt}
                style={[s.contactChip, preferredContact === opt && s.contactChipActive]}
                onPress={() => setPreferredContact(opt)}
              >
                <Text style={[s.contactChipTxt, preferredContact === opt && s.contactChipTxtActive]}>
                  {PREFERRED_CONTACT_LABELS[opt]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.label}>Tags</Text>
          <TextInput style={s.input} value={tagsInput} onChangeText={setTagsInput} placeholder="roofing, repeat, referral (comma-separated)" placeholderTextColor={T.muted} autoCapitalize="none" />

          <Text style={s.label}>Notes</Text>
          <TextInput style={[s.input, s.inputMulti]} value={notes} onChangeText={setNotes} placeholder="Notes…" placeholderTextColor={T.muted} multiline numberOfLines={3} textAlignVertical="top" />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── View mode ─────────────────────────────────────────────────────────────

  type TimelineItem =
    | { kind: 'estimate'; item: Estimate; date: string }
    | { kind: 'invoice'; item: Invoice; date: string };

  const timeline: TimelineItem[] = [
    ...estimates.map(e => ({ kind: 'estimate' as const, item: e, date: e.updatedAt })),
    ...invoices.map(i => ({ kind: 'invoice' as const, item: i, date: i.updatedAt })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll}>
        {/* Info card */}
        <View style={s.card}>
          <View style={s.cardTop}>
            <View style={s.bigAvatar}>
              <Text style={s.bigAvatarTxt}>{customer.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.customerName}>{customer.name}</Text>
              {customer.companyName && <Text style={s.companyLine}>{customer.companyName}</Text>}
              {customer.phone && <Text style={s.infoLine}>📞 {customer.phone}</Text>}
              {customer.email && <Text style={s.infoLine}>✉️ {customer.email}</Text>}
              {customer.address && <Text style={s.infoLine}>📍 {customer.address}</Text>}
              {customer.billingAddress && customer.billingAddress !== customer.address && (
                <Text style={s.infoLine}>🧾 Billing: {customer.billingAddress}</Text>
              )}
              {customer.preferredContact && customer.preferredContact !== 'any' && (
                <Text style={s.infoLine}>💬 Prefers {PREFERRED_CONTACT_LABELS[customer.preferredContact]}</Text>
              )}
            </View>
          </View>

          {/* Tags */}
          {customer.tags && customer.tags.length > 0 && (
            <View style={s.tagsRow}>
              {customer.tags.map(tag => (
                <View key={tag} style={s.tag}>
                  <Text style={s.tagTxt}>{tag}</Text>
                </View>
              ))}
            </View>
          )}

          {customer.notes && <Text style={s.notes}>{customer.notes}</Text>}

          <View style={s.cardActions}>
            <TouchableOpacity style={s.editBtn} onPress={startEdit}>
              <Text style={s.editBtnTxt}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.deleteBtn} onPress={handleDelete}>
              <Text style={s.deleteBtnTxt}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Follow-up panel */}
        <Text style={sh.txt}>Follow-up</Text>
        <FollowUpPanel
          status={customer.followUpStatus}
          lastContactAt={customer.lastContactAt}
          nextActionAt={customer.nextActionAt}
          nextActionNote={customer.nextActionNote}
          onStatusChange={async (status: FollowUpStatus) => {
            const updated = { ...customer, followUpStatus: status, updatedAt: new Date().toISOString() };
            setCustomer(updated);
            await CustomerRepository.upsertCustomer(updated);
            await TimelineRepository.appendEvent({ customerId: customer.id, type: 'status_changed', note: `Status → ${status}` });
          }}
          onNextActionChange={async (date, note) => {
            const updated = { ...customer, nextActionAt: date, nextActionNote: note, updatedAt: new Date().toISOString() };
            setCustomer(updated);
            await CustomerRepository.upsertCustomer(updated);
          }}
          onMarkContacted={async () => {
            const now = new Date().toISOString();
            const updated = { ...customer, lastContactAt: now, updatedAt: now };
            setCustomer(updated);
            await CustomerRepository.upsertCustomer(updated);
            await TimelineRepository.appendEvent({ customerId: customer.id, type: 'note_added', note: 'Marked as contacted' });
          }}
        />

        {/* Quick comms */}
        <View style={s.commRow}>
          <TouchableOpacity style={s.commBtn} onPress={() => setShowReminder(true)}>
            <Text style={s.commBtnTxt}>⏰ Reminder</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.commBtn} onPress={() => setShowComm(true)}>
            <Text style={s.commBtnTxt}>✉️ Message</Text>
          </TouchableOpacity>
        </View>

        {/* Timeline */}
        <SectionHeader title={`History (${timeline.length})`} />
        {timeline.length === 0 ? (
          <View style={s.emptyTimeline}>
            <Text style={s.emptyTimelineTxt}>No estimates or invoices yet</Text>
          </View>
        ) : (
          timeline.map((t, i) => {
            const date = new Date(t.date);
            if (t.kind === 'estimate') {
              const est = t.item;
              return (
                <TouchableOpacity key={i} style={s.timelineRow} onPress={() => navigation.navigate('EstimateDetail', { estimateId: est.id })}>
                  <View style={[s.timelineDot, { backgroundColor: T.accentLo }]}><Text style={{ fontSize: 12 }}>📋</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.timelineTitle}>{est.estimateNumber ?? 'Estimate'} — {est.status}</Text>
                    <Text style={s.timelineSub}>${(est.computedRange?.min ?? 0).toLocaleString('en-US')}–${(est.computedRange?.max ?? 0).toLocaleString('en-US')}</Text>
                    <Text style={s.timelineDate}>{date.toLocaleDateString()}</Text>
                  </View>
                  <Text style={s.arrow}>›</Text>
                </TouchableOpacity>
              );
            } else {
              const inv = t.item;
              return (
                <TouchableOpacity key={i} style={s.timelineRow} onPress={() => navigation.navigate('Invoice', { invoiceId: inv.id })}>
                  <View style={[s.timelineDot, { backgroundColor: T.greenLo }]}><Text style={{ fontSize: 12 }}>🧾</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.timelineTitle}>{inv.invoiceNumber} — {inv.status}</Text>
                    <Text style={s.timelineSub}>{inv.paymentTerms}</Text>
                    <Text style={s.timelineDate}>{date.toLocaleDateString()}</Text>
                  </View>
                  <Text style={s.arrow}>›</Text>
                </TouchableOpacity>
              );
            }
          })
        )}
      </ScrollView>

      <ReminderSheet
        visible={showReminder}
        initial={{ customerId: customer.id, customerName: customer.name, type: 'callback' }}
        onClose={() => setShowReminder(false)}
        onSaved={() => setShowReminder(false)}
      />

      <CommReviewModal
        visible={showComm}
        vars={{ customer_name: customer.name, address: customer.address }}
        onClose={() => setShowComm(false)}
        onSent={() => setShowComm(false)}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  scroll: { padding: 20, paddingBottom: 60 },
  notFound: { color: T.sub, fontSize: 16, textAlign: 'center', marginTop: 60 },
  card: { backgroundColor: T.surface, borderRadius: radii.lg, padding: 16, borderWidth: 1, borderColor: T.border },
  cardTop: { flexDirection: 'row', gap: 14, marginBottom: 12 },
  bigAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: T.accentLo, alignItems: 'center', justifyContent: 'center' },
  bigAvatarTxt: { color: T.accent, fontSize: 24, fontWeight: '700' },
  customerName: { color: T.text, fontSize: 20, fontWeight: '700', marginBottom: 2 },
  companyLine: { color: T.sub, fontSize: 13, marginBottom: 4 },
  infoLine: { color: T.sub, fontSize: 13, marginTop: 2 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: T.border },
  tag: { backgroundColor: T.accentLo, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  tagTxt: { color: T.accentHi, fontSize: 11, fontWeight: '600' },
  notes: { color: T.textDim, fontSize: 13, lineHeight: 19, paddingTop: 10, borderTopWidth: 1, borderTopColor: T.border, marginTop: 10 },
  cardActions: { flexDirection: 'row', gap: 10, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: T.border },
  editBtn: { flex: 1, backgroundColor: T.accent, borderRadius: radii.md, padding: 11, alignItems: 'center' },
  editBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
  deleteBtn: { borderWidth: 1, borderColor: T.red, borderRadius: radii.md, paddingHorizontal: 16, padding: 11, alignItems: 'center' },
  deleteBtnTxt: { color: T.red, fontWeight: '600', fontSize: 14 },
  emptyTimeline: { padding: 20, alignItems: 'center' },
  emptyTimelineTxt: { color: T.muted, fontSize: 14 },
  timelineRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: T.surface, borderRadius: radii.md, padding: 14, borderWidth: 1, borderColor: T.border, marginBottom: 8 },
  timelineDot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  timelineTitle: { color: T.text, fontSize: 14, fontWeight: '600' },
  timelineSub: { color: T.sub, fontSize: 12, marginTop: 2 },
  timelineDate: { color: T.muted, fontSize: 11, marginTop: 2 },
  arrow: { color: T.sub, fontSize: 20 },
  commRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  commBtn: { flex: 1, backgroundColor: T.surface, borderRadius: radii.md, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: T.border },
  commBtnTxt: { color: T.text, fontSize: 13, fontWeight: '600' },
  // Edit form
  editHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  editTitle: { color: T.text, fontSize: 17, fontWeight: '700' },
  cancel: { color: T.sub, fontSize: 16 },
  saveBtn: { color: T.accent, fontSize: 16, fontWeight: '700' },
  label: { color: T.textDim, fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 16 },
  input: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: radii.sm, color: T.text, padding: 12, fontSize: 15 },
  inputMulti: { minHeight: 70, paddingTop: 10 },
  inputErr: { borderColor: T.red }, err: { color: T.red, fontSize: 12, marginTop: 4 },
  // Preferred contact chips
  contactRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  contactChip: { borderWidth: 1, borderColor: T.border, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: T.surface },
  contactChipActive: { backgroundColor: T.accent, borderColor: T.accent },
  contactChipTxt: { color: T.sub, fontSize: 13 },
  contactChipTxtActive: { color: '#fff', fontWeight: '700' },
});
