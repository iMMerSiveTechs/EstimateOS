// ─── PricingRulesScreen ────────────────────────────────────────────────────
// Tabs: Defaults | Rules | Presets
import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  SafeAreaView, Switch, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ALL_VERTICALS } from '../config/verticals';
import { VerticalConfig, PricingRule, QualityPreset, PricingDefaults } from '../models/types';
import { loadCustomVerticals, mergeVerticals } from '../storage/customVerticals';
import { getSettings, saveSettings, DEFAULT_SETTINGS } from '../storage/settings';
import { RuleBuilderModal } from '../components/RuleBuilderModal';
import { T, radii } from '../theme';

type Tab = 'defaults' | 'rules' | 'presets';

const TABS: { id: Tab; label: string }[] = [
  { id: 'defaults', label: 'Defaults' },
  { id: 'rules',    label: 'Rules' },
  { id: 'presets',  label: 'Presets' },
];

// ─── Plain-language rule description ─────────────────────────────────────
function ruleToPlain(rule: PricingRule): string {
  switch (rule.type) {
    case 'flat_fee':
      return `Always add $${rule.valueMin}–$${rule.valueMax} (${rule.bucket})`;
    case 'conditional_addon':
    case 'adder':
      return `IF "${rule.questionId}" is "${rule.answerValue ?? rule.triggerValue}" THEN add $${rule.valueMin}–$${rule.valueMax}`;
    case 'per_unit':
      return `$${rule.unitMin}–$${rule.unitMax} per ${rule.unitLabel ?? 'unit'} of "${rule.questionId}"${rule.unitCap ? ` (cap: ${rule.unitCap})` : ''}`;
    case 'tiered':
      return `Tiered by "${rule.questionId}" — ${rule.tieredData?.length ?? 0} tiers`;
    case 'multiplier':
      return `IF "${rule.questionId}" is "${rule.answerValue ?? rule.triggerValue}" THEN multiply by ×${rule.valueMin}–×${rule.valueMax}`;
    default:
      return (rule as any).label ?? 'Unknown rule';
  }
}

