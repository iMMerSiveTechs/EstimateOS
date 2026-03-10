// ─── SettingsScreen ────────────────────────────────────────────────────────
// Business Profile, Export Settings, AI Features, Integrations, Credits
import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  SafeAreaView, Switch, ActivityIndicator, Animated, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AppSettings, AI_CREDITS_LOW_THRESHOLD } from '../models/types';
import { getSettings, saveSettings, DEFAULT_SETTINGS } from '../storage/settings';
import { getCredits } from '../storage/aiCredits';
import { CreditPurchaseModal } from '../components/CreditPurchaseModal';
import { deriveCapabilities } from '../services/capabilities';
import { seedSampleData, clearPilotData } from '../storage/pilotTools';
import { T, radii } from '../theme';

function useToast() {
  const opacity = useRef(new Animated.Value(0)).current;
  const [msg, setMsg] = useState('');
  const show = (text: string) => {
    setMsg(text);
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1600),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  };
  const Toast = () => (
    <Animated.View style={[ts.wrap, { opacity }]} pointerEvents="none">
      <Text style={ts.txt}>{msg}</Text>
    </Animated.View>
  );
  return { show, Toast };
}
const ts = StyleSheet.create({
  wrap: { position: 'absolute', bottom: 40, alignSelf: 'center', backgroundColor: T.green, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10, zIndex: 99 },
  txt: { color: T.greenLo, fontWeight: '700', fontSize: 14 },
});

function SectionHeader({ title }: { title: string }) {
  return <Text style={sh.txt}>{title}</Text>;
}
const sh = StyleSheet.create({ txt: { color: T.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginTop: 28, marginBottom: 12 } });

function FieldRow({ label, value, onChange, multiline = false, keyboard = 'default' as any, placeholder = '' }: {
  label: string; value: string; onChange: (v: string) => void;
  multiline?: boolean; keyboard?: any; placeholder?: string;
}) {
  return (
    <View style={f.wrap}>
      <Text style={f.label}>{label}</Text>
      <TextInput
        style={[f.input, multiline && f.inputMulti]}
        value={value} onChangeText={onChange}
        placeholder={placeholder} placeholderTextColor={T.muted}
        keyboardType={keyboard}
        autoCapitalize={keyboard === 'email-address' ? 'none' : 'sentences'}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        numberOfLines={multiline ? 4 : 1}
      />
    </View>
  );
}
const f = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { color: T.textDim, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: radii.sm, color: T.text, padding: 12, fontSize: 15 },
  inputMulti: { minHeight: 100, paddingTop: 10 },
});

function ToggleRow({ label, subLabel, value, onChange, disabled = false, comingSoon = false }: {
  label: string; subLabel?: string; value: boolean; onChange: (v: boolean) => void;
  disabled?: boolean; comingSoon?: boolean;
}) {
  return (
    <View style={tr.row}>
      <View style={{ flex: 1 }}>
        <View style={tr.labelRow}>
          <Text style={[tr.label, disabled && { color: T.muted }]}>{label}</Text>
          {comingSoon && <View style={tr.csBadge}><Text style={tr.csTxt}>Coming soon</Text></View>}
        </View>
        {subLabel && <Text style={tr.sub}>{subLabel}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled || comingSoon}
        trackColor={{ false: T.border, true: T.accentLo }}
        thumbColor={value ? T.accent : T.sub}
      />
    </View>
  );
}
const tr = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: T.border, gap: 12 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { color: T.text, fontSize: 15, fontWeight: '600' },
  sub: { color: T.sub, fontSize: 12, marginTop: 2 },
  csBadge: { backgroundColor: T.amberLo, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: T.amber },
  csTxt: { color: T.amberHi, fontSize: 10, fontWeight: '700' },
});

