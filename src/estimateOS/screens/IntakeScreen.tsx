// ─── IntakeScreen ─────────────────────────────────────────────────────────────
// Phase 6: Lead capture → customer record + estimate draft + follow-up task.
// Natural Origins: capture phone calls, site visits, referrals quickly.
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  SafeAreaView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { CustomerRepository } from '../storage/customers';
import { IntakeDraftRepository } from '../storage/workflow';
import { TimelineRepository } from '../storage/workflow';
import { Customer, IntakeDraft, LeadUrgency, LEAD_URGENCY_LABELS } from '../models/types';
import { makeId } from '../domain/id';
import { T, radii } from '../theme';

const SERVICE_TYPES = [
  'Roof Replacement',
  'Roof Repair',
  'Leak Repair',
  'Flashing / Skylights',
  'Gutters',
  'Inspection / Assessment',
  'Other',
];

const REFERRAL_SOURCES = [
  'Google',
  'Referral',
  'Repeat Customer',
  'Door Hanger / Flyer',
  'Yard Sign',
  'Social Media',
  'Neighbor',
  'Other',
];

export function IntakeScreen({ navigation }: any) {
  // Step 1: Contact
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // Step 2: Job
  const [propertyAddress, setPropertyAddress] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [urgency, setUrgency] = useState<LeadUrgency>('flexible');

  // Step 3: Notes
  const [notes, setNotes] = useState('');
  const [referralSource, setReferralSource] = useState('');

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState(false);

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (step === 1) {
      if (!customerName.trim()) e.customerName = 'Name is required';
      if (!phone.trim() && !email.trim()) e.phone = 'Phone or email required';
    }
    if (step === 2) {
      if (!propertyAddress.trim()) e.propertyAddress = 'Property address is required';
      if (!serviceType) e.serviceType = 'Select a service type';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const nextStep = () => {
    if (!validate()) return;
    setStep(s => Math.min(s + 1, 3) as 1 | 2 | 3);
  };

  const prevStep = () => setStep(s => Math.max(s - 1, 1) as 1 | 2 | 3);

  const saveDraft = async (then: 'save' | 'convert_customer' | 'convert_estimate') => {
    if (!validate() && then !== 'save') return;
    setSaving(true);
    try {
      const draft = IntakeDraftRepository.makeNew();
      const full: IntakeDraft = {
        ...draft,
        customerName: customerName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        propertyAddress: propertyAddress.trim(),
        serviceType,
        urgency,
        notes: notes.trim(),
        referralSource: referralSource || undefined,
      };

      let customerId: string | undefined;

      if (then === 'convert_customer' || then === 'convert_estimate') {
        // Create customer record
        const now = new Date().toISOString();
        const customer: Customer = {
          id: makeId(),
          name: full.customerName,
          phone: full.phone || undefined,
          email: full.email || undefined,
          address: full.propertyAddress || undefined,
          notes: full.notes || undefined,
          followUpStatus: 'quote_in_progress',
          createdAt: now,
          updatedAt: now,
        };
        await CustomerRepository.upsertCustomer(customer);
        customerId = customer.id;
        full.customerId = customerId;
        full.status = 'converted';

        // Log timeline event
        await TimelineRepository.appendEvent({
          customerId: customer.id,
          type: 'intake_created',
          note: `Lead intake: ${full.serviceType} at ${full.propertyAddress}`,
        });

        await IntakeDraftRepository.upsertDraft(full);

        if (then === 'convert_estimate') {
          navigation.navigate('NewEstimate', {
            prefillCustomer: {
              id: customer.id,
              name: customer.name,
              phone: customer.phone,
              email: customer.email,
              address: customer.address,
            },
          });
        } else {
          navigation.navigate('CustomerDetail', { customerId: customer.id });
        }
      } else {
        // Save as intake draft only
        await IntakeDraftRepository.upsertDraft(full);
        Alert.alert('Lead Saved', 'Intake draft saved. Convert to customer when ready.');
        navigation.goBack();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Progress */}
        <View style={s.progress}>
          {[1, 2, 3].map(n => (
            <View key={n} style={[s.dot, step >= n && s.dotActive]} />
          ))}
        </View>

        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          {step === 1 && (
            <>
              <Text style={s.stepTitle}>Contact Info</Text>
              <Text style={s.stepSub}>Who called or reached out?</Text>

              <Text style={s.label}>Name *</Text>
              <TextInput
                style={[s.input, errors.customerName && s.inputErr]}
                value={customerName}
                onChangeText={t => { setCustomerName(t); setErrors(e => ({ ...e, customerName: '' })); }}
                placeholder="Full name"
                placeholderTextColor={T.muted}
                autoCapitalize="words"
              />
              {errors.customerName ? <Text style={s.err}>{errors.customerName}</Text> : null}

              <Text style={s.label}>Phone</Text>
              <TextInput
                style={[s.input, errors.phone && s.inputErr]}
                value={phone}
                onChangeText={t => { setPhone(t); setErrors(e => ({ ...e, phone: '' })); }}
                placeholder="(555) 555-5555"
                placeholderTextColor={T.muted}
                keyboardType="phone-pad"
              />
              {errors.phone ? <Text style={s.err}>{errors.phone}</Text> : null}

              <Text style={s.label}>Email</Text>
              <TextInput
                style={s.input}
                value={email}
                onChangeText={setEmail}
                placeholder="email@example.com"
                placeholderTextColor={T.muted}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </>
          )}

          {step === 2 && (
            <>
              <Text style={s.stepTitle}>Job Details</Text>
              <Text style={s.stepSub}>Where and what type of work?</Text>

              <Text style={s.label}>Property Address *</Text>
              <TextInput
                style={[s.input, s.inputMulti, errors.propertyAddress && s.inputErr]}
                value={propertyAddress}
                onChangeText={t => { setPropertyAddress(t); setErrors(e => ({ ...e, propertyAddress: '' })); }}
                placeholder="Street, City, State ZIP"
                placeholderTextColor={T.muted}
                multiline
                numberOfLines={2}
                textAlignVertical="top"
              />
              {errors.propertyAddress ? <Text style={s.err}>{errors.propertyAddress}</Text> : null}

              <Text style={s.label}>Service Type *</Text>
              <View style={s.chipGrid}>
                {SERVICE_TYPES.map(st => (
                  <TouchableOpacity
                    key={st}
                    style={[s.chip, serviceType === st && s.chipActive]}
                    onPress={() => { setServiceType(st); setErrors(e => ({ ...e, serviceType: '' })); }}
                  >
                    <Text style={[s.chipTxt, serviceType === st && s.chipTxtActive]}>{st}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {errors.serviceType ? <Text style={s.err}>{errors.serviceType}</Text> : null}

              <Text style={s.label}>Urgency</Text>
              <View style={s.chipRow}>
                {(Object.keys(LEAD_URGENCY_LABELS) as LeadUrgency[]).map(u => (
                  <TouchableOpacity
                    key={u}
                    style={[s.chip, urgency === u && s.chipActive]}
                    onPress={() => setUrgency(u)}
                  >
                    <Text style={[s.chipTxt, urgency === u && s.chipTxtActive]}>{LEAD_URGENCY_LABELS[u]}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {step === 3 && (
            <>
              <Text style={s.stepTitle}>Notes & Source</Text>
              <Text style={s.stepSub}>Any details worth capturing now?</Text>

              <Text style={s.label}>Notes</Text>
              <TextInput
                style={[s.input, s.inputLong]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Damage description, access issues, customer concerns…"
                placeholderTextColor={T.muted}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />

              <Text style={s.label}>How did they find you?</Text>
              <View style={s.chipGrid}>
                {REFERRAL_SOURCES.map(src => (
                  <TouchableOpacity
                    key={src}
                    style={[s.chip, referralSource === src && s.chipActive]}
                    onPress={() => setReferralSource(referralSource === src ? '' : src)}
                  >
                    <Text style={[s.chipTxt, referralSource === src && s.chipTxtActive]}>{src}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Summary preview */}
              <View style={s.summaryCard}>
                <Text style={s.summaryLabel}>LEAD SUMMARY</Text>
                <Text style={s.summaryName}>{customerName || '—'}</Text>
                {phone ? <Text style={s.summaryDetail}>📞 {phone}</Text> : null}
                {email ? <Text style={s.summaryDetail}>✉️ {email}</Text> : null}
                {propertyAddress ? <Text style={s.summaryDetail}>📍 {propertyAddress}</Text> : null}
                {serviceType ? <Text style={s.summaryDetail}>🔧 {serviceType} · {LEAD_URGENCY_LABELS[urgency]}</Text> : null}
              </View>
            </>
          )}
        </ScrollView>

        {/* Nav + actions */}
        <View style={s.footer}>
          {step > 1 && (
            <TouchableOpacity style={s.backBtn} onPress={prevStep}>
              <Text style={s.backTxt}>Back</Text>
            </TouchableOpacity>
          )}

          {step < 3 ? (
            <TouchableOpacity style={s.nextBtn} onPress={nextStep}>
              <Text style={s.nextTxt}>Next →</Text>
            </TouchableOpacity>
          ) : (
            <View style={s.finalActions}>
              <TouchableOpacity
                style={s.actionSecondary}
                onPress={() => saveDraft('save')}
                disabled={saving}
              >
                <Text style={s.actionSecondaryTxt}>Save Draft</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.actionPrimary}
                onPress={() => saveDraft('convert_customer')}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.actionPrimaryTxt}>Create Customer</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.actionPrimary, { backgroundColor: T.green }]}
                onPress={() => saveDraft('convert_estimate')}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.actionPrimaryTxt}>Start Estimate →</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  progress: { flexDirection: 'row', gap: 8, justifyContent: 'center', paddingVertical: 14 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: T.border },
  dotActive: { backgroundColor: T.accent, width: 24 },
  scroll: { padding: 20, paddingBottom: 20 },
  stepTitle: { color: T.text, fontSize: 22, fontWeight: '800', marginBottom: 4 },
  stepSub: { color: T.sub, fontSize: 14, marginBottom: 24 },
  label: { color: T.textDim, fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 16 },
  input: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: radii.md, color: T.text, padding: 12, fontSize: 15 },
  inputMulti: { minHeight: 60, paddingTop: 10 },
  inputLong: { minHeight: 100, paddingTop: 10 },
  inputErr: { borderColor: T.red },
  err: { color: T.red, fontSize: 12, marginTop: 4 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { borderWidth: 1, borderColor: T.border, borderRadius: radii.lg, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: T.surface },
  chipActive: { borderColor: T.accent, backgroundColor: T.accentLo },
  chipTxt: { color: T.sub, fontSize: 13, fontWeight: '500' },
  chipTxtActive: { color: T.accent, fontWeight: '700' },
  summaryCard: { backgroundColor: T.surface, borderRadius: radii.lg, padding: 16, borderWidth: 1, borderColor: T.border, marginTop: 24 },
  summaryLabel: { color: T.sub, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 },
  summaryName: { color: T.text, fontSize: 18, fontWeight: '700', marginBottom: 4 },
  summaryDetail: { color: T.sub, fontSize: 13, marginTop: 3 },
  footer: { padding: 16, paddingBottom: 24, borderTopWidth: 1, borderTopColor: T.border, gap: 10 },
  backBtn: { alignItems: 'center', paddingVertical: 10 },
  backTxt: { color: T.sub, fontSize: 15 },
  nextBtn: { backgroundColor: T.accent, borderRadius: radii.lg, paddingVertical: 15, alignItems: 'center' },
  nextTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  finalActions: { gap: 10 },
  actionSecondary: { borderWidth: 1, borderColor: T.border, borderRadius: radii.lg, paddingVertical: 13, alignItems: 'center' },
  actionSecondaryTxt: { color: T.sub, fontSize: 15, fontWeight: '600' },
  actionPrimary: { backgroundColor: T.accent, borderRadius: radii.lg, paddingVertical: 15, alignItems: 'center' },
  actionPrimaryTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
