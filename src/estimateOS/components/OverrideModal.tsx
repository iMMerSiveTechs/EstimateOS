/**
 * OverrideModal.tsx
 *
 * Lets the operator override a pricing driver's low/high amounts
 * or toggle it disabled entirely.
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet,
  TextInput, Switch, KeyboardAvoidingView, Platform,
} from 'react-native';
import { T, radii } from '../theme';
import { PriceDriver, DriverOverrideMap } from '../models/types';
import { applyOverride, removeOverride } from '../domain/pricingEngineV2';

interface Props {
  driver:    PriceDriver | null;
  visible:   boolean;
  overrides: DriverOverrideMap;
  onSave:    (next: DriverOverrideMap) => void;
  onClose:   () => void;
}

export function OverrideModal({ driver, visible, overrides, onSave, onClose }: Props) {
  const [minStr, setMinStr]     = useState('');
  const [maxStr, setMaxStr]     = useState('');
  const [disabled, setDisabled] = useState(false);
  const [showExpl, setShowExpl] = useState(false);

  useEffect(() => {
    if (!driver) return;
    const ov = overrides[driver.id];
    setMinStr(String(Math.round(ov?.min ?? driver.minImpact)));
    setMaxStr(String(Math.round(ov?.max ?? driver.maxImpact)));
    setDisabled(ov?.disabled ?? false);
    setShowExpl(false);
  }, [driver?.id, visible]);

  if (!driver) return null;

  const hasExisting = !!overrides[driver.id];
  const effMin = disabled ? 0 : Math.max(0, Number(minStr) || 0);
  const effMax = disabled ? 0 : Math.max(0, Number(maxStr) || 0);

  const handleSave = () => {
    const min = Number(minStr);
    const max = Number(maxStr);
    if (isNaN(min) || isNaN(max)) return;
    onSave(applyOverride(overrides, driver.id, { min, max, disabled }));
    onClose();
  };

  const handleClear = () => {
    onSave(removeOverride(overrides, driver.id));
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
          <TouchableOpacity activeOpacity={1} style={s.sheet}>
            <View style={s.handle} />
            <Text style={s.title} numberOfLines={2}>{driver.label}</Text>

            <TouchableOpacity onPress={() => setShowExpl(e => !e)}>
              <Text style={s.explToggle}>💡 {showExpl ? 'Hide explanation' : 'Why this line?'}</Text>
            </TouchableOpacity>
            {showExpl && (
              <View style={s.explBox}>
                {driver.explanation && <Text style={s.explTxt}>{driver.explanation}</Text>}
                {driver.triggeredBy && <Text style={s.explTrigger}>Triggered by: {driver.triggeredBy}</Text>}
              </View>
            )}

            <View style={s.refRow}>
              <Text style={s.refLabel}>Computed:</Text>
              <Text style={s.refVal}>${Math.round(driver.minImpact).toLocaleString()} – ${Math.round(driver.maxImpact).toLocaleString()}</Text>
            </View>

            <Text style={s.sectionLabel}>OVERRIDE AMOUNT</Text>
            <View style={s.inputRow}>
              <View style={s.inputWrap}>
                <Text style={s.inputLabel}>Low ($)</Text>
                <TextInput
                  style={[s.input, disabled && s.inputDisabled]}
                  value={minStr}
                  onChangeText={setMinStr}
                  keyboardType="numeric"
                  editable={!disabled}
                  selectTextOnFocus
                />
              </View>
              <View style={s.inputWrap}>
                <Text style={s.inputLabel}>High ($)</Text>
                <TextInput
                  style={[s.input, disabled && s.inputDisabled]}
                  value={maxStr}
                  onChangeText={setMaxStr}
                  keyboardType="numeric"
                  editable={!disabled}
                  selectTextOnFocus
                />
              </View>
            </View>

            <Text style={s.preview}>Effective: ${effMin.toLocaleString()} – ${effMax.toLocaleString()}</Text>

            <View style={s.disableRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.disableLabel}>Disable this driver</Text>
                <Text style={s.disableSub}>Removes it from the total</Text>
              </View>
              <Switch
                value={disabled}
                onValueChange={setDisabled}
                trackColor={{ true: T.red, false: T.border }}
                thumbColor={disabled ? '#fca5a5' : T.sub}
              />
            </View>

            <View style={s.btnRow}>
              {hasExisting && (
                <TouchableOpacity style={s.clearBtn} onPress={handleClear}>
                  <Text style={s.clearTxt}>Reset</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
                <Text style={s.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.saveBtn} onPress={handleSave}>
                <Text style={s.saveTxt}>Apply</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' },
  sheet:     { backgroundColor: T.surface, borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, padding: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 24, borderWidth: 1, borderColor: T.border },
  handle:    { width: 40, height: 4, borderRadius: 2, backgroundColor: T.muted, alignSelf: 'center', marginBottom: 16 },
  title:     { color: T.text, fontSize: 17, fontWeight: '700', marginBottom: 8 },
  explToggle:{ color: T.accent, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  explBox:   { backgroundColor: T.card, borderRadius: radii.md, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: T.border },
  explTxt:   { color: T.textDim, fontSize: 12, lineHeight: 17, marginBottom: 4 },
  explTrigger:{ color: T.sub, fontSize: 11 },
  refRow:    { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 14 },
  refLabel:  { color: T.sub, fontSize: 12 },
  refVal:    { color: T.textDim, fontSize: 13, fontWeight: '600' },
  sectionLabel: { color: T.sub, fontSize: 9, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 },
  inputRow:  { flexDirection: 'row', gap: 10, marginBottom: 8 },
  inputWrap: { flex: 1 },
  inputLabel:{ color: T.sub, fontSize: 11, marginBottom: 4 },
  input:     { backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: radii.md, color: T.text, padding: 11, fontSize: 16, fontWeight: '600' },
  inputDisabled: { opacity: 0.35 },
  preview:   { color: T.textDim, fontSize: 12, textAlign: 'center', marginBottom: 14 },
  disableRow:{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: T.border, marginBottom: 14 },
  disableLabel: { color: T.text, fontSize: 14, fontWeight: '600' },
  disableSub:   { color: T.sub, fontSize: 12 },
  btnRow:    { flexDirection: 'row', gap: 8 },
  clearBtn:  { paddingHorizontal: 14, paddingVertical: 13, borderRadius: radii.lg, backgroundColor: T.card, borderWidth: 1, borderColor: T.border },
  clearTxt:  { color: T.sub, fontWeight: '600', fontSize: 14 },
  cancelBtn: { flex: 1, padding: 13, borderRadius: radii.lg, backgroundColor: T.card, borderWidth: 1, borderColor: T.border, alignItems: 'center' },
  cancelTxt: { color: T.sub, fontWeight: '600', fontSize: 15 },
  saveBtn:   { flex: 2, padding: 13, borderRadius: radii.lg, backgroundColor: T.accent, alignItems: 'center' },
  saveTxt:   { color: '#fff', fontWeight: '700', fontSize: 15 },
});
