/**
 * PricingSummaryCard.tsx
 *
 * Live pricing panel displayed in NewEstimateScreen.
 * Shows:
 *  - Total range (low–high) with "Edited" badge when overrides exist
 *  - Bucket subtotals (collapsible)
 *  - "Why this price?" expandable drivers list
 *  - Per-driver edit button → OverrideModal
 *  - "Add manual line" button
 *
 * Uses the extended PriceDriver with id/overrideMin/overrideMax/disabled.
 */

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  TextInput, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { T, radii } from '../theme';
import { BUCKET_LABELS } from '../models/types';
import { PriceDriver, BucketSummary, DriverBucket, DriverOverride, DriverOverrideMap, PricingResult } from '../models/types';
import { OverrideModal } from './OverrideModal';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  result:    PricingResult | null;
  overrides: DriverOverrideMap;
  onOverrideChange: (map: DriverOverrideMap) => void;
}

// ─── Bucket icons ─────────────────────────────────────────────────────────────

const BUCKET_ICONS: Record<DriverBucket, string> = {
  labor:        '👷',
  materials:    '🪵',
  access:       '🚚',
  disposal_fees:'🗑',
  risk:         '⚠️',
  other:        '📦',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

function effectiveMin(d: PriceDriver): number {
  return d.disabled ? 0 : (d.overrideMin ?? d.minImpact);
}

function effectiveMax(d: PriceDriver): number {
  return d.disabled ? 0 : (d.overrideMax ?? d.maxImpact);
}

// ─── Manual line item modal ───────────────────────────────────────────────────

interface ManualLineModalProps {
  visible: boolean;
  onSave:  (d: PriceDriver) => void;
  onClose: () => void;
}

let _manualIdx = 0;

function ManualLineModal({ visible, onSave, onClose }: ManualLineModalProps) {
  const [label,  setLabel]  = useState('');
  const [low,    setLow]    = useState('');
  const [high,   setHigh]   = useState('');
  const [bucket, setBucket] = useState<DriverBucket>('other');

  const buckets: DriverBucket[] = ['labor', 'materials', 'access', 'disposal_fees', 'risk', 'other'];

  // Allow negative values for discounts/credits; low must be <= high, both must be finite numbers
  const parsedLow  = parseFloat(low);
  const parsedHigh = parseFloat(high);
  const canSave = label.trim().length > 0
    && !isNaN(parsedLow) && isFinite(parsedLow)
    && !isNaN(parsedHigh) && isFinite(parsedHigh)
    && parsedLow <= parsedHigh;

  const handleSave = () => {
    onSave({
      id:          `manual_${_manualIdx++}`,
      label:       label.trim(),
      minImpact:   parsedLow,
      maxImpact:   parsedHigh,
      bucket,
      editable:    true,
      explanation: 'Manually added by operator',
      triggeredBy: 'Manual',
    });
    setLabel(''); setLow(''); setHigh(''); setBucket('other');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={ml.wrapper} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={ml.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={ml.sheet}>
          <View style={ml.handle} />
          <Text style={ml.title}>Add Manual Line</Text>

          <Text style={ml.label}>Label</Text>
          <TextInput style={ml.input} value={label} onChangeText={setLabel}
            placeholder="e.g. Travel surcharge" placeholderTextColor={T.sub} autoFocus />

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={ml.label}>Low ($)</Text>
              <TextInput style={ml.input} value={low} onChangeText={setLow}
                keyboardType="numeric" placeholder="0" placeholderTextColor={T.sub} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={ml.label}>High ($)</Text>
              <TextInput style={ml.input} value={high} onChangeText={setHigh}
                keyboardType="numeric" placeholder="0" placeholderTextColor={T.sub} />
            </View>
          </View>

          <Text style={ml.label}>Bucket</Text>
          <View style={ml.bucketRow}>
            {buckets.map(b => (
              <TouchableOpacity key={b}
                style={[ml.bucketChip, bucket === b && ml.bucketActive]}
                onPress={() => setBucket(b)}
              >
                <Text style={[ml.bucketTxt, bucket === b && { color: T.accent }]}>
                  {BUCKET_ICONS[b]} {BUCKET_LABELS[b]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={ml.btnRow}>
            <TouchableOpacity style={ml.cancelBtn} onPress={onClose}>
              <Text style={ml.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[ml.saveBtn, !canSave && ml.saveDis]} onPress={handleSave} disabled={!canSave}>
              <Text style={ml.saveTxt}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const ml = StyleSheet.create({
  wrapper:    { flex: 1, justifyContent: 'flex-end' },
  backdrop:   { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)' },
  sheet: {
    backgroundColor: T.surface,
    borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl,
    padding: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    borderWidth: 1, borderColor: T.border,
  },
  handle:    { width: 40, height: 4, borderRadius: 2, backgroundColor: T.muted, alignSelf: 'center', marginBottom: 16 },
  title:     { color: T.text, fontSize: 16, fontWeight: '800', marginBottom: 14 },
  label:     { color: T.textDim, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 5, marginTop: 12 },
  input:     { backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: radii.md, color: T.text, padding: 12, fontSize: 15 },
  bucketRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  bucketChip:{ borderWidth: 1, borderColor: T.border, borderRadius: radii.sm, paddingHorizontal: 8, paddingVertical: 5 },
  bucketActive: { borderColor: T.accent, backgroundColor: T.accentLo },
  bucketTxt:    { color: T.sub, fontSize: 11, fontWeight: '600' },
  btnRow:    { flexDirection: 'row', gap: 10, marginTop: 18 },
  cancelBtn: { flex: 0.45, borderWidth: 1, borderColor: T.border, borderRadius: radii.md, padding: 13, alignItems: 'center' },
  cancelTxt: { color: T.sub, fontWeight: '700' },
  saveBtn:   { flex: 1, backgroundColor: T.accent, borderRadius: radii.md, padding: 13, alignItems: 'center' },
  saveDis:   { opacity: 0.45 },
  saveTxt:   { color: '#fff', fontWeight: '700', fontSize: 14 },
});

// ─── Main Component ───────────────────────────────────────────────────────────

export function PricingSummaryCard({ result, overrides, onOverrideChange }: Props) {
  const [expanded,       setExpanded]       = useState(false);
  const [bucketsExpanded,setBucketsExpanded] = useState(false);
  const [editingDriver,  setEditingDriver]  = useState<PriceDriver | null>(null);
  const [showManual,     setShowManual]     = useState(false);
  const [manualDrivers,  setManualDrivers]  = useState<PriceDriver[]>([]);

  if (!result) {
    return (
      <View style={s.emptyCard}>
        <Text style={s.emptyTxt}>Fill in details above to see your price estimate.</Text>
      </View>
    );
  }

  const hasOverrides = Object.keys(overrides).length > 0 || manualDrivers.length > 0;
  const allDrivers   = [...result.drivers, ...manualDrivers];

  // Recompute effective totals considering overrides and manual lines
  let effMin = 0, effMax = 0;
  for (const d of allDrivers) {
    effMin += effectiveMin(d);
    effMax += effectiveMax(d);
  }
  // Add base (not a driver)
  effMin += result.range.min - (result.drivers.reduce((s, d) => s + d.minImpact, 0));
  effMax += result.range.max - (result.drivers.reduce((s, d) => s + d.maxImpact, 0));

  // Use computed range when no overrides, effective when overrides/manual items exist
  // Do NOT clamp to 0: manual discount items can legitimately make the total smaller
  const displayMin = hasOverrides ? Math.round(effMin / 5) * 5 : result.range.min;
  const displayMax = hasOverrides ? Math.round(effMax / 5) * 5 : result.range.max;

  function handleOverrideSave(o: DriverOverride) {
    onOverrideChange({ ...overrides, [o.driverId]: o });
  }

  function handleOverrideClear(driverId: string) {
    const next = { ...overrides };
    delete next[driverId];
    onOverrideChange(next);
  }

  return (
    <View style={s.card}>
      {/* Total range header */}
      <View style={s.totalRow}>
        <View>
          <Text style={s.totalLabel}>ESTIMATED RANGE</Text>
          <Text style={s.totalValue}>{fmt(displayMin)} – {fmt(displayMax)}</Text>
        </View>
        {hasOverrides && (
          <View style={s.editedBadge}>
            <Text style={s.editedTxt}>Edited</Text>
          </View>
        )}
      </View>

      {/* Bucket subtotals */}
      <TouchableOpacity style={s.sectionRow} onPress={() => setBucketsExpanded(e => !e)}>
        <Text style={s.sectionLabel}>Bucket breakdown</Text>
        <Text style={s.chevron}>{bucketsExpanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {bucketsExpanded && (
        <View style={s.bucketList}>
          {result.buckets.map(b => (
            <View key={b.bucket} style={s.bucketRow}>
              <Text style={s.bucketIcon}>{BUCKET_ICONS[b.bucket]}</Text>
              <Text style={s.bucketName}>{BUCKET_LABELS[b.bucket]}</Text>
              <Text style={s.bucketRange}>
                {fmt(b.totalMin)} – {fmt(b.totalMax)}
              </Text>
            </View>
          ))}
          {manualDrivers.length > 0 && (
            <View style={s.bucketRow}>
              <Text style={s.bucketIcon}>✏️</Text>
              <Text style={s.bucketName}>Manual</Text>
              <Text style={s.bucketRange}>
                {fmt(manualDrivers.reduce((acc, d) => acc + d.minImpact, 0))} – {fmt(manualDrivers.reduce((acc, d) => acc + d.maxImpact, 0))}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Drivers list */}
      <TouchableOpacity style={s.sectionRow} onPress={() => setExpanded(e => !e)}>
        <Text style={s.sectionLabel}>Why this price? ({allDrivers.length} driver{allDrivers.length !== 1 ? 's' : ''})</Text>
        <Text style={s.chevron}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {expanded && (
        <View style={s.driverList}>
          {allDrivers.map(d => {
            const isDisabled = d.disabled;
            const eMin = effectiveMin(d);
            const eMax = effectiveMax(d);
            const hasOvr = overrides[d.id] != null;
            return (
              <View key={d.id} style={[s.driverRow, isDisabled && s.driverDisabled]}>
                <View style={s.driverMeta}>
                  <View style={s.driverLabelRow}>
                    <Text style={[s.driverLabel, isDisabled && { textDecorationLine: 'line-through', color: T.sub }]}>
                      {d.label}
                    </Text>
                    {hasOvr && !isDisabled && (
                      <View style={s.ovrBadge}><Text style={s.ovrBadgeTxt}>Override</Text></View>
                    )}
                    {isDisabled && (
                      <View style={s.disabledBadge}><Text style={s.disabledBadgeTxt}>Off</Text></View>
                    )}
                  </View>
                  {d.triggeredBy && (
                    <Text style={s.driverTrigger}>↳ {d.triggeredBy}</Text>
                  )}
                </View>
                <View style={s.driverRight}>
                  {!isDisabled && (
                    <Text style={s.driverRange}>{fmt(eMin)} – {fmt(eMax)}</Text>
                  )}
                  {d.editable && (
                    <TouchableOpacity style={s.editBtn} onPress={() => setEditingDriver(d)}>
                      <Text style={s.editBtnTxt}>Edit</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}

          {/* Add manual line */}
          <TouchableOpacity style={s.addLineBtn} onPress={() => setShowManual(true)}>
            <Text style={s.addLineTxt}>+ Add manual line</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Override modal */}
      <OverrideModal
        driver={editingDriver}
        override={editingDriver ? overrides[editingDriver.id] : undefined}
        onSave={handleOverrideSave}
        onClear={handleOverrideClear}
        onClose={() => setEditingDriver(null)}
      />

      {/* Manual line modal */}
      <ManualLineModal
        visible={showManual}
        onSave={d => setManualDrivers(prev => [...prev, d])}
        onClose={() => setShowManual(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  emptyCard: { backgroundColor: T.card, borderRadius: radii.lg, padding: 20, borderWidth: 1, borderColor: T.border, alignItems: 'center' },
  emptyTxt:  { color: T.sub, fontSize: 13, textAlign: 'center' },

  card: {
    backgroundColor: T.surface,
    borderRadius: radii.lg,
    borderWidth: 1, borderColor: T.border,
    overflow: 'hidden',
    marginTop: 8,
  },

  totalRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  totalLabel:{ color: T.sub, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  totalValue:{ color: T.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },

  editedBadge: { backgroundColor: T.amberLo, borderRadius: radii.sm, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: T.amber },
  editedTxt:   { color: T.amberHi, fontSize: 11, fontWeight: '700' },

  sectionRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: T.border },
  sectionLabel:{ color: T.textDim, fontSize: 12, fontWeight: '700' },
  chevron:     { color: T.sub, fontSize: 12 },

  bucketList:  { paddingHorizontal: 16, paddingBottom: 10 },
  bucketRow:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8 },
  bucketIcon:  { fontSize: 14, width: 22, textAlign: 'center' },
  bucketName:  { color: T.textDim, fontSize: 13, flex: 1 },
  bucketRange: { color: T.text, fontSize: 13, fontWeight: '600' },

  driverList:  { paddingHorizontal: 16, paddingBottom: 10 },
  driverRow:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: T.muted, gap: 8 },
  driverDisabled: { opacity: 0.5 },
  driverMeta:  { flex: 1 },
  driverLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  driverLabel: { color: T.text, fontSize: 13, fontWeight: '600', flexShrink: 1 },
  driverTrigger:{ color: T.sub, fontSize: 11, marginTop: 2 },
  driverRight: { alignItems: 'flex-end', gap: 4 },
  driverRange: { color: T.textDim, fontSize: 12, fontWeight: '600' },

  ovrBadge:      { backgroundColor: T.amberLo, borderRadius: radii.sm, paddingHorizontal: 5, paddingVertical: 2 },
  ovrBadgeTxt:   { color: T.amberHi, fontSize: 9, fontWeight: '700' },
  disabledBadge: { backgroundColor: T.redLo, borderRadius: radii.sm, paddingHorizontal: 5, paddingVertical: 2 },
  disabledBadgeTxt:{ color: T.red, fontSize: 9, fontWeight: '700' },

  editBtn:     { backgroundColor: T.accentLo, borderRadius: radii.sm, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: T.accent },
  editBtnTxt:  { color: T.accent, fontSize: 11, fontWeight: '700' },

  addLineBtn:  { marginTop: 8, alignItems: 'center', padding: 10, borderWidth: 1, borderColor: T.border, borderRadius: radii.md, borderStyle: 'dashed' },
  addLineTxt:  { color: T.textDim, fontSize: 13, fontWeight: '600' },
});
