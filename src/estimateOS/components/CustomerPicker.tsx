// ─── CustomerPicker ────────────────────────────────────────────────────────
// Inline component: shows selected customer or "Link Customer" button.
// Opens a modal to search/select/create a customer.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal, FlatList,
  StyleSheet, SafeAreaView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Customer } from '../models/types';
import { CustomerRepository } from '../storage/customers';
import { makeId } from '../domain/id';
import { T, radii } from '../theme';

interface Props {
  customerId?: string;
  onSelect: (customer: Customer | null) => void;
}

// ─── Create/Edit customer form modal ─────────────────────────────────────
function CustomerFormModal({
  visible, initial, onSave, onClose,
}: {
  visible: boolean;
  initial?: Customer;
  onSave: (c: Customer) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [nameErr, setNameErr] = useState('');

  useEffect(() => {
    if (visible) {
      setName(initial?.name ?? '');
      setPhone(initial?.phone ?? '');
      setEmail(initial?.email ?? '');
      setAddress(initial?.address ?? '');
      setNotes(initial?.notes ?? '');
      setNameErr('');
    }
  }, [visible, initial]);

  const save = async () => {
    if (!name.trim()) { setNameErr('Name is required'); return; }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const customer: Customer = {
        id: initial?.id ?? makeId(),
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
        createdAt: initial?.createdAt ?? now,
        updatedAt: now,
      };
      await CustomerRepository.upsertCustomer(customer);
      onSave(customer);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={cf.safe}>
          <View style={cf.header}>
            <TouchableOpacity onPress={onClose}><Text style={cf.cancel}>Cancel</Text></TouchableOpacity>
            <Text style={cf.title}>{initial ? 'Edit Customer' : 'New Customer'}</Text>
            <TouchableOpacity onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color={T.accent} /> : <Text style={cf.save}>Save</Text>}
            </TouchableOpacity>
          </View>

          <View style={cf.body}>
            <Text style={cf.label}>Name *</Text>
            <TextInput
              style={[cf.input, nameErr ? cf.inputErr : null]}
              value={name} onChangeText={t => { setName(t); setNameErr(''); }}
              placeholder="Full name" placeholderTextColor={T.muted}
              autoCapitalize="words" autoFocus
            />
            {nameErr ? <Text style={cf.err}>{nameErr}</Text> : null}

            <Text style={cf.label}>Phone</Text>
            <TextInput style={cf.input} value={phone} onChangeText={setPhone}
              placeholder="(555) 555-5555" placeholderTextColor={T.muted} keyboardType="phone-pad" />

            <Text style={cf.label}>Email</Text>
            <TextInput style={cf.input} value={email} onChangeText={setEmail}
              placeholder="email@example.com" placeholderTextColor={T.muted}
              keyboardType="email-address" autoCapitalize="none" />

            <Text style={cf.label}>Address</Text>
            <TextInput style={[cf.input, cf.inputMulti]} value={address} onChangeText={setAddress}
              placeholder="Street, City, State ZIP" placeholderTextColor={T.muted}
              multiline numberOfLines={2} textAlignVertical="top" />

            <Text style={cf.label}>Notes</Text>
            <TextInput style={[cf.input, cf.inputMulti]} value={notes} onChangeText={setNotes}
              placeholder="Any notes about this customer…" placeholderTextColor={T.muted}
              multiline numberOfLines={3} textAlignVertical="top" />
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const cf = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: T.border },
  title:  { color: T.text, fontSize: 17, fontWeight: '700' },
  cancel: { color: T.sub, fontSize: 16 },
  save:   { color: T.accent, fontSize: 16, fontWeight: '700' },
  body:   { padding: 20 },
  label:  { color: T.textDim, fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 16 },
  input:  { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: radii.sm, color: T.text, padding: 12, fontSize: 15 },
  inputMulti: { minHeight: 70, paddingTop: 10, textAlignVertical: 'top' },
  inputErr: { borderColor: T.red },
  err: { color: T.red, fontSize: 12, marginTop: 4 },
});

