// ─── CustomerListScreen ───────────────────────────────────────────────────
import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
  SafeAreaView, ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Customer } from '../models/types';
import { CustomerRepository } from '../storage/customers';
import { makeId } from '../domain/id';
import { T, radii } from '../theme';

function CustomerFormModal({ visible, onSave, onClose }: {
  visible: boolean; onSave: (c: Customer) => void; onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [nameErr, setNameErr] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => { setName(''); setPhone(''); setEmail(''); setAddress(''); setNameErr(''); };

  const save = async () => {
    if (!name.trim()) { setNameErr('Name is required'); return; }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const c: Customer = { id: makeId(), name: name.trim(), phone: phone.trim() || undefined, email: email.trim() || undefined, address: address.trim() || undefined, createdAt: now, updatedAt: now };
      await CustomerRepository.upsertCustomer(c);
      onSave(c);
      reset();
    } finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={fm.safe}>
          <View style={fm.header}>
            <TouchableOpacity onPress={() => { reset(); onClose(); }}><Text style={fm.cancel}>Cancel</Text></TouchableOpacity>
            <Text style={fm.title}>New Customer</Text>
            <TouchableOpacity onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color={T.accent} /> : <Text style={fm.save}>Save</Text>}
            </TouchableOpacity>
          </View>
          <View style={fm.body}>
            <Text style={fm.label}>Name *</Text>
            <TextInput style={[fm.input, nameErr ? fm.inputErr : null]} value={name} onChangeText={t => { setName(t); setNameErr(''); }} placeholder="Full name" placeholderTextColor={T.muted} autoCapitalize="words" autoFocus />
            {nameErr ? <Text style={fm.err}>{nameErr}</Text> : null}
            <Text style={fm.label}>Phone</Text>
            <TextInput style={fm.input} value={phone} onChangeText={setPhone} placeholder="(555) 555-5555" placeholderTextColor={T.muted} keyboardType="phone-pad" />
            <Text style={fm.label}>Email</Text>
            <TextInput style={fm.input} value={email} onChangeText={setEmail} placeholder="email@example.com" placeholderTextColor={T.muted} keyboardType="email-address" autoCapitalize="none" />
            <Text style={fm.label}>Address</Text>
            <TextInput style={[fm.input, fm.inputMulti]} value={address} onChangeText={setAddress} placeholder="Street, City, State ZIP" placeholderTextColor={T.muted} multiline numberOfLines={2} textAlignVertical="top" />
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
const fm = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: T.border },
  title: { color: T.text, fontSize: 17, fontWeight: '700' }, cancel: { color: T.sub, fontSize: 16 }, save: { color: T.accent, fontSize: 16, fontWeight: '700' },
  body: { padding: 20 },
  label: { color: T.textDim, fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 16 },
  input: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: radii.sm, color: T.text, padding: 12, fontSize: 15 },
  inputMulti: { minHeight: 70, paddingTop: 10 },
  inputErr: { borderColor: T.red }, err: { color: T.red, fontSize: 12, marginTop: 4 },
});

export function CustomerListScreen({ navigation }: any) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setCustomers(await CustomerRepository.listCustomers()); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(load);

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone ?? '').includes(search) ||
    (c.email ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  const deleteCustomer = (id: string, name: string) => {
    Alert.alert('Delete Customer', `Delete ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await CustomerRepository.deleteCustomer(id);
        setCustomers(prev => prev.filter(c => c.id !== id));
      }},
    ]);
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.searchWrap}>
        <TextInput style={s.search} value={search} onChangeText={setSearch} placeholder="Search customers…" placeholderTextColor={T.muted} autoCapitalize="none" />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={T.accent} />
      ) : filtered.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>👤</Text>
          <Text style={s.emptyTitle}>{search ? 'No matches' : 'No customers yet'}</Text>
          <Text style={s.emptySub}>Add customers to link them to estimates and invoices</Text>
          {!search && (
            <TouchableOpacity style={s.emptyBtn} onPress={() => setShowCreate(true)}>
              <Text style={s.emptyBtnTxt}>+ Add First Customer</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={c => c.id}
          contentContainerStyle={{ padding: 16 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => (
            <TouchableOpacity style={s.row} onPress={() => navigation.navigate('CustomerDetail', { customerId: item.id })}
              onLongPress={() => deleteCustomer(item.id, item.name)}>
              <View style={s.avatar}>
                <Text style={s.avatarTxt}>{item.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{item.name}</Text>
                {item.phone && <Text style={s.sub}>{item.phone}</Text>}
                {item.email && <Text style={s.sub}>{item.email}</Text>}
              </View>
              <Text style={s.arrow}>›</Text>
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity style={s.fab} onPress={() => setShowCreate(true)}>
        <Text style={s.fabTxt}>+</Text>
      </TouchableOpacity>

      <CustomerFormModal visible={showCreate} onSave={c => { setCustomers(prev => [c, ...prev]); setShowCreate(false); }} onClose={() => setShowCreate(false)} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  searchWrap: { padding: 12 },
  search: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: radii.md, color: T.text, padding: 11, fontSize: 15 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingBottom: 80 },
  emptyIcon: { fontSize: 48 }, emptyTitle: { color: T.text, fontSize: 18, fontWeight: '700' },
  emptySub: { color: T.sub, fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
  emptyBtn: { backgroundColor: T.accent, borderRadius: radii.md, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  emptyBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: T.surface, borderRadius: radii.lg, padding: 14, borderWidth: 1, borderColor: T.border },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: T.accentLo, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: T.accent, fontSize: 18, fontWeight: '700' },
  name: { color: T.text, fontSize: 16, fontWeight: '600' },
  sub: { color: T.sub, fontSize: 13, marginTop: 2 },
  arrow: { color: T.sub, fontSize: 22 },
  fab: { position: 'absolute', bottom: 28, right: 20, width: 52, height: 52, borderRadius: 26, backgroundColor: T.accent, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 5 },
  fabTxt: { color: '#fff', fontSize: 28, fontWeight: '300', lineHeight: 32 },
});
