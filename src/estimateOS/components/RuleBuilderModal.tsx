/**
 * RuleBuilderModal.tsx
 *
 * 4-step wizard for building a PricingRule:
 *   Step 1: Rule type (flat_fee | conditional_addon | per_unit | tiered | multiplier)
 *   Step 2: Label + bucket
 *   Step 3: Trigger question (skipped for flat_fee)
 *   Step 4: Amounts / rates / tiers
 *
 * On Save: calls onSave(PricingRule). Caller persists it.
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet,
  ScrollView, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { T, radii } from '../theme';
import {
  PricingRule, PricingRuleType, DriverBucket,
  BUCKET_LABELS, TieredBand,
} from '../models/types';

interface Props {
  visible: boolean;
  questionOptions: Array<{ id: string; label: string; type: string }>;
  onSave:  (rule: PricingRule) => void;
  onClose: () => void;
}

const RULE_TYPES: Array<{ type: PricingRuleType; icon: string; label: string; desc: string }> = [
  { type: 'flat_fee',          icon: '\uD83D\uDCB0', label: 'Flat Fee',        desc: 'Always added to every estimate' },
  { type: 'conditional_addon', icon: '\uD83D\uDD00', label: 'Conditional Add', desc: 'Added when intake answer matches' },
  { type: 'per_unit',          icon: '\uD83D\uDCCF', label: 'Per Unit',        desc: 'Multiplied by a numeric answer' },
  { type: 'tiered',            icon: '\uD83D\uDCCA', label: 'Tiered',          desc: 'Lookup table based on numeric value' },
  { type: 'multiplier',        icon: '\u2716\uFE0F', label: 'Multiplier',      desc: 'Scales the running subtotal' },
];

const BUCKETS: DriverBucket[] = ['labor', 'materials', 'access', 'disposal_fees', 'risk', 'other'];
const BUCKET_ICONS: Record<DriverBucket, string> = {
  labor: '\uD83D\uDC77', materials: '\uD83E\uDE35', access: '\uD83D\uDE9A',
  disposal_fees: '\uD83D\uDDD1', risk: '\u26A0\uFE0F', other: '\uD83D\uDCE6',
};

function toNum(s: string, fallback = 0): number {
  const n = parseFloat(s);
  return isNaN(n) ? fallback : n;
}

function autoExplanation(
  type: PricingRuleType, label: string,
  questionLabel?: string, triggerVal?: string,
  low?: number, high?: number, unitLabel?: string,
): string {
  switch (type) {
    case 'flat_fee':          return '"' + label + '": $' + low + '–$' + high + ' added to every estimate.';
    case 'conditional_addon': return '"' + label + '": adds $' + low + '–$' + high + ' when ' + (questionLabel ?? 'answer') + ' is "' + triggerVal + '".';
    case 'per_unit':          return '"' + label + '": $' + low + '–$' + high + ' per ' + (unitLabel ?? 'unit') + ' based on ' + (questionLabel ?? 'qty') + '.';
    case 'tiered':            return '"' + label + '": tiered add based on ' + (questionLabel ?? 'value') + '.';
    case 'multiplier':        return '"' + label + '": multiplies subtotal by x' + low + '–x' + high + ' when "' + triggerVal + '" selected.';
    default:                  return label;
  }
}

export function RuleBuilderModal({ visible, questionOptions, onSave, onClose }: Props) {
  const [step,       setStep]       = useState(1);
  const [ruleType,   setRuleType]   = useState<PricingRuleType>('flat_fee');
  const [bucket,     setBucket]     = useState<DriverBucket>('labor');
  const [label,      setLabel]      = useState('');
  const [questionId, setQuestionId] = useState('');
  const [triggerVal, setTriggerVal] = useState('');
  const [low,        setLow]        = useState('');
  const [high,       setHigh]       = useState('');
  const [unitLabel,  setUnitLabel]  = useState('sq ft');
  const [unitCap,    setUnitCap]    = useState('');
  const [tiers,      setTiers]      = useState([
    { min: '0', max: '500',      addMin: '0',   addMax: '200',  tierLabel: 'Small'  },
    { min: '500', max: '1500',   addMin: '200', addMax: '600',  tierLabel: 'Medium' },
    { min: '1500', max: '',      addMin: '600', addMax: '1500', tierLabel: 'Large'  },
  ]);

  useEffect(() => {
    if (visible) {
      setStep(1); setRuleType('flat_fee'); setBucket('labor');
      setLabel(''); setQuestionId(''); setTriggerVal('');
      setLow(''); setHigh(''); setUnitLabel('sq ft'); setUnitCap('');
    }
  }, [visible]);

  const needsTrigger = ruleType !== 'flat_fee';
  const totalSteps   = needsTrigger ? 4 : 3;
  const isLast       = step === totalSteps;

  const selectedQ    = questionOptions.find(q => q.id === questionId);
  const explanation  = autoExplanation(ruleType, label || '(rule)', selectedQ?.label, triggerVal, toNum(low), toNum(high), unitLabel);

  function buildRule(): PricingRule {
    const base: PricingRule = {
      questionId:  questionId || 'none',
      answerValue: triggerVal || '',
      type:        ruleType,
      valueMin:    toNum(low),
      valueMax:    toNum(high),
      label:       label || 'Unnamed Rule',
      bucket,
    };
    if (ruleType === 'per_unit')
      return { ...base, unitMin: toNum(low), unitMax: toNum(high), unitLabel, unitCap: unitCap ? toNum(unitCap) : undefined };
    if (ruleType === 'tiered')
      return { ...base, valueMin: 0, valueMax: 0,
        tieredData: tiers.map(t => ({
          minValue: toNum(t.min), maxValue: t.max === '' ? Infinity : toNum(t.max),
          addMin: toNum(t.addMin), addMax: toNum(t.addMax), label: t.tierLabel,
        } as TieredBand))
      };
    if (ruleType === 'multiplier' || ruleType === 'conditional_addon')
      return { ...base, triggerValue: triggerVal };
    return base;
  }

  function canAdvance() {
    if (step === 1) return true;
    if (step === 2) return label.trim().length > 0;
    if (step === 3 && needsTrigger) return questionId.length > 0;
    return true;
  }

  function renderStep1() {
    return (
      <>
        <Text style={s.stepTitle}>Rule Type</Text>
        {RULE_TYPES.map(rt => (
          <TouchableOpacity key={rt.type}
            style={[s.typeCard, ruleType === rt.type && s.typeCardActive]}
            onPress={() => setRuleType(rt.type)}
          >
            <Text style={s.typeIcon}>{rt.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.typeLabel, ruleType === rt.type && { color: T.text }]}>{rt.label}</Text>
              <Text style={s.typeDesc}>{rt.desc}</Text>
            </View>
            {ruleType === rt.type && <Text style={s.check}>✓</Text>}
          </TouchableOpacity>
        ))}
      </>
    );
  }

  function renderStep2() {
    return (
      <>
        <Text style={s.stepTitle}>Label & Bucket</Text>
        <Text style={s.fieldLabel}>Rule label</Text>
        <TextInput style={s.input} value={label} onChangeText={setLabel}
          placeholder="e.g. Disposal Fee" placeholderTextColor={T.sub} autoFocus />
        <Text style={s.fieldLabel}>Cost bucket</Text>
        <View style={s.bucketGrid}>
          {BUCKETS.map(b => (
            <TouchableOpacity key={b} style={[s.bucketChip, bucket === b && s.bucketActive]} onPress={() => setBucket(b)}>
              <Text style={[s.bucketTxt, bucket === b && { color: T.text }]}>
                {BUCKET_ICONS[b]} {BUCKET_LABELS[b]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </>
    );
  }

  function renderStep3Trigger() {
    return (
      <>
        <Text style={s.stepTitle}>Trigger Question</Text>
        {questionOptions.length === 0 ? (
          <View style={s.noQsBox}><Text style={s.noQsTxt}>No intake questions found for this vertical.</Text></View>
        ) : (
          questionOptions.map(q => (
            <TouchableOpacity key={q.id}
              style={[s.typeCard, questionId === q.id && s.typeCardActive]}
              onPress={() => setQuestionId(q.id)}
            >
              <View style={{ flex: 1 }}>
                <Text style={[s.typeLabel, questionId === q.id && { color: T.text }]}>{q.label}</Text>
                <Text style={s.typeDesc}>{q.type}</Text>
              </View>
              {questionId === q.id && <Text style={s.check}>✓</Text>}
            </TouchableOpacity>
          ))
        )}
        {(ruleType === 'conditional_addon' || ruleType === 'multiplier') && questionId && (
          <>
            <Text style={s.fieldLabel}>Trigger value (exact match)</Text>
            <TextInput style={s.input} value={triggerVal} onChangeText={setTriggerVal}
              placeholder='e.g. "Yes" or "3-story"' placeholderTextColor={T.sub} />
          </>
        )}
      </>
    );
  }

  function renderStep4Amounts() {
    if (ruleType === 'tiered') {
      return (
        <>
          <Text style={s.stepTitle}>Tier Bands</Text>
          {tiers.map((tier, i) => (
            <View key={i} style={s.tierRow}>
              <Text style={s.tierBandLabel}>{tier.tierLabel} ({tier.min}–{tier.max || '∞'})</Text>
              <View style={s.tierInputRow}>
                <TextInput style={[s.input, { flex: 1 }]} value={tier.addMin}
                  onChangeText={v => setTiers(ts => ts.map((t, j) => j === i ? { ...t, addMin: v } : t))}
                  keyboardType="numeric" placeholder="Low $" placeholderTextColor={T.sub} />
                <Text style={{ color: T.sub, marginHorizontal: 8 }}>–</Text>
                <TextInput style={[s.input, { flex: 1 }]} value={tier.addMax}
                  onChangeText={v => setTiers(ts => ts.map((t, j) => j === i ? { ...t, addMax: v } : t))}
                  keyboardType="numeric" placeholder="High $" placeholderTextColor={T.sub} />
              </View>
            </View>
          ))}
        </>
      );
    }
    if (ruleType === 'per_unit') {
      return (
        <>
          <Text style={s.stepTitle}>Rate per Unit</Text>
          <Text style={s.fieldLabel}>Unit label</Text>
          <TextInput style={s.input} value={unitLabel} onChangeText={setUnitLabel} placeholder="sq ft" placeholderTextColor={T.sub} />
          <Text style={s.fieldLabel}>Rate low ($/unit)</Text>
          <TextInput style={s.input} value={low} onChangeText={setLow} keyboardType="numeric" placeholder="0" placeholderTextColor={T.sub} />
          <Text style={s.fieldLabel}>Rate high ($/unit)</Text>
          <TextInput style={s.input} value={high} onChangeText={setHigh} keyboardType="numeric" placeholder="0" placeholderTextColor={T.sub} />
          <Text style={s.fieldLabel}>Unit cap (optional)</Text>
          <TextInput style={s.input} value={unitCap} onChangeText={setUnitCap} keyboardType="numeric" placeholder="No cap" placeholderTextColor={T.sub} />
        </>
      );
    }
    if (ruleType === 'multiplier') {
      return (
        <>
          <Text style={s.stepTitle}>Multiplier Factors</Text>
          <Text style={s.fieldLabel}>Factor low (e.g. 1.15)</Text>
          <TextInput style={s.input} value={low} onChangeText={setLow} keyboardType="numeric" placeholder="1.15" placeholderTextColor={T.sub} />
          <Text style={s.fieldLabel}>Factor high (e.g. 1.30)</Text>
          <TextInput style={s.input} value={high} onChangeText={setHigh} keyboardType="numeric" placeholder="1.30" placeholderTextColor={T.sub} />
        </>
      );
    }
    // flat_fee, conditional_addon
    return (
      <>
        <Text style={s.stepTitle}>Amount</Text>
        <Text style={s.fieldLabel}>Low ($)</Text>
        <TextInput style={s.input} value={low} onChangeText={setLow} keyboardType="numeric" placeholder="0" placeholderTextColor={T.sub} />
        <Text style={s.fieldLabel}>High ($)</Text>
        <TextInput style={s.input} value={high} onChangeText={setHigh} keyboardType="numeric" placeholder="0" placeholderTextColor={T.sub} />
      </>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.safe}>
          <View style={s.header}>
            <TouchableOpacity onPress={onClose}><Text style={s.cancelTxt}>Cancel</Text></TouchableOpacity>
            <Text style={s.headerTitle}>Rule Builder</Text>
            <Text style={s.stepCounter}>{step}/{totalSteps}</Text>
          </View>
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: ((step / totalSteps) * 100) + '%' as any }]} />
          </View>

          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && needsTrigger  && renderStep3Trigger()}
            {step === 3 && !needsTrigger && renderStep4Amounts()}
            {step === 4 && needsTrigger  && renderStep4Amounts()}
            {step === totalSteps && (
              <View style={s.explanationBox}>
                <Text style={s.explanationLabel}>Auto-generated explanation</Text>
                <Text style={s.explanationText}>{explanation}</Text>
              </View>
            )}
          </ScrollView>

          <View style={s.footer}>
            {step > 1 && (
              <TouchableOpacity style={s.backBtn} onPress={() => setStep(n => n - 1)}>
                <Text style={s.backTxt}>← Back</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[s.nextBtn, !canAdvance() && s.nextDis]}
              onPress={() => { if (isLast) { onSave(buildRule()); onClose(); } else setStep(n => n + 1); }}
              disabled={!canAdvance()}
            >
              <Text style={s.nextTxt}>{isLast ? 'Save Rule' : 'Next →'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: T.bg },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: T.border },
  headerTitle:  { color: T.text, fontSize: 16, fontWeight: '800' },
  cancelTxt:    { color: T.sub, fontSize: 15 },
  stepCounter:  { color: T.sub, fontSize: 13 },
  progressTrack:{ height: 3, backgroundColor: T.muted },
  progressFill: { height: '100%', backgroundColor: T.accent, borderRadius: 2 },
  scroll:       { padding: 20, paddingBottom: 40 },
  stepTitle:    { color: T.text, fontSize: 18, fontWeight: '800', marginBottom: 16 },
  fieldLabel:   { color: T.textDim, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 6, marginTop: 14 },
  input: {
    backgroundColor: T.surface, borderWidth: 1, borderColor: T.border,
    borderRadius: radii.md, color: T.text, padding: 12, fontSize: 15,
  },
  typeCard:     { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: T.card, borderRadius: radii.lg, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: T.border },
  typeCardActive:{ borderColor: T.accent, backgroundColor: T.accentLo },
  typeIcon:     { fontSize: 22 },
  typeLabel:    { color: T.textDim, fontSize: 14, fontWeight: '700', marginBottom: 2 },
  typeDesc:     { color: T.sub, fontSize: 12 },
  check:        { color: T.accent, fontSize: 16, fontWeight: '800' },
  bucketGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bucketChip:   { borderWidth: 1, borderColor: T.border, borderRadius: radii.md, paddingHorizontal: 10, paddingVertical: 7 },
  bucketActive: { backgroundColor: T.accentLo, borderColor: T.accent },
  bucketTxt:    { color: T.sub, fontSize: 13, fontWeight: '600' },
  noQsBox:      { backgroundColor: T.amberLo, borderRadius: radii.md, padding: 14, borderWidth: 1, borderColor: T.amber },
  noQsTxt:      { color: T.amberHi, fontSize: 13 },
  tierRow:      { backgroundColor: T.card, borderRadius: radii.md, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: T.border },
  tierBandLabel:{ color: T.text, fontSize: 13, fontWeight: '700', marginBottom: 8 },
  tierInputRow: { flexDirection: 'row', alignItems: 'center' },
  explanationBox: { backgroundColor: T.greenLo, borderRadius: radii.md, padding: 12, marginTop: 16, borderWidth: 1, borderColor: T.green },
  explanationLabel: { color: T.greenHi, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  explanationText:  { color: T.green, fontSize: 13, lineHeight: 18 },
  footer:       { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: T.border },
  backBtn:      { flex: 0.45, borderWidth: 1, borderColor: T.border, borderRadius: radii.md, padding: 14, alignItems: 'center' },
  backTxt:      { color: T.textDim, fontWeight: '700', fontSize: 14 },
  nextBtn:      { flex: 1, backgroundColor: T.accent, borderRadius: radii.md, padding: 14, alignItems: 'center' },
  nextDis:      { opacity: 0.45 },
  nextTxt:      { color: '#fff', fontWeight: '700', fontSize: 14 },
});
