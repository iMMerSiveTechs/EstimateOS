// ─── OnboardingScreen ─────────────────────────────────────────────────────────
// Phase 10: First-run setup for a new Estimate OS workspace.
// Collects company profile, vertical selection, and basic defaults.
// Once complete, sets onboarding flag and navigates to main app.
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSettings, saveSettings } from '../storage/settings';
import { T, radii } from '../theme';

export const ONBOARDING_KEY = '@estimateos_onboarding_v1';

// ─── Vertical catalog (Phase 10) ─────────────────────────────────────────────
// Only "roofing" is fully implemented. Others are placeholder-ready.
const VERTICALS = [
  { id: 'roofing',          label: 'Roofing',            icon: '🏠', available: true },
  { id: 'landscaping',      label: 'Landscaping',        icon: '🌿', available: false },
  { id: 'hvac',             label: 'HVAC',               icon: '❄️', available: false },
  { id: 'plumbing',         label: 'Plumbing',           icon: '🔧', available: false },
  { id: 'electrical',       label: 'Electrical',         icon: '⚡', available: false },
  { id: 'general_contractor', label: 'General Contractor', icon: '🏗️', available: false },
];

const ESTIMATE_PREFIXES = ['EST', 'QT', 'RFQ', 'PROP'];
const INVOICE_PREFIXES  = ['INV', 'INV-', 'BILL'];

export interface OnboardingData {
  companyName: string;
  vertical: string;
  phone: string;
  email: string;
  website: string;
  city: string;
  state: string;
  estimatePrefix: string;
  invoicePrefix: string;
  completedAt: string;
}

interface Props {
  onComplete: (data: OnboardingData) => void;
}