// ─── Defaults tab ─────────────────────────────────────────────────────────
function DefaultsTab({ defaults, onChange, saving }: {
  defaults: PricingDefaults; onChange: (d: PricingDefaults) => void; saving: boolean;
}) {
  const field = (
    label: string, helpText: string, value: string,
    setter: (v: string) => void, suffix = '%',
  ) => (
    <View style={dt.field} key={label}>
      <View style={dt.labelRow}>
        <Text style={dt.label}>{label}</Text>
        <Text style={dt.help}>{helpText}</Text>
      </View>
      <View style={dt.inputRow}>
        <TextInput
          style={dt.input}
          value={value}
          onChangeText={setter}
          keyboardType="numeric"
          selectTextOnFocus
        />
        <Text style={dt.suffix}>{suffix}</Text>
      </View>
    </View>
  );

  const [oh, setOh] = useState(String(Math.round(defaults.overheadPct * 100)));
  const [pr, setPr] = useState(String(Math.round(defaults.profitPct * 100)));
  const [tax, setTax] = useState(String(Math.round(defaults.taxPct * 100)));
  const [travel, setTravel] = useState(String(defaults.travelFee));

  const commit = () => onChange({
    overheadPct: Math.min(1, Math.max(0, Number(oh) / 100 || 0)),
    profitPct:   Math.min(1, Math.max(0, Number(pr) / 100 || 0)),
    taxPct:      Math.min(1, Math.max(0, Number(tax) / 100 || 0)),
    travelFee:   Math.max(0, Number(travel) || 0),
  });

  return (
    <ScrollView contentContainerStyle={dt.scroll} keyboardShouldPersistTaps="handled">
      <View style={dt.infoCard}>
        <Text style={dt.infoTitle}>💡 About Defaults</Text>
        <Text style={dt.infoBody}>These percentages are applied to every new estimate. Override them per-estimate using the pricing panel.</Text>
      </View>

      {field('Overhead %', 'Business operating costs (rent, insurance, equipment)', oh, setOh)}
      {field('Profit margin %', 'Your target profit on top of all costs', pr, setPr)}
      {field('Tax %', 'Sales or service tax rate', tax, setTax)}
      {field('Travel fee', 'Flat travel fee added to each estimate', travel, setTravel, '$')}

      <View style={dt.exampleCard}>
        <Text style={dt.exampleTitle}>Example</Text>
        <Text style={dt.exampleBody}>
          A $5,000 job with {oh}% overhead, {pr}% profit, {tax}% tax, and ${travel} travel fee:
        </Text>
        <Text style={dt.exampleResult}>
          ≈ ${(5000 * (1 + (Number(oh) / 100) + (Number(pr) / 100)) * (1 + Number(tax) / 100) + Number(travel)).toLocaleString('en-US', { maximumFractionDigits: 0 })}
        </Text>
      </View>

      <TouchableOpacity style={dt.saveBtn} onPress={commit} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={dt.saveBtnTxt}>Save Defaults</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}
const dt = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 60 },
  infoCard: { backgroundColor: T.accentLo, borderRadius: radii.md, padding: 14, borderWidth: 1, borderColor: T.accent, marginBottom: 20 },
  infoTitle: { color: T.accent, fontSize: 13, fontWeight: '700', marginBottom: 4 },
  infoBody: { color: T.textDim, fontSize: 13, lineHeight: 19 },
  field: { marginBottom: 20 },
  labelRow: { marginBottom: 8 },
  label: { color: T.text, fontSize: 15, fontWeight: '600' },
  help: { color: T.sub, fontSize: 12, marginTop: 2 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: radii.md, color: T.text, padding: 12, fontSize: 18, fontWeight: '700', width: 100, textAlign: 'center' },
  suffix: { color: T.textDim, fontSize: 16 },
  exampleCard: { backgroundColor: T.surface, borderRadius: radii.md, padding: 14, borderWidth: 1, borderColor: T.border, marginTop: 8, marginBottom: 20 },
  exampleTitle: { color: T.textDim, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  exampleBody: { color: T.sub, fontSize: 13, lineHeight: 19 },
  exampleResult: { color: T.text, fontSize: 22, fontWeight: '800', marginTop: 8 },
  saveBtn: { backgroundColor: T.accent, borderRadius: radii.md, padding: 14, alignItems: 'center' },
  saveBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

// ─── Rules tab ────────────────────────────────────────────────────────────
function RulesTab({ verticals }: { verticals: VerticalConfig[] }) {
  const [vertIdx, setVertIdx] = useState(0);
  const [showBuilder, setShowBuilder] = useState(false);
  const vertical = verticals[vertIdx];
  const rules = vertical?.pricingRules ?? [];
  const questions = (vertical?.intakeQuestions ?? []).map(q => ({ id: q.id, label: q.label, type: q.type }));

  return (
    <ScrollView contentContainerStyle={rl.scroll}>
      {/* Vertical picker */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={rl.vpScroll}>
        <View style={rl.vpRow}>
          {verticals.map((v, i) => (
            <TouchableOpacity key={v.id} style={[rl.vpChip, vertIdx === i && rl.vpChipActive]} onPress={() => setVertIdx(i)}>
              <Text style={[rl.vpTxt, vertIdx === i && rl.vpTxtActive]}>{v.icon} {v.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <View style={rl.infoCard}>
        <Text style={rl.infoTxt}>Rules automatically adjust the estimate price based on intake answers. They evaluate in a fixed order: flat fees → conditional adds → per-unit → tiered → adders → multipliers.</Text>
      </View>

      {rules.length === 0 ? (
        <View style={rl.empty}>
          <Text style={rl.emptyIcon}>📋</Text>
          <Text style={rl.emptyTitle}>No rules yet</Text>
          <Text style={rl.emptySub}>Add rules to automate pricing adjustments</Text>
        </View>
      ) : (
        rules.map((rule, i) => (
          <View key={rule.id ?? i} style={rl.ruleCard}>
            <View style={rl.ruleTop}>
              <Text style={rl.ruleBucket}>{rule.bucket?.toUpperCase()?.replace('_', ' ') ?? 'OTHER'}</Text>
              <Text style={rl.ruleType}>{rule.type.replace('_', ' ')}</Text>
            </View>
            <Text style={rl.ruleLabel}>{rule.label}</Text>
            <Text style={rl.rulePlain}>{ruleToPlain(rule)}</Text>
          </View>
        ))
      )}

      <TouchableOpacity style={rl.addBtn} onPress={() => setShowBuilder(true)}>
        <Text style={rl.addBtnTxt}>+ Add Rule</Text>
      </TouchableOpacity>

      <RuleBuilderModal
        visible={showBuilder}
        questionOptions={questions}
        onSave={rule => {
          // Rules are part of VerticalConfig which lives in config/verticals.ts.
          // Custom verticals are saved to Firestore via customVerticals storage.
          // TODO: if this is a custom vertical, upsert it with the new rule appended.
          setShowBuilder(false);
        }}
        onClose={() => setShowBuilder(false)}
      />
    </ScrollView>
  );
}
const rl = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 60 },
  vpScroll: { marginBottom: 16, marginHorizontal: -20, paddingHorizontal: 20 },
  vpRow: { flexDirection: 'row', gap: 8 },
  vpChip: { borderWidth: 1, borderColor: T.border, borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 7 },
  vpChipActive: { backgroundColor: T.accent, borderColor: T.accent },
  vpTxt: { color: T.textDim, fontSize: 13 },
  vpTxtActive: { color: '#fff', fontWeight: '600' },
  infoCard: { backgroundColor: T.surface, borderRadius: radii.md, padding: 12, borderWidth: 1, borderColor: T.border, marginBottom: 16 },
  infoTxt: { color: T.sub, fontSize: 12, lineHeight: 18 },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyIcon: { fontSize: 40 }, emptyTitle: { color: T.text, fontSize: 17, fontWeight: '700' }, emptySub: { color: T.sub, fontSize: 13 },
  ruleCard: { backgroundColor: T.surface, borderRadius: radii.md, padding: 14, borderWidth: 1, borderColor: T.border, marginBottom: 8 },
  ruleTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  ruleBucket: { color: T.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  ruleType: { color: T.sub, fontSize: 10 },
  ruleLabel: { color: T.text, fontSize: 15, fontWeight: '600', marginBottom: 4 },
  rulePlain: { color: T.textDim, fontSize: 13, lineHeight: 19 },
  addBtn: { marginTop: 8, borderWidth: 1, borderColor: T.accent, borderRadius: radii.md, padding: 13, alignItems: 'center' },
  addBtnTxt: { color: T.accent, fontSize: 15, fontWeight: '700' },
});

// ─── Presets tab ──────────────────────────────────────────────────────────
function PresetsTab({ presets, onChange, saving }: {
  presets: QualityPreset[]; onChange: (p: QualityPreset[]) => void; saving: boolean;
}) {
  const [local, setLocal] = useState<QualityPreset[]>(presets);
  // Sync when parent loads data after mount (e.g. Firestore read completes).
  React.useEffect(() => { if (presets.length > 0) setLocal(presets); }, [presets]);

  const update = (idx: number, patch: Partial<QualityPreset>) => {
    const next = [...local];
    next[idx] = { ...next[idx], ...patch };
    setLocal(next);
  };

  const PRESET_COLORS: Record<string, { bg: string; border: string; text: string }> = {
    good:   { bg: T.greenLo,  border: T.green,  text: T.greenHi },
    better: { bg: T.amberLo,  border: T.amber,  text: T.amberHi },
    best:   { bg: T.accentLo, border: T.accent,  text: T.accent  },
  };

  return (
    <ScrollView contentContainerStyle={ps.scroll} keyboardShouldPersistTaps="handled">
      <View style={ps.infoCard}>
        <Text style={ps.infoTitle}>💡 About Presets</Text>
        <Text style={ps.infoBody}>Presets let customers choose a quality tier. Each tier applies a multiplier to the base estimate. Tap a preset when creating an estimate to apply it instantly.</Text>
      </View>

      {local.map((preset, idx) => {
        const c = PRESET_COLORS[preset.id] ?? PRESET_COLORS.good;
        return (
          <View key={preset.id} style={[ps.card, { borderColor: c.border, backgroundColor: c.bg }]}>
            <Text style={[ps.cardBadge, { color: c.text }]}>{preset.label}</Text>
            <TextInput
              style={ps.descInput}
              value={preset.description ?? ''}
              onChangeText={v => update(idx, { description: v })}
              placeholder="Short description…"
              placeholderTextColor={T.muted}
            />
            <View style={ps.multRow}>
              <Text style={ps.multLabel}>Multiplier</Text>
              <TextInput
                style={ps.multInput}
                value={String(preset.multiplier)}
                onChangeText={v => update(idx, { multiplier: Math.max(0.5, Number(v) || 1) })}
                keyboardType="decimal-pad"
                selectTextOnFocus
              />
              <Text style={ps.multSuffix}>×</Text>
            </View>
            <Text style={ps.example}>Example: $10,000 × {preset.multiplier} = ${(10000 * preset.multiplier).toLocaleString('en-US', { maximumFractionDigits: 0 })}</Text>
          </View>
        );
      })}

      <TouchableOpacity style={ps.saveBtn} onPress={() => onChange(local)} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={ps.saveBtnTxt}>Save Presets</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}
const ps = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 60 },
  infoCard: { backgroundColor: T.accentLo, borderRadius: radii.md, padding: 14, borderWidth: 1, borderColor: T.accent, marginBottom: 20 },
  infoTitle: { color: T.accent, fontSize: 13, fontWeight: '700', marginBottom: 4 },
  infoBody: { color: T.textDim, fontSize: 13, lineHeight: 19 },
  card: { borderWidth: 1, borderRadius: radii.lg, padding: 16, marginBottom: 16 },
  cardBadge: { fontSize: 18, fontWeight: '800', marginBottom: 10 },
  descInput: { backgroundColor: 'rgba(255,255,255,0.5)', borderWidth: 1, borderColor: T.border, borderRadius: radii.sm, color: T.text, padding: 10, fontSize: 14, marginBottom: 12 },
  multRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  multLabel: { color: T.textDim, fontSize: 14, flex: 1 },
  multInput: { backgroundColor: 'rgba(255,255,255,0.6)', borderWidth: 1, borderColor: T.border, borderRadius: radii.sm, color: T.text, padding: 10, fontSize: 18, fontWeight: '700', width: 90, textAlign: 'center' },
  multSuffix: { color: T.textDim, fontSize: 16 },
  example: { color: T.sub, fontSize: 12, marginTop: 10 },
  saveBtn: { backgroundColor: T.accent, borderRadius: radii.md, padding: 14, alignItems: 'center', marginTop: 8 },
  saveBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

// ─── Main screen ──────────────────────────────────────────────────────────
export function PricingRulesScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('defaults');
  const [verticals, setVerticals] = useState<VerticalConfig[]>(ALL_VERTICALS);
  const [pricingDefaults, setPricingDefaults] = useState<PricingDefaults | null>(null);
  const [presets, setPresets] = useState<QualityPreset[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [custom, settings] = await Promise.all([loadCustomVerticals(), (async () => (await import('../storage/settings')).getSettings())()]);
      setVerticals(mergeVerticals(ALL_VERTICALS, custom));
      setPricingDefaults(settings.pricingDefaults);
      setPresets(settings.presets ?? DEFAULT_SETTINGS.presets);
    } catch {
      // Fall back to built-in defaults so tabs render instead of spinning forever.
      setPricingDefaults(prev => prev ?? DEFAULT_SETTINGS.pricingDefaults);
      setPresets(prev => prev.length > 0 ? prev : DEFAULT_SETTINGS.presets);
    }
  }, []);

  useFocusEffect(load);

  const handleSaveDefaults = async (d: PricingDefaults) => {
    setSaving(true);
    try {
      const { saveSettings, getSettings } = await import('../storage/settings');
      const current = await getSettings();
      await saveSettings({ ...current, pricingDefaults: d });
      setPricingDefaults(d);
    } finally { setSaving(false); }
  };

  const handleSavePresets = async (p: QualityPreset[]) => {
    setSaving(true);
    try {
      const { savePresets } = await import('../storage/settings');
      await savePresets(p);
      setPresets(p);
    } finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={s.safe}>
      {/* Tab bar */}
      <View style={s.tabBar}>
        {TABS.map(tab => (
          <TouchableOpacity key={tab.id} style={[s.tab, activeTab === tab.id && s.tabActive]} onPress={() => setActiveTab(tab.id)}>
            <Text style={[s.tabTxt, activeTab === tab.id && s.tabTxtActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'defaults' && pricingDefaults && (
        <DefaultsTab defaults={pricingDefaults} onChange={handleSaveDefaults} saving={saving} />
      )}
      {activeTab === 'rules' && <RulesTab verticals={verticals} />}
      {activeTab === 'presets' && (
        <PresetsTab presets={presets} onChange={handleSavePresets} saving={saving} />
      )}
      {(!pricingDefaults && activeTab === 'defaults') && <ActivityIndicator style={{ marginTop: 40 }} color={T.accent} />}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: T.border },
  tab: { flex: 1, paddingVertical: 13, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: T.accent },
  tabTxt: { color: T.sub, fontSize: 15, fontWeight: '600' },
  tabTxtActive: { color: T.accent },
});
