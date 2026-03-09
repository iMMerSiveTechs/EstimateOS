import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Alert,
  ScrollView, StyleSheet, SafeAreaView, ActivityIndicator, Animated,
  Modal, KeyboardAvoidingView, Platform, Switch,
} from 'react-native';
import { ALL_VERTICALS } from '../config/verticals';
import { VerticalConfig, Estimate, IntakeQuestion, AnswerValue, AI_META_PREFIX, DriverOverrideMap, LineItem, CustomIntakeField } from '../models/types';
import { EstimateRepository } from '../storage/repository';
import { IntakeFormRenderer } from '../components/IntakeFormRenderer';
import { computePricingV2, PricingResultV2 } from '../domain/pricingEngineV2';
import { PricingSummaryCard } from '../components/PricingSummaryCard';
import { makeId } from '../domain/id';
// BUG FIX: load custom verticals so they appear in the selector
import { loadCustomVerticals, mergeVerticals } from '../storage/customVerticals';
import { T, radii, spacing, GlassPanel, GlowButton, Chip, FieldLabel, SectionHeader } from '../theme';
import { getAiHistory, AiScanRecord } from '../storage/aiHistory';
import { useFocusEffect } from '@react-navigation/native';
import { CustomerPicker } from '../components/CustomerPicker';
import { getTemplate } from '../storage/templates';
import { nextEstimateNumber } from '../storage/settings';

// ─── Inline toast ─────────────────────────────────────────────────────────────
function useToast() {
  const opacity = useRef(new Animated.Value(0)).current;
  const [msg, setMsg] = useState('');

  const show = (text: string) => {
    setMsg(text);
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1800),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  const Toast = () => (
    <Animated.View style={[toastStyles.wrap, { opacity }]} pointerEvents="none">
      <Text style={toastStyles.text}>{msg}</Text>
    </Animated.View>
  );

  return { show, Toast };
}

const toastStyles = StyleSheet.create({
  wrap: {
    position: 'absolute', bottom: 100, alignSelf: 'center',
    backgroundColor: T.green, borderRadius: radii.xxl,
    paddingHorizontal: 20, paddingVertical: 10, zIndex: 99,
  },
  text: { color: T.greenLo, fontWeight: '700', fontSize: 14 },
});

// ─── Validation ───────────────────────────────────────────────────────────────
function validateAnswers(
  questions: IntakeQuestion[],
  answers: Record<string, AnswerValue>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const q of questions) {
    if (!q.required) continue;
    const val = answers[q.id];
    if (val === undefined || val === null || val === '') {
      errors[q.id] = 'Required';
    } else if (Array.isArray(val) && val.length === 0) {
      errors[q.id] = 'Select at least one option';
    }
  }
  return errors;
}