export function SettingsScreen({ navigation }: any) {
  const [settings, setSettings]           = useState<AppSettings | null>(null);
  const [saving, setSaving]               = useState(false);
  const [creditBalance, setCreditBalance] = useState(0);
  const [showCredits, setShowCredits]     = useState(false);
  const { show: showToast, Toast } = useToast();

  const load = useCallback(async () => {
    // Load settings and credits independently so a credits failure doesn't
    // reset previously loaded settings to defaults.
    try {
      const s = await getSettings();
      setSettings(s);
    } catch {
      setSettings(prev => prev ?? DEFAULT_SETTINGS);
    }
    try {
      const bal = await getCredits();
      setCreditBalance(bal.balance);
    } catch {
      // credit balance stays at 0; non-fatal
    }
  }, []);

  useFocusEffect(load);

  if (!settings) return <SafeAreaView style={s.safe}><ActivityIndicator style={{ marginTop: 60 }} color={T.accent} /></SafeAreaView>;

  const patch = (update: Partial<AppSettings>) => setSettings(prev => prev ? { ...prev, ...update } : prev);
  const patchProfile = (p: Partial<typeof settings.businessProfile>) => patch({ businessProfile: { ...settings.businessProfile, ...p } });
  const patchExport = (e: Partial<typeof settings.exportSettings>) => patch({ exportSettings: { ...settings.exportSettings, ...e } });
  const patchAi = (a: Partial<typeof settings.aiFeatures>) => patch({ aiFeatures: { ...settings.aiFeatures, ...a } });
  const patchInt = (i: Partial<typeof settings.integrations>) => patch({ integrations: { ...settings.integrations, ...i } });

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSettings(settings);
      showToast('Saved ✓');
    } catch (err: any) {
      showToast(`Save failed: ${err?.message ?? 'unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {/* ── Business Profile ─────────────────────────────────────────── */}
        <SectionHeader title="Business Profile" />
        <FieldRow label="Business Name" value={settings.businessProfile.businessName} onChange={v => patchProfile({ businessName: v })} placeholder="Natural Origins Roofing" />
        <FieldRow label="Phone" value={settings.businessProfile.phone ?? ''} onChange={v => patchProfile({ phone: v })} keyboard="phone-pad" placeholder="(555) 555-5555" />
        <FieldRow label="Email" value={settings.businessProfile.email ?? ''} onChange={v => patchProfile({ email: v })} keyboard="email-address" placeholder="hello@yourcompany.com" />
        <FieldRow label="Website" value={settings.businessProfile.website ?? ''} onChange={v => patchProfile({ website: v })} keyboard="url" placeholder="https://yourcompany.com" />
        <FieldRow label="Address" value={settings.businessProfile.address ?? ''} onChange={v => patchProfile({ address: v })} multiline placeholder="123 Main St, City, State ZIP" />
        <FieldRow label="Terms & Conditions" value={settings.businessProfile.termsAndConditions ?? ''} onChange={v => patchProfile({ termsAndConditions: v })} multiline placeholder="All work is guaranteed for 1 year. Payment due within 30 days…" />

        {/* ── Export Settings ──────────────────────────────────────────── */}
        <SectionHeader title="Export Settings" />
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={s.rowLabel}>Estimate prefix</Text>
            <TextInput style={s.rowInput} value={settings.exportSettings.estimatePrefix} onChangeText={v => patchExport({ estimatePrefix: v })} autoCapitalize="characters" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.rowLabel}>Next #</Text>
            <TextInput style={s.rowInput} value={String(settings.exportSettings.nextEstimateNumber)} onChangeText={v => patchExport({ nextEstimateNumber: Math.max(1, Number(v) || 1) })} keyboardType="numeric" />
          </View>
        </View>
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={s.rowLabel}>Invoice prefix</Text>
            <TextInput style={s.rowInput} value={settings.exportSettings.invoicePrefix} onChangeText={v => patchExport({ invoicePrefix: v })} autoCapitalize="characters" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.rowLabel}>Next #</Text>
            <TextInput style={s.rowInput} value={String(settings.exportSettings.nextInvoiceNumber)} onChangeText={v => patchExport({ nextInvoiceNumber: Math.max(1, Number(v) || 1) })} keyboardType="numeric" />
          </View>
        </View>
        <Text style={s.hint}>Example: {settings.exportSettings.estimatePrefix}{String(settings.exportSettings.nextEstimateNumber).padStart(4, '0')}</Text>

        {/* ── AI Features ──────────────────────────────────────────────── */}
        <SectionHeader title="AI Features" />
        <View style={s.card}>
          <ToggleRow label="Analyze Images" subLabel="AI photo and site analysis" value={settings.aiFeatures.analyzeImages} onChange={v => patchAi({ analyzeImages: v })} />
          <ToggleRow label="Advanced Reasoning" subLabel="Think more when needed for complex estimates" value={settings.aiFeatures.advancedReasoning} onChange={v => patchAi({ advancedReasoning: v })} />
          <ToggleRow label="Video Understanding" subLabel="Video input for AI analysis" value={settings.aiFeatures.videoUnderstanding} onChange={v => patchAi({ videoUnderstanding: v })} comingSoon />
          <ToggleRow label="AI Powered Chatbot" subLabel="In-app assistant" value={settings.aiFeatures.chatbot} onChange={v => patchAi({ chatbot: v })} comingSoon />
        </View>

        {/* ── Integrations ──────────────────────────────────────────────── */}
        <SectionHeader title="Integrations" />
        <View style={s.card}>
          <ToggleRow label="Gemini Intelligence" subLabel="Requires API key — configure in Firebase" value={settings.integrations.gemini} onChange={v => patchInt({ gemini: v })} comingSoon />
          <ToggleRow label="Google Maps" subLabel="Address helpers and location data" value={settings.integrations.googleMaps} onChange={v => patchInt({ googleMaps: v })} comingSoon />
          <ToggleRow label="Voice Input" subLabel="Voice-to-text for field notes" value={settings.integrations.voiceInput} onChange={v => patchInt({ voiceInput: v })} comingSoon />
          <ToggleRow label="Image Creation" subLabel="AI-generated proposal images" value={settings.integrations.imageCreation} onChange={v => patchInt({ imageCreation: v })} comingSoon />
          <ToggleRow
            label="Cloud Sync & Auth"
            subLabel="Firebase connected — estimates sync across devices"
            value={settings.integrations.cloudSync}
            onChange={v => patchInt({ cloudSync: v })}
          />
          <ToggleRow
            label="Stripe Billing"
            subLabel="Enable credit purchases — requires Stripe publishable key"
            value={settings.integrations.stripeEnabled ?? false}
            onChange={v => patchInt({ stripeEnabled: v })}
            comingSoon
          />
        </View>

        {/* ── AI Credits ────────────────────────────────────────────────── */}
        <SectionHeader title="AI Credits" />
        {(() => {
          const color = creditBalance <= 0 ? T.red : creditBalance <= AI_CREDITS_LOW_THRESHOLD ? T.amber : T.green;
          const label = creditBalance <= 0 ? 'No Credits' : creditBalance <= AI_CREDITS_LOW_THRESHOLD ? 'Credits Low' : 'Credits OK';
          return (
            <View style={s.card}>
              <TouchableOpacity style={s.creditRow} onPress={() => setShowCredits(true)}>
                <View style={[s.creditDot, { backgroundColor: color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.creditLabel}>{label}</Text>
                  <Text style={s.creditCount}>{creditBalance} credits remaining</Text>
                  {creditBalance <= 0 && (
                    <Text style={s.creditHint}>AI features are disabled. Buy credits to continue.</Text>
                  )}
                </View>
                <Text style={s.creditCta}>Buy Credits →</Text>
              </TouchableOpacity>
            </View>
          );
        })()}

        {/* ── Workflow Tools ────────────────────────────────────────────── */}
        <SectionHeader title="Workflow Tools" />
        <View style={s.card}>
          <TouchableOpacity style={s.navRow} onPress={() => navigation?.navigate('CommTemplates')}>
            <View style={{ flex: 1 }}>
              <Text style={s.navLabel}>Communication Templates</Text>
              <Text style={s.navSub}>Edit follow-up, invoice, and check-in message templates</Text>
            </View>
            <Text style={s.navArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.navRow, { borderTopWidth: 1, borderTopColor: T.border }]} onPress={() => navigation?.navigate('PricingRules')}>
            <View style={{ flex: 1 }}>
              <Text style={s.navLabel}>Pricing Rules</Text>
              <Text style={s.navSub}>Manage custom pricing rules and vertical overrides</Text>
            </View>
            <Text style={s.navArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* ── Pilot Tools (internal admin) ────────────────────────────── */}
        <SectionHeader title="Pilot Tools" />
        <View style={s.card}>
          <TouchableOpacity style={s.navRow} onPress={async () => {
            Alert.alert(
              'Seed Sample Data',
              'This will add sample customers, estimates, invoices, and reminders for testing. Existing data will not be deleted.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Seed', onPress: async () => {
                  try {
                    const result = await seedSampleData();
                    showToast(`Added ${result.customers} clients, ${result.estimates} estimates, ${result.invoices} invoices`);
                  } catch (err: any) {
                    showToast(`Seed failed: ${err?.message ?? 'unknown error'}`);
                  }
                }},
              ],
            );
          }}>
            <View style={{ flex: 1 }}>
              <Text style={s.navLabel}>Seed Sample Data</Text>
              <Text style={s.navSub}>Add realistic test records for pilot testing</Text>
            </View>
            <Text style={s.navArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.navRow, { borderTopWidth: 1, borderTopColor: T.border }]} onPress={() => {
            Alert.alert(
              'Clear All Data',
              'This will permanently delete all customers, estimates, invoices, reminders, and intake drafts. Settings and business profile are preserved.\n\nThis cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete Everything', style: 'destructive', onPress: async () => {
                  try {
                    await clearPilotData();
                    showToast('All pilot data cleared');
                  } catch (err: any) {
                    showToast(`Clear failed: ${err?.message ?? 'unknown error'}`);
                  }
                }},
              ],
            );
          }}>
            <View style={{ flex: 1 }}>
              <Text style={[s.navLabel, { color: T.red }]}>Clear All Data</Text>
              <Text style={s.navSub}>Delete all test records — settings are preserved</Text>
            </View>
            <Text style={s.navArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* ── Save ─────────────────────────────────────────────────────── */}
        <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnTxt}>Save Settings</Text>}
        </TouchableOpacity>

      </ScrollView>
      <Toast />

      <CreditPurchaseModal
        visible={showCredits}
        onClose={() => setShowCredits(false)}
        stripeEnabled={deriveCapabilities(settings).servicePaymentsReady}
        onPurchased={newBal => setCreditBalance(newBal)}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  scroll: { padding: 20, paddingBottom: 60 },
  card: { backgroundColor: T.surface, borderRadius: radii.lg, paddingHorizontal: 16, borderWidth: 1, borderColor: T.border, overflow: 'hidden' },
  row: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  rowLabel: { color: T.textDim, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  rowInput: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: radii.sm, color: T.text, padding: 11, fontSize: 14 },
  hint: { color: T.muted, fontSize: 12, marginTop: -4, marginBottom: 8 },
  saveBtn: { backgroundColor: T.accent, borderRadius: radii.lg, paddingVertical: 16, alignItems: 'center', marginTop: 28 },
  saveBtnTxt: { color: '#fff', fontSize: 17, fontWeight: '800' },
  creditRow:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 10 },
  creditDot:   { width: 10, height: 10, borderRadius: 5 },
  creditLabel: { color: T.text, fontSize: 14, fontWeight: '700' },
  creditCount: { color: T.sub, fontSize: 12, marginTop: 2 },
  creditHint:  { color: T.red, fontSize: 11, marginTop: 4 },
  creditCta:   { color: T.accent, fontSize: 13, fontWeight: '700' },
  navRow:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 0, gap: 8 },
  navLabel:{ color: T.text, fontSize: 15, fontWeight: '600' },
  navSub:  { color: T.sub, fontSize: 12, marginTop: 2 },
  navArrow:{ color: T.sub, fontSize: 22, marginLeft: 4 },
});