// ─── Picker modal ─────────────────────────────────────────────────────────
function PickerModal({
  visible, selectedId, onSelect, onClose,
}: {
  visible: boolean;
  selectedId?: string;
  onSelect: (c: Customer | null) => void;
  onClose: () => void;
}) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setCustomers(await CustomerRepository.listCustomers()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (visible) { setSearch(''); load(); } }, [visible, load]);

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone ?? '').includes(search) ||
    (c.email ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={pm.safe}>
        <View style={pm.header}>
          <TouchableOpacity onPress={onClose}><Text style={pm.cancel}>Cancel</Text></TouchableOpacity>
          <Text style={pm.title}>Link Customer</Text>
          <TouchableOpacity onPress={() => setShowCreate(true)}>
            <Text style={pm.add}>+ New</Text>
          </TouchableOpacity>
        </View>

        <View style={pm.searchWrap}>
          <TextInput
            style={pm.search} value={search} onChangeText={setSearch}
            placeholder="Search by name, phone, or email"
            placeholderTextColor={T.muted} autoCapitalize="none"
          />
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 32 }} color={T.accent} />
        ) : filtered.length === 0 ? (
          <View style={pm.empty}>
            <Text style={pm.emptyIcon}>👤</Text>
            <Text style={pm.emptyTxt}>{search ? 'No matches' : 'No customers yet'}</Text>
            <TouchableOpacity style={pm.emptyBtn} onPress={() => setShowCreate(true)}>
              <Text style={pm.emptyBtnTxt}>Create Customer</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={c => c.id}
            contentContainerStyle={{ padding: 16 }}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            renderItem={({ item }) => {
              const sel = item.id === selectedId;
              return (
                <TouchableOpacity
                  style={[pm.row, sel && pm.rowActive]}
                  onPress={() => { onSelect(item); onClose(); }}
                >
                  <View style={pm.avatar}>
                    <Text style={pm.avatarTxt}>{item.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={pm.rowName}>{item.name}</Text>
                    {item.phone && <Text style={pm.rowSub}>{item.phone}</Text>}
                    {item.email && <Text style={pm.rowSub}>{item.email}</Text>}
                  </View>
                  {sel && <Text style={pm.check}>✓</Text>}
                </TouchableOpacity>
              );
            }}
          />
        )}

        {selectedId && (
          <TouchableOpacity style={pm.unlink} onPress={() => { onSelect(null); onClose(); }}>
            <Text style={pm.unlinkTxt}>Unlink customer</Text>
          </TouchableOpacity>
        )}

        <CustomerFormModal
          visible={showCreate}
          onSave={c => { setShowCreate(false); onSelect(c); onClose(); load(); }}
          onClose={() => setShowCreate(false)}
        />
      </SafeAreaView>
    </Modal>
  );
}

const pm = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: T.border },
  title: { color: T.text, fontSize: 17, fontWeight: '700' },
  cancel: { color: T.sub, fontSize: 16 },
  add: { color: T.accent, fontSize: 16, fontWeight: '700' },
  searchWrap: { padding: 12, paddingBottom: 0 },
  search: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: radii.md, color: T.text, padding: 11, fontSize: 15 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingBottom: 60 },
  emptyIcon: { fontSize: 40 },
  emptyTxt: { color: T.sub, fontSize: 15 },
  emptyBtn: { backgroundColor: T.accent, borderRadius: radii.md, paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: T.surface, borderRadius: radii.md, padding: 12, borderWidth: 1, borderColor: T.border },
  rowActive: { borderColor: T.accent },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: T.accentLo, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: T.accent, fontSize: 16, fontWeight: '700' },
  rowName: { color: T.text, fontSize: 15, fontWeight: '600' },
  rowSub: { color: T.sub, fontSize: 12, marginTop: 1 },
  check: { color: T.accent, fontSize: 18, fontWeight: '700' },
  unlink: { margin: 16, padding: 14, backgroundColor: T.surface, borderRadius: radii.md, alignItems: 'center', borderWidth: 1, borderColor: T.border },
  unlinkTxt: { color: T.sub, fontSize: 14 },
});

// ─── Main CustomerPicker widget ────────────────────────────────────────────
export function CustomerPicker({ customerId, onSelect }: Props) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    if (customerId) {
      CustomerRepository.getCustomer(customerId).then(c => setCustomer(c));
    } else {
      setCustomer(null);
    }
  }, [customerId]);

  return (
    <View>
      {customer ? (
        <TouchableOpacity style={w.card} onPress={() => setShowPicker(true)}>
          <View style={w.avatar}>
            <Text style={w.avatarTxt}>{customer.name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={w.name}>{customer.name}</Text>
            {customer.phone && <Text style={w.sub}>{customer.phone}</Text>}
          </View>
          <Text style={w.change}>Change</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={w.link} onPress={() => setShowPicker(true)}>
          <Text style={w.linkTxt}>👤 Link Customer</Text>
        </TouchableOpacity>
      )}

      <PickerModal
        visible={showPicker}
        selectedId={customerId}
        onSelect={c => { setCustomer(c); onSelect(c); }}
        onClose={() => setShowPicker(false)}
      />
    </View>
  );
}

const w = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: T.surface, borderRadius: radii.md, padding: 12, borderWidth: 1, borderColor: T.border },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: T.accentLo, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: T.accent, fontSize: 15, fontWeight: '700' },
  name:  { color: T.text, fontSize: 15, fontWeight: '600' },
  sub:   { color: T.sub, fontSize: 12, marginTop: 1 },
  change:{ color: T.accent, fontSize: 13, fontWeight: '600' },
  link:  { borderWidth: 1, borderColor: T.border, borderRadius: radii.md, borderStyle: 'dashed', padding: 13, alignItems: 'center' },
  linkTxt: { color: T.sub, fontSize: 14 },
});
