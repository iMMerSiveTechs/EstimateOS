// ─── IntakeFormRenderer ────────────────────────────────────────────────────
// Renders standard IntakeQuestions + optional CustomIntakeFields.
// Used by NewEstimateScreen and any other form that needs dynamic intake.

import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Switch, StyleSheet,
} from 'react-native';
import { IntakeQuestion, CustomIntakeField, AnswerValue } from '../models/types';
import { T, radii } from '../theme';

interface Props {
  questions: IntakeQuestion[];
  answers: Record<string, AnswerValue>;
  onChange: (id: string, value: AnswerValue) => void;
  errors?: Record<string, string>;
  customFields?: CustomIntakeField[];
  customAnswers?: Record<string, AnswerValue>;
  onCustomChange?: (id: string, value: AnswerValue) => void;
  /** If provided, shows confidence badge next to AI-filled values */
  aiMeta?: Record<string, { confidence: string }>;
}

// ─── Confidence badge ──────────────────────────────────────────────────────
function AiBadge({ level }: { level: string }) {
  const conf = level === 'high'
    ? { bg: T.greenLo, border: T.green, text: T.greenHi, label: 'AI · High' }
    : level === 'medium'
    ? { bg: T.amberLo, border: T.amber, text: T.amberHi, label: 'AI · Med' }
    : { bg: T.surface,  border: T.border, text: T.sub,    label: 'AI · Low' };
  return (
    <View style={[badge.wrap, { backgroundColor: conf.bg, borderColor: conf.border }]}>
      <Text style={[badge.txt, { color: conf.text }]}>{conf.label}</Text>
    </View>
  );
}
const badge = StyleSheet.create({
  wrap: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, marginLeft: 6 },
  txt: { fontSize: 10, fontWeight: '700' },
});

// ─── Single question renderer ──────────────────────────────────────────────
function QuestionField({
  id, label, type, options, required, placeholder, unit,
  value, onChange, error, aiLevel,
}: {
  id: string; label: string; type: string; options?: string[];
  required?: boolean; placeholder?: string; unit?: string;
  value: AnswerValue; onChange: (v: AnswerValue) => void;
  error?: string; aiLevel?: string;
}) {
  const strVal = value === null || value === undefined ? '' : String(value);

  return (
    <View style={s.fieldWrap}>
      <View style={s.labelRow}>
        <Text style={s.label}>
          {label}{required ? <Text style={s.required}> *</Text> : null}
          {unit ? <Text style={s.unit}> ({unit})</Text> : null}
        </Text>
        {aiLevel && <AiBadge level={aiLevel} />}
      </View>

      {(type === 'text') && (
        <TextInput
          style={[s.input, error ? s.inputErr : null]}
          value={strVal}
          onChangeText={onChange}
          placeholder={placeholder ?? ''}
          placeholderTextColor={T.muted}
          autoCapitalize="sentences"
        />
      )}

      {(type === 'longtext') && (
        <TextInput
          style={[s.input, s.inputMulti, error ? s.inputErr : null]}
          value={strVal}
          onChangeText={onChange}
          placeholder={placeholder ?? ''}
          placeholderTextColor={T.muted}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      )}

      {(type === 'number') && (
        <TextInput
          style={[s.input, error ? s.inputErr : null]}
          value={strVal}
          onChangeText={t => onChange(t === '' ? null : Number(t))}
          placeholder={placeholder ?? '0'}
          placeholderTextColor={T.muted}
          keyboardType="numeric"
        />
      )}

      {(type === 'boolean') && (
        <View style={s.switchRow}>
          <Switch
            value={value === true || value === 'true'}
            onValueChange={v => onChange(v)}
            trackColor={{ false: T.border, true: T.accentLo }}
            thumbColor={value ? T.accent : T.sub}
          />
          <Text style={s.switchLabel}>{value ? 'Yes' : 'No'}</Text>
        </View>
      )}

      {(type === 'select' || type === 'multiselect') && options && (
        <View style={s.chips}>
          {options.map(opt => {
            const isMulti = type === 'multiselect';
            const selected = isMulti
              ? Array.isArray(value) && value.includes(opt)
              : strVal === opt;
            return (
              <TouchableOpacity
                key={opt}
                style={[s.chip, selected && s.chipActive]}
                onPress={() => {
                  if (isMulti) {
                    const arr = Array.isArray(value) ? [...value] : [];
                    const next = selected ? arr.filter(x => x !== opt) : [...arr, opt];
                    onChange(next);
                  } else {
                    onChange(selected ? null : opt);
                  }
                }}
              >
                <Text style={[s.chipTxt, selected && s.chipTxtActive]}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {error && <Text style={s.err}>{error}</Text>}
    </View>
  );
}

// ─── Main renderer ─────────────────────────────────────────────────────────
export function IntakeFormRenderer({
  questions, answers, onChange, errors = {},
  customFields = [], customAnswers = {}, onCustomChange,
  aiMeta = {},
}: Props) {
  return (
    <View>
      {questions.map(q => (
        <QuestionField
          key={q.id}
          id={q.id}
          label={q.label}
          type={q.type}
          options={q.options}
          required={q.required}
          placeholder={q.placeholder}
          unit={q.unit}
          value={answers[q.id] ?? null}
          onChange={v => onChange(q.id, v)}
          error={errors[q.id]}
          aiLevel={aiMeta[q.id]?.confidence}
        />
      ))}

      {customFields.length > 0 && (
        <View style={s.customSection}>
          <Text style={s.customSectionLabel}>Additional Details</Text>
          {customFields.map(f => (
            <QuestionField
              key={f.id}
              id={f.id}
              label={f.label}
              type={f.type}
              options={f.options}
              required={f.required}
              placeholder={f.placeholder ?? f.helpText}
              value={customAnswers[f.id] ?? null}
              onChange={v => onCustomChange?.(f.id, v)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  fieldWrap: { marginBottom: 16 },
  labelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  label:    { color: T.textDim, fontSize: 13, fontWeight: '600', flex: 1 },
  required: { color: T.red },
  unit:     { color: T.sub, fontWeight: '400' },

  input: {
    backgroundColor: T.surface, borderWidth: 1, borderColor: T.border,
    borderRadius: radii.sm, color: T.text, padding: 12, fontSize: 15,
  },
  inputMulti: { minHeight: 80, paddingTop: 12 },
  inputErr:   { borderColor: T.red },
  err:        { color: T.red, fontSize: 12, marginTop: 4 },

  switchRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  switchLabel:{ color: T.textDim, fontSize: 14 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:  { borderWidth: 1, borderColor: T.border, borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 8 },
  chipActive: { backgroundColor: T.accent, borderColor: T.accent },
  chipTxt:    { color: T.textDim, fontSize: 14 },
  chipTxtActive: { color: '#fff', fontWeight: '600' },

  customSection:      { marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: T.border },
  customSectionLabel: {
    color: T.textDim, fontSize: 11, fontWeight: '700',
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12,
  },
});
