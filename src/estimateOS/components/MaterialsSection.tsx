// ─── MaterialsSection ──────────────────────────────────────────────────────
// Per-estimate material line items with library picker and custom entry.

import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal, FlatList,
  StyleSheet, Alert, ActivityIndicator, SafeAreaView,
} from 'react-native';
import { MaterialLineItem, Material } from '../models/types';
import { MaterialRepository } from '../storage/materials';
import { makeId } from '../domain/id';
import { T, radii } from '../theme';

interface Props {
  items: MaterialLineItem[];
  onChange: (items: MaterialLineItem[]) => void;
}

// ─── Library picker modal ─────────────────────────────────────────────────
function LibraryPickerModal({
  visible, onPick, onClose,
}: {
  visible: boolean;
  onPick: (m: Material) => void;
  onClose: () => void;
}) {
  const [library, setLibrary] = useState<Material[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setLibrary(await MaterialRepository.listMaterials()); }
    finally { setLoading(false); }
  }, []);

  React.useEffect(() => { if (visible) { setSearch(''); load(); } }, [visible, load]);

  const filtered = library.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    (m.vendor ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={lp.safe}>
        <View style={lp.header}>
          <TouchableOpacity onPress={onClose}><Text style={lp.cancel}>Cancel</Text></TouchableOpacity>
          <Text style={lp.title}>Materials Library</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={lp.searchWrap}>
          <TextInput
            style={lp.search} value={search} onChangeText={setSearch}
            placeholder="Search materials…" placeholderTextColor={T.muted} autoCapitalize="none"
          />
        </View>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 32 }} color={T.accent} />
        ) : filtered.length === 0 ? (
          <View style={lp.empty}>
            <Text style={lp.emptyIcon}>📦</Text>
            <Text style={lp.emptyTxt}>{search ? 'No matches' : 'Library is empty'}</Text>
            <Text style={lp.emptySub}>Add materials via Settings → Materials Library</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={m => m.id}
            contentContainerStyle={{ padding: 16 }}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            renderItem={({ item }) => (
              <TouchableOpacity style={lp.row} onPress={() => onPick(item)}>
                <View style={{ flex: 1 }}>
                  <Text style={lp.rowName}>{item.name}</Text>
                  <Text style={lp.rowSub}>{item.unit}{item.vendor ? ` · ${item.vendor}` : ''}</Text>
                </View>
                <Text style={lp.rowCost}>${item.unitCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {item.unit}</Text>
              </TouchableOpacity>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const lp = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: T.border },
  title: { color: T.text, fontSize: 17, fontWeight: '700' },
  cancel: { color: T.sub, fontSize: 16 },
  searchWrap: { padding: 12, paddingBottom: 0 },
  search: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: radii.md, color: T.text, padding: 11, fontSize: 15 },
  empty: { flex: 1, alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyIcon: { fontSize: 40 },
  emptyTxt: { color: T.text, fontSize: 16, fontWeight: '600' },
  emptySub: { color: T.sub, fontSize: 13 },
  row: { backgroundColor: T.surface, borderRadius: radii.md, padding: 14, borderWidth: 1, borderColor: T.border, flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowName: { color: T.text, fontSize: 15, fontWeight: '600' },
  rowSub: { color: T.sub, fontSize: 12, marginTop: 2 },
  rowCost: { color: T.accent, fontSize: 13, fontWeight: '700' },
});

// ─── Editable row ─────────────────────────────────────────────────────────
function MaterialRow({
  item, onChange, onDelete,
}: {
  item: MaterialLineItem;
  onChange: (updated: MaterialLineItem) => void;
  onDelete: () => void;
}) {
  const rowTotal = item.unitCost * item.quantity;
  return (
    <View style={r.wrap}>
      <View style={r.topRow}>
        <Text style={r.name} numberOfLines={1}>{item.name}</Text>
        <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={r.del}>✕</Text>
        </TouchableOpacity>
      </View>
      <View style={r.inputs}>
        <View style={r.inputGroup}>
          <Text style={r.inputLabel}>Qty</Text>
          <TextInput
            style={r.input}
            value={String(item.quantity)}
            onChangeText={t => onChange({ ...item, quantity: Math.max(0, Number(t) || 0) })}
            keyboardType="numeric"
          />
        </View>
        <View style={r.inputGroup}>
          <Text style={r.inputLabel}>Unit Cost</Text>
          <TextInput
            style={r.input}
            value={String(item.unitCost)}
            onChangeText={t => onChange({ ...item, unitCost: Math.max(0, Number(t) || 0) })}
            keyboardType="numeric"
          />
        </View>
        <View style={r.inputGroup}>
          <Text style={r.inputLabel}>Total</Text>
          <Text style={r.total}>${rowTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
        </View>
      </View>
      <Text style={r.unit}>{item.unit}</Text>
    </View>
  );
}
const r = StyleSheet.create({
  wrap: { backgroundColor: T.surface, borderRadius: radii.md, padding: 12, borderWidth: 1, borderColor: T.border, marginBottom: 8 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  name: { color: T.text, fontSize: 14, fontWeight: '600', flex: 1 },
  del: { color: T.red, fontSize: 16, fontWeight: '700', paddingLeft: 8 },
  inputs: { flexDirection: 'row', gap: 10 },
  inputGroup: { flex: 1 },
  inputLabel: { color: T.sub, fontSize: 11, marginBottom: 4 },
  input: { backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: radii.sm, color: T.text, padding: 8, fontSize: 14, textAlign: 'center' },
  total: { color: T.accent, fontSize: 14, fontWeight: '700', textAlign: 'center', paddingVertical: 8 },
  unit: { color: T.muted, fontSize: 11, marginTop: 4 },
});

// ─── Custom row form ──────────────────────────────────────────────────────
function AddCustomRow({ onAdd }: { onAdd: (item: MaterialLineItem) => void }) {
  const [visible, setVisible] = useState(false);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('each');
  const [unitCost, setUnitCost] = useState('');
  const [qty, setQty] = useState('1');

  const reset = () => { setName(''); setUnit('each'); setUnitCost(''); setQty('1'); };

  if (!visible) {
    return (
      <TouchableOpacity style={ac.trigger} onPress={() => setVisible(true)}>
        <Text style={ac.triggerTxt}>+ Add Custom</Text>
      </TouchableOpacity>
    );
  }
  return (
    <View style={ac.form}>
      <TextInput style={ac.input} value={name} onChangeText={setName} placeholder="Material name" placeholderTextColor={T.muted} autoFocus />
      <View style={ac.row}>
        <TextInput style={[ac.input, { flex: 1 }]} value={unit} onChangeText={setUnit} placeholder="Unit" placeholderTextColor={T.muted} />
        <TextInput style={[ac.input, { flex: 1 }]} value={unitCost} onChangeText={setUnitCost} placeholder="Unit cost" placeholderTextColor={T.muted} keyboardType="numeric" />
        <TextInput style={[ac.input, { flex: 1 }]} value={qty} onChangeText={setQty} placeholder="Qty" placeholderTextColor={T.muted} keyboardType="numeric" />
      </View>
      <View style={ac.btnRow}>
        <TouchableOpacity style={ac.cancel} onPress={() => { reset(); setVisible(false); }}>
          <Text style={ac.cancelTxt}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={ac.save}
          onPress={() => {
            if (!name.trim()) return;
            onAdd({ id: makeId(), name: name.trim(), unit: unit.trim() || 'each', unitCost: Number(unitCost) || 0, quantity: Number(qty) || 1 });
            reset(); setVisible(false);
          }}
        >
          <Text style={ac.saveTxt}>Add</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
const ac = StyleSheet.create({
  trigger: { borderWidth: 1, borderColor: T.border, borderStyle: 'dashed', borderRadius: radii.md, padding: 12, alignItems: 'center', marginBottom: 4 },
  triggerTxt: { color: T.sub, fontSize: 14 },
  form: { backgroundColor: T.surface, borderRadius: radii.md, padding: 12, borderWidth: 1, borderColor: T.border, marginBottom: 8, gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  input: { backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: radii.sm, color: T.text, padding: 10, fontSize: 14 },
  btnRow: { flexDirection: 'row', gap: 8 },
  cancel: { flex: 1, padding: 10, borderRadius: radii.sm, alignItems: 'center', borderWidth: 1, borderColor: T.border },
  cancelTxt: { color: T.sub, fontWeight: '600' },
  save: { flex: 1, backgroundColor: T.accent, padding: 10, borderRadius: radii.sm, alignItems: 'center' },
  saveTxt: { color: '#fff', fontWeight: '700' },
});

// ─── Main MaterialsSection ─────────────────────────────────────────────────
export function MaterialsSection({ items, onChange }: Props) {
  const [showLibrary, setShowLibrary] = useState(false);

  const total = items.reduce((sum, i) => sum + i.unitCost * i.quantity, 0);

  const update = (idx: number, updated: MaterialLineItem) => {
    const next = [...items];
    next[idx] = updated;
    onChange(next);
  };

  const remove = (idx: number) => {
    Alert.alert('Remove Material', 'Remove this material line?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => onChange(items.filter((_, i) => i !== idx)) },
    ]);
  };

  const addFromLibrary = (m: Material) => {
    onChange([...items, { id: makeId(), materialId: m.id, name: m.name, unit: m.unit, unitCost: m.unitCost, quantity: 1, vendor: m.vendor }]);
  };

  return (
    <View>
      {items.map((item, idx) => (
        <MaterialRow key={item.id} item={item} onChange={u => update(idx, u)} onDelete={() => remove(idx)} />
      ))}

      {items.length === 0 && (
        <View style={ms.empty}>
          <Text style={ms.emptyTxt}>No materials added yet</Text>
        </View>
      )}

      <View style={ms.actions}>
        <TouchableOpacity style={ms.libBtn} onPress={() => setShowLibrary(true)}>
          <Text style={ms.libBtnTxt}>📦 From Library</Text>
        </TouchableOpacity>
        <AddCustomRow onAdd={item => onChange([...items, item])} />
      </View>

      {items.length > 0 && (
        <View style={ms.subtotal}>
          <Text style={ms.subtotalLabel}>Materials Subtotal</Text>
          <Text style={ms.subtotalAmt}>${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
        </View>
      )}

      <LibraryPickerModal visible={showLibrary} onPick={m => { addFromLibrary(m); setShowLibrary(false); }} onClose={() => setShowLibrary(false)} />
    </View>
  );
}

const ms = StyleSheet.create({
  empty: { padding: 12, alignItems: 'center' },
  emptyTxt: { color: T.muted, fontSize: 13 },
  actions: { gap: 8, marginBottom: 8 },
  libBtn: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: radii.md, padding: 12, alignItems: 'center' },
  libBtnTxt: { color: T.textDim, fontSize: 14, fontWeight: '600' },
  subtotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: T.border, marginTop: 4 },
  subtotalLabel: { color: T.textDim, fontSize: 14, fontWeight: '600' },
  subtotalAmt: { color: T.text, fontSize: 16, fontWeight: '700' },
});