export function OnboardingScreen({ onComplete }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState(false);

  // Step 1: Company
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');

  // Step 2: Vertical
  const [vertical, setVertical] = useState('roofing');

  // Step 3: Defaults
  const [estimatePrefix, setEstimatePrefix] = useState('EST');
  const [invoicePrefix, setInvoicePrefix] = useState('INV');

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (step === 1 && !companyName.trim()) e.companyName = 'Company name is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const nextStep = () => {
    if (!validate()) return;
    setStep(s => Math.min(s + 1, 3) as 1 | 2 | 3);
  };

  const finish = async () => {
    setSaving(true);
    try {
      const data: OnboardingData = {
        companyName: companyName.trim(),
        vertical,
        phone: phone.trim(),
        email: email.trim(),
        website: website.trim(),
        city: city.trim(),
        state: state.trim(),
        estimatePrefix,
        invoicePrefix,
        completedAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(ONBOARDING_KEY, JSON.stringify(data));

      // Persist into Firestore AppSettings so business profile + prefixes
      // are immediately available to all screens without extra setup.
      try {
        const settings = await getSettings();
        settings.businessProfile = {
          ...settings.businessProfile,
          businessName: data.companyName,
          phone:        data.phone || settings.businessProfile.phone,
          email:        data.email || settings.businessProfile.email,
          website:      data.website || settings.businessProfile.website,
          address:      [data.city, data.state].filter(Boolean).join(', ') || settings.businessProfile.address,
        };
        settings.exportSettings = {
          ...settings.exportSettings,
          estimatePrefix: data.estimatePrefix + '-',
          invoicePrefix:  data.invoicePrefix + '-',
        };
        await saveSettings(settings);
      } catch { /* non-fatal: user can always update via SettingsScreen */ }

      onComplete(data);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.logo}>JobForge</Text>
          <Text style={s.tagline}>Set up your workspace</Text>
          <View style={s.progress}>
            {[1, 2, 3].map(n => (
              <View key={n} style={[s.dot, step >= n && s.dotActive]}>
                {step > n && <Text style={s.dotCheck}>✓</Text>}
              </View>
            ))}
          </View>
        </View>

        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          {step === 1 && (
            <>
              <Text style={s.stepTitle}>Your Business</Text>
              <Text style={s.stepSub}>Tell us the basics — you can update everything later.</Text>

              <Text style={s.label}>Company Name *</Text>
              <TextInput
                style={[s.input, errors.companyName && s.inputErr]}
                value={companyName}
                onChangeText={v => { setCompanyName(v); setErrors(e => ({ ...e, companyName: '' })); }}
                placeholder="e.g. Acme Roofing"
                placeholderTextColor={T.muted}
                autoCapitalize="words"
              />
              {errors.companyName ? <Text style={s.err}>{errors.companyName}</Text> : null}

              <Text style={s.label}>Phone</Text>
              <TextInput style={s.input} value={phone} onChangeText={setPhone} placeholder="(555) 555-5555" placeholderTextColor={T.muted} keyboardType="phone-pad" />

              <Text style={s.label}>Email</Text>
              <TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="info@yourcompany.com" placeholderTextColor={T.muted} keyboardType="email-address" autoCapitalize="none" />

              <Text style={s.label}>Website</Text>
              <TextInput style={s.input} value={website} onChangeText={setWebsite} placeholder="yourcompany.com" placeholderTextColor={T.muted} autoCapitalize="none" />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 2 }}>
                  <Text style={s.label}>City</Text>
                  <TextInput style={s.input} value={city} onChangeText={setCity} placeholder="Austin" placeholderTextColor={T.muted} autoCapitalize="words" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>State</Text>
                  <TextInput style={s.input} value={state} onChangeText={setState} placeholder="TX" placeholderTextColor={T.muted} autoCapitalize="characters" maxLength={2} />
                </View>
              </View>
            </>
          )}

          {step === 2 && (
            <>
              <Text style={s.stepTitle}>Service Type</Text>
              <Text style={s.stepSub}>What kind of work does your business do?</Text>

              <View style={s.verticalGrid}>
                {VERTICALS.map(v => (
                  <TouchableOpacity
                    key={v.id}
                    style={[
                      s.verticalCard,
                      vertical === v.id && s.verticalCardActive,
                      !v.available && s.verticalCardDisabled,
                    ]}
                    onPress={() => v.available && setVertical(v.id)}
                    disabled={!v.available}
                  >
                    <Text style={s.verticalIcon}>{v.icon}</Text>
                    <Text style={[s.verticalLabel, vertical === v.id && s.verticalLabelActive, !v.available && s.verticalLabelDisabled]}>
                      {v.label}
                    </Text>
                    {!v.available && <Text style={s.comingSoon}>Coming soon</Text>}
                  </TouchableOpacity>
                ))}
              </View>

              <View style={s.infoCard}>
                <Text style={s.infoTitle}>Roofing includes:</Text>
                <Text style={s.infoItem}>• Roof replacement, repair, leak repair</Text>
                <Text style={s.infoItem}>• Flashing, skylights, gutters</Text>
                <Text style={s.infoItem}>• Roofing-specific pricing rules + materials</Text>
                <Text style={s.infoItem}>• Pre-built intake questions and templates</Text>
              </View>
            </>
          )}

          {step === 3 && (
            <>
              <Text style={s.stepTitle}>Numbering Defaults</Text>
              <Text style={s.stepSub}>How should estimates and invoices be numbered?</Text>

              <Text style={s.label}>Estimate Number Prefix</Text>
              <View style={s.prefixRow}>
                {ESTIMATE_PREFIXES.map(p => (
                  <TouchableOpacity key={p} style={[s.prefixChip, estimatePrefix === p && s.prefixChipActive]} onPress={() => setEstimatePrefix(p)}>
                    <Text style={[s.prefixTxt, estimatePrefix === p && s.prefixTxtActive]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={s.previewTxt}>Preview: {estimatePrefix}-0001</Text>

              <Text style={s.label}>Invoice Number Prefix</Text>
              <View style={s.prefixRow}>
                {INVOICE_PREFIXES.map(p => (
                  <TouchableOpacity key={p} style={[s.prefixChip, invoicePrefix === p && s.prefixChipActive]} onPress={() => setInvoicePrefix(p)}>
                    <Text style={[s.prefixTxt, invoicePrefix === p && s.prefixTxtActive]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={s.previewTxt}>Preview: {invoicePrefix}-0001</Text>

              {/* Summary */}
              <View style={s.summaryCard}>
                <Text style={s.summaryLabel}>WORKSPACE SUMMARY</Text>
                <Text style={s.summaryRow}><Text style={s.summaryKey}>Company  </Text>{companyName}</Text>
                <Text style={s.summaryRow}><Text style={s.summaryKey}>Vertical  </Text>{VERTICALS.find(v => v.id === vertical)?.label}</Text>
                {city || state ? <Text style={s.summaryRow}><Text style={s.summaryKey}>Location  </Text>{[city, state].filter(Boolean).join(', ')}</Text> : null}
                <Text style={s.summaryRow}><Text style={s.summaryKey}>Estimates  </Text>{estimatePrefix}-NNNN</Text>
                <Text style={s.summaryRow}><Text style={s.summaryKey}>Invoices  </Text>{invoicePrefix}-NNNN</Text>
              </View>

              <Text style={s.finePrint}>
                You can change all of these settings later under Settings → Business Profile.
              </Text>
            </>
          )}
        </ScrollView>

        <View style={s.footer}>
          {step > 1 && (
            <TouchableOpacity style={s.backBtn} onPress={() => setStep(s => Math.max(s - 1, 1) as 1 | 2 | 3)}>
              <Text style={s.backTxt}>← Back</Text>
            </TouchableOpacity>
          )}
          {step < 3 ? (
            <TouchableOpacity style={s.nextBtn} onPress={nextStep}>
              <Text style={s.nextTxt}>Continue →</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={s.finishBtn} onPress={finish} disabled={saving}>
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.finishTxt}>Get Started →</Text>}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Helper: check if onboarding is complete ──────────────────────────────────
export async function isOnboardingComplete(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(ONBOARDING_KEY);
    return !!val;
  } catch { return false; }
}

export async function getOnboardingData(): Promise<OnboardingData | null> {
  try {
    const val = await AsyncStorage.getItem(ONBOARDING_KEY);
    return val ? JSON.parse(val) : null;
  } catch { return null; }
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  header: { alignItems: 'center', paddingTop: 32, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: T.border },
  logo: { color: T.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  tagline: { color: T.sub, fontSize: 14, marginTop: 4 },
  progress: { flexDirection: 'row', gap: 12, marginTop: 20 },
  dot: { width: 32, height: 8, borderRadius: 4, backgroundColor: T.border, alignItems: 'center', justifyContent: 'center' },
  dotActive: { backgroundColor: T.accent, width: 48 },
  dotCheck: { color: '#fff', fontSize: 10, fontWeight: '700' },
  scroll: { padding: 24, paddingBottom: 24 },
  stepTitle: { color: T.text, fontSize: 22, fontWeight: '800', marginBottom: 6 },
  stepSub: { color: T.sub, fontSize: 14, marginBottom: 28, lineHeight: 20 },
  label: { color: T.textDim, fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 18 },
  input: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: radii.md, color: T.text, padding: 12, fontSize: 15 },
  inputErr: { borderColor: T.red },
  err: { color: T.red, fontSize: 12, marginTop: 4 },
  verticalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  verticalCard: { width: '30%', backgroundColor: T.surface, borderRadius: radii.lg, padding: 14, borderWidth: 1, borderColor: T.border, alignItems: 'center', gap: 6 },
  verticalCardActive: { borderColor: T.accent, backgroundColor: T.accentLo },
  verticalCardDisabled: { opacity: 0.45 },
  verticalIcon: { fontSize: 28 },
  verticalLabel: { color: T.text, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  verticalLabelActive: { color: T.accent },
  verticalLabelDisabled: { color: T.muted },
  comingSoon: { color: T.muted, fontSize: 9, textAlign: 'center', marginTop: -2 },
  infoCard: { backgroundColor: T.surface, borderRadius: radii.lg, padding: 16, marginTop: 20, borderWidth: 1, borderColor: T.border },
  infoTitle: { color: T.textDim, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 },
  infoItem: { color: T.sub, fontSize: 13, marginTop: 4, lineHeight: 20 },
  prefixRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  prefixChip: { borderWidth: 1, borderColor: T.border, borderRadius: radii.md, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: T.surface },
  prefixChipActive: { borderColor: T.accent, backgroundColor: T.accentLo },
  prefixTxt: { color: T.sub, fontSize: 14, fontWeight: '600' },
  prefixTxtActive: { color: T.accent },
  previewTxt: { color: T.muted, fontSize: 12, marginTop: 8, fontStyle: 'italic' },
  summaryCard: { backgroundColor: T.surface, borderRadius: radii.lg, padding: 16, borderWidth: 1, borderColor: T.border, marginTop: 24 },
  summaryLabel: { color: T.sub, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 },
  summaryRow: { color: T.sub, fontSize: 14, marginTop: 6 },
  summaryKey: { color: T.textDim, fontWeight: '600' },
  finePrint: { color: T.muted, fontSize: 12, textAlign: 'center', marginTop: 16, lineHeight: 18 },
  footer: { padding: 20, paddingBottom: 36, borderTopWidth: 1, borderTopColor: T.border, gap: 10 },
  backBtn: { alignItems: 'center', paddingVertical: 10 },
  backTxt: { color: T.sub, fontSize: 15 },
  nextBtn: { backgroundColor: T.accent, borderRadius: radii.lg, paddingVertical: 16, alignItems: 'center' },
  nextTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  finishBtn: { backgroundColor: T.green, borderRadius: radii.lg, paddingVertical: 16, alignItems: 'center' },
  finishTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