// ─── AI Scan History section ─────────────────────────────────────────────────
function AiScanHistorySection({
  history, onRevert,
}: {
  history: AiScanRecord[];
  onRevert: (record: AiScanRecord) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? history : history.slice(0, 3);
  return (
    <View style={ash.wrap}>
      <View style={ash.header}>
        <Text style={ash.title}>🤖 AI Scan History</Text>
        <Text style={ash.count}>{history.length} scan{history.length !== 1 ? 's' : ''}</Text>
      </View>
      {shown.map((rec) => {
        const date = new Date(rec.createdAt);
        const answerCount = Object.keys(rec.answersSnapshot).filter(
          k => !k.startsWith(AI_META_PREFIX)
        ).length;
        return (
          <View key={rec.id} style={ash.card}>
            <View style={ash.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={ash.cardDate}>
                  {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                <Text style={ash.cardSummary} numberOfLines={2}>{rec.summary}</Text>
                <Text style={ash.cardMeta}>{answerCount} answers in snapshot</Text>
              </View>
              <TouchableOpacity
                style={ash.revertBtn}
                onPress={() => {
                  Alert.alert(
                    'Revert Answers',
                    `Replace current answers with this AI snapshot from ${date.toLocaleString()}?

This cannot be undone.`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Revert', style: 'destructive', onPress: () => onRevert(rec) },
                    ]
                  );
                }}
              >
                <Text style={ash.revertTxt}>Revert</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
      {history.length > 3 && (
        <TouchableOpacity style={ash.viewAll} onPress={() => setExpanded(e => !e)}>
          <Text style={ash.viewAllTxt}>{expanded ? 'Show less' : `View all ${history.length} scans`}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
const ash = StyleSheet.create({
  wrap:       { marginTop: 28, marginBottom: 4 },
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title:      { color: T.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  count:      { color: T.sub, fontSize: 11 },
  card:       { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: radii.lg, padding: 12, marginBottom: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardDate:   { color: T.sub, fontSize: 11, marginBottom: 3 },
  cardSummary:{ color: T.textDim, fontSize: 12, lineHeight: 17, marginBottom: 4 },
  cardMeta:   { color: T.sub, fontSize: 11 },
  revertBtn:  { backgroundColor: T.redLo, borderWidth: 1, borderColor: T.red, borderRadius: radii.sm, paddingHorizontal: 10, paddingVertical: 6 },
  revertTxt:  { color: T.red, fontSize: 12, fontWeight: '700' },
  viewAll:    { backgroundColor: T.surface, borderRadius: radii.md, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: T.border },
  viewAllTxt: { color: T.sub, fontSize: 13 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export function NewEstimateScreen({ route, navigation }: any) {
  const estimateId: string | undefined = route?.params?.estimateId;
  // IntakeScreen passes prefillCustomer when converting a lead to an estimate
  const prefillCustomer: { id?: string; name?: string; phone?: string; email?: string; address?: string } | undefined =
    route?.params?.prefillCustomer;
  const isEditing = !!estimateId;

  // BUG FIX: merged verticals (built-in + custom), loaded once on mount
  const [verticals, setVerticals] = useState<VerticalConfig[]>(ALL_VERTICALS);

  const [customerName, setCustomerName]   = useState(prefillCustomer?.name ?? '');
  const [customerPhone, setCustomerPhone] = useState(prefillCustomer?.phone ?? '');
  const [verticalIdx, setVerticalIdx]     = useState(0);
  const [serviceIdx, setServiceIdx]       = useState(0);
  const [answers, setAnswers]             = useState<Record<string, AnswerValue>>({});
  const [fieldErrors, setFieldErrors]     = useState<Record<string, string>>({});
  const [nameError, setNameError]         = useState('');
  const [saving, setSaving]               = useState(false);
  // Operator overrides per driver.id
  const [driverOverrides, setDriverOverrides] = useState<DriverOverrideMap>({});
  // Store original id when editing so we upsert the same record
  const editingIdRef = useRef<string | undefined>(undefined);
  const [aiHistory, setAiHistory] = useState<AiScanRecord[]>([]);
  const [customerId, setCustomerId] = useState<string | undefined>(prefillCustomer?.id);
  const [customFields, setCustomFields] = useState<CustomIntakeField[]>([]);
  const [customAnswers, setCustomAnswers] = useState<Record<string, AnswerValue>>({});
  const estimateNumberRef = useRef<string | undefined>(undefined);

  const { show: showToast, Toast } = useToast();

  // Load verticals, then optionally load existing estimate for edit mode
  useEffect(() => {
    loadCustomVerticals().then((custom) => {
      const merged = mergeVerticals(ALL_VERTICALS, custom);
      setVerticals(merged);

      if (estimateId) {
        EstimateRepository.getEstimate(estimateId).then((est) => {
          if (!est) return;
          editingIdRef.current = est.id;

          // Prefill customer
          setCustomerName(est.customer?.name === 'Untitled Draft' ? '' : (est.customer?.name ?? ''));
          setCustomerPhone(est.customer?.phone ?? '');

          // Prefill vertical/service selection
          const vIdx = merged.findIndex((v) => v.id === est.verticalId);
          if (vIdx >= 0) {
            setVerticalIdx(vIdx);
            const sIdx = merged[vIdx].services.findIndex((s) => s.id === est.serviceId);
            if (sIdx >= 0) setServiceIdx(sIdx);
          }

          // Prefill answers
          setAnswers(est.intakeAnswers ?? {});
          setCustomerId(est.customerId);
          estimateNumberRef.current = est.estimateNumber;
        });
      }
    });
  }, [estimateId]);

  // Refresh AI history on every focus (so Apply→Back shows new record immediately)
  useFocusEffect(
    useCallback(() => {
      if (estimateId) getAiHistory(estimateId).then(setAiHistory);
    }, [estimateId]),
  );

  // Load template custom intake fields when vertical/service changes
  useEffect(() => {
    if (!vertical?.id || !service?.id) return;
    getTemplate(vertical.id, service.id).then(tmpl => {
      setCustomFields(tmpl?.customIntakeFields ?? []);
      setCustomAnswers({});
    });
  }, [vertical?.id, service?.id]);

  // BUG FIX: guard against out-of-bounds index after verticals reload
  const safeVertIdx = Math.min(verticalIdx, verticals.length - 1);
  const vertical    = verticals[safeVertIdx];
  const safeSvcIdx  = Math.min(serviceIdx, (vertical?.services?.length ?? 1) - 1);
  const service     = vertical?.services?.[safeSvcIdx];

  // Extract AI confidence metadata from answers for badge display
  const aiMeta = useMemo(() => {
    const meta: Record<string, { confidence: string }> = {};
    const suffix = '__ai_confidence';
    for (const [k, v] of Object.entries(answers)) {
      if (k.endsWith(suffix)) {
        const qId = k.slice(0, -suffix.length);
        meta[qId] = { confidence: String(v) };
      }
    }
    return meta;
  }, [answers]);

  // Live pricing — recomputes whenever answers, vertical, service, or overrides change
  const livePricing: PricingResultV2 | null = useMemo(() => {
    if (!vertical || !service) return null;
    return computePricingV2(vertical!, service!, answers, driverOverrides);
  }, [vertical, service, answers, driverOverrides]);

  const handleAnswer = (id: string, val: AnswerValue) => {
    setAnswers((prev) => ({ ...prev, [id]: val }));
    if (fieldErrors[id]) {
      setFieldErrors((prev) => { const n = { ...prev }; delete n[id]; return n; });
    }
  };

  const handleSelectVertical = (idx: number) => {
    setVerticalIdx(idx);
    setServiceIdx(0);
    setAnswers({});
    setFieldErrors({});
    setDriverOverrides({});
    setCustomAnswers({});
  };

  const buildEstimate = (status: 'draft' | 'pending'): Estimate => {
    const pricing = livePricing ?? computePricingV2(vertical!, service!, answers, driverOverrides);
    const now = new Date().toISOString();
    const name = customerName.trim() || 'Untitled Draft';
    return {
      id:          editingIdRef.current ?? makeId(),
      verticalId:  vertical!.id,
      serviceId:   service!.id,
      customer: {
        name,
        phone:    customerPhone.trim() || prefillCustomer?.phone || undefined,
        email:    prefillCustomer?.email || undefined,
        address:  prefillCustomer?.address || undefined,
      },
      status,
      intakeAnswers:   answers,
      lineItems:       [],
      computedRange:   pricing.range,
      drivers:         pricing.drivers,
      driverOverrides: Object.keys(driverOverrides).length ? driverOverrides : undefined,
      disclaimerText:  vertical!.disclaimerText,
      photos:  [],
      customerId,
      estimateNumber: estimateNumberRef.current,
      createdAt: now,
      updatedAt: now,
    };
  };

  const handleSaveDraft = async () => {
    if (!vertical || !service) return;
    setSaving(true);
    try {
      const estimate = buildEstimate('draft');
      editingIdRef.current = estimate.id; // persist id so subsequent drafts upsert same record
      await EstimateRepository.upsertEstimate(estimate);
      const displayName = estimate.customer.name;
      showToast(`Draft saved${displayName !== 'Untitled Draft' ? ` for ${displayName}` : ''} ✓`);
      // Do NOT navigate — stay on screen
    } catch (err: any) {
      showToast(`Save failed: ${err?.message ?? 'unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSavePending = async () => {
    if (!vertical || !service) return;

    // Pending requires customer name
    let valid = true;
    if (!customerName.trim()) {
      setNameError('Customer name is required');
      valid = false;
    } else {
      setNameError('');
    }

    // Pending validates required intake fields
    const errors = validateAnswers(vertical.intakeQuestions, answers);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) valid = false;

    if (!valid) return;

    setSaving(true);
    try {
      // Generate estimate number on first pending save
      if (!estimateNumberRef.current) {
        estimateNumberRef.current = await nextEstimateNumber();
      }
      const estimate = buildEstimate('pending');
      editingIdRef.current = estimate.id;
      await EstimateRepository.upsertEstimate(estimate);
      navigation.navigate('EstimateDetail', { estimateId: estimate.id });
    } catch (err: any) {
      showToast(`Save failed: ${err?.message ?? 'unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const hasErrors = Object.keys(fieldErrors).length > 0 || !!nameError;

  if (!vertical) return null;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {isEditing && (
          <View style={styles.editBanner}>
            <Text style={styles.editBannerText}>✏️ Editing draft</Text>
          </View>
        )}

        {/* Customer */}
        <Text style={styles.section}>Customer</Text>
        <CustomerPicker
          customerId={customerId}
          onSelect={c => {
            if (c) {
              setCustomerId(c.id);
              setCustomerName(c.name);
              setCustomerPhone(c.phone ?? '');
            } else {
              setCustomerId(undefined);
            }
          }}
        />
        <TextInput
          style={[styles.input, nameError ? styles.inputError : null, { marginTop: 10 }]}
          placeholder="Full name (optional for draft)"
          placeholderTextColor="#475569"
          value={customerName}
          onChangeText={(t) => { setCustomerName(t); if (nameError) setNameError(''); }}
          autoCapitalize="words"
        />
        {nameError ? <Text style={styles.errorText}>⚠ {nameError}</Text> : null}

        <TextInput
          style={styles.input}
          placeholder="Phone (optional)"
          placeholderTextColor="#475569"
          value={customerPhone}
          onChangeText={setCustomerPhone}
          keyboardType="phone-pad"
        />

        {/* Vertical selector */}
        <Text style={styles.section}>Service Type</Text>
        <View style={styles.chips}>
          {verticals.map((v, i) => (
            <TouchableOpacity
              key={v.id}
              style={[styles.chip, safeVertIdx === i && styles.chipActive]}
              onPress={() => handleSelectVertical(i)}
            >
              <Text style={[styles.chipText, safeVertIdx === i && styles.chipTextActive]}>
                {v.icon} {v.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Service selector */}
        <Text style={styles.section}>Service</Text>
        <View style={styles.chips}>
          {vertical.services.map((s, i) => (
            <TouchableOpacity
              key={s.id}
              style={[styles.chip, safeSvcIdx === i && styles.chipActive]}
              onPress={() => setServiceIdx(i)}
            >
              <Text style={[styles.chipText, safeSvcIdx === i && styles.chipTextActive]}>
                {s.name}
              </Text>
              {/* BUG FIX: use Intl for range display */}
              <Text style={styles.chipSub}>
                ${s.baseMin.toLocaleString('en-US')}–${s.baseMax.toLocaleString('en-US')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Intake questions */}
        {vertical.intakeQuestions.length > 0 && (
          <>
            <Text style={styles.section}>Details</Text>
            <IntakeFormRenderer
              questions={vertical.intakeQuestions}
              answers={answers}
              onChange={handleAnswer}
              errors={fieldErrors}
              customFields={customFields}
              customAnswers={customAnswers}
              onCustomChange={(id, v) => setCustomAnswers(prev => ({ ...prev, [id]: v }))}
              aiMeta={aiMeta}
            />
          </>
        )}

        {/* Validation banner */}
        {hasErrors && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>
              Please fill in all required fields before calculating.
            </Text>
          </View>
        )}

        {/* AI Scan History (Phase 4) */}
        {aiHistory.length > 0 && editingIdRef.current && (
          <AiScanHistorySection
            history={aiHistory}
            onRevert={async (record) => {
              const estimateToUpdate = await EstimateRepository.getEstimate(editingIdRef.current!);
              if (!estimateToUpdate) return;
              // Replace intakeAnswers with snapshot — strip AI metadata keys
              const cleaned: Record<string, AnswerValue> = {};
              for (const [k, v] of Object.entries(record.answersSnapshot)) {
                if (!k.startsWith(AI_META_PREFIX)) cleaned[k] = v;
              }
              setAnswers(cleaned);
              await EstimateRepository.upsertEstimate({
                ...estimateToUpdate,
                intakeAnswers: cleaned,
                updatedAt: new Date().toISOString(),
              });
              showToast('Reverted to snapshot ✓');
            }}
          />
        )}

        {/* Live Pricing Panel */}
        <Text style={styles.section}>Price Estimate</Text>
        <PricingSummaryCard
          result={livePricing}
          overrides={driverOverrides}
          onOverrideChange={setDriverOverrides}
        />

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.btn, styles.btnGhost, saving && styles.btnDisabled]}
            onPress={handleSaveDraft}
            disabled={saving}
          >
            <Text style={styles.btnGhostText}>{saving ? 'Saving…' : 'Save Draft'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, saving && styles.btnDisabled]}
            onPress={handleSavePending}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Calculate Range →</Text>}
          </TouchableOpacity>
        </View>

      </ScrollView>

      <Toast />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: T.bg },
  scroll: { padding: 20, paddingBottom: 48 },

  editBanner: {
    backgroundColor: T.amberLo, borderWidth: 1, borderColor: T.amber,
    borderRadius: radii.sm, padding: 10, marginBottom: 4,
  },
  editBannerText: { color: T.amberHi, fontSize: 13, fontWeight: '600' },

  section: {
    color: T.textDim, fontSize: 11, fontWeight: '700',
    letterSpacing: 1, marginTop: 28, marginBottom: 10,
    textTransform: 'uppercase',
  },

  input: {
    backgroundColor: T.surface, borderWidth: 1, borderColor: T.border,
    borderRadius: radii.sm, color: T.text, padding: 12, fontSize: 15, marginBottom: 6,
  },
  inputError: { borderColor: T.red },
  errorText:  { color: T.red, fontSize: 12, marginBottom: 8 },

  chips:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip:          { borderWidth: 1, borderColor: T.border, borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 8 },
  chipActive:    { backgroundColor: T.accent, borderColor: '#0ea5e9' },
  chipText:      { color: T.textDim, fontSize: 14 },
  chipTextActive:{ color: '#fff', fontWeight: '600' },
  chipSub:       { color: T.sub, fontSize: 11, marginTop: 2 },

  errorBanner:     { backgroundColor: T.redLo, borderWidth: 1, borderColor: '#7f1d1d', borderRadius: radii.sm, padding: 12, marginTop: 8 },
  errorBannerText: { color: T.redHi, fontSize: 13 },

  actions:    { flexDirection: 'row', gap: 12, marginTop: 24 },
  btn:        { flex: 1, backgroundColor: T.accent, borderRadius: radii.md, padding: 14, alignItems: 'center' },
  btnGhost:   { backgroundColor: 'transparent', borderWidth: 1, borderColor: T.border },
  btnDisabled:{ opacity: 0.5 },
  btnText:    { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnGhostText: { color: T.textDim, fontWeight: '600', fontSize: 15 },
});
