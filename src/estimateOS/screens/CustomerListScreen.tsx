// ─── CustomerListScreen ───────────────────────────────────────────────────
import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
  SafeAreaView, ActivityIndicator, Alert, Modal, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Customer, FollowUpStatus, FOLLOW_UP_LABELS } from '../models/types';
import { CustomerRepository } from '../storage/customers';
import { makeId } from '../domain/id';
import { T, radii } from '../theme';

// ─── Quick-create modal (name, phone, email, address only) ────────────────
function CustomerFormModal({ visible, onSave, onClose }: {
  visible: boolean; onSave: (c: Customer) => void; onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [nameErr, setNameErr] = useState('');
  const [saveErr, setSaveErr] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => { setName(''); setPhone(''); setEmail(''); setAddress(''); setNameErr(''); setSaveErr(''); };

  const save = async () => {
    if (!name.trim()) { setNameErr('Name is required'); return; }
    setSaving(true);
    setSaveErr('');
    try {
      const now = new Date().toISOString();
      const c: Customer = {
        id: makeId(), name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        createdAt: now, updatedAt: now,
      };
      await CustomerRepository.upsertCustomer(c);
      onSave(c);
      reset();
    } catch (e: any) {
      setSaveErr(e?.message ?? 'Could not save customer. Please try again.');
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
            <Text style={fm.label}>Service Address</Text>
            <TextInput style={[fm.input, fm.inputMulti]} value={address} onChangeText={setAddress} placeholder="Street, City, State ZIP" placeholderTextColor={T.muted} multiline numberOfLines={2} textAlignVertical="top" />
            {!!saveErr && <Text style={fm.saveErr}>{saveErr}</Text>}
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
  saveErr: { color: T.red, fontSize: 13, marginTop: 16, textAlign: 'center' },
});

// ─── Filter / sort options ────────────────────────────────────────────────

type SortKey = 'name' | 'recent' | 'next_action';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'name',        label: 'Name A–Z' },
  { key: 'recent',      label: 'Recent' },
  { key: 'next_action', label: 'Next Action' },
];

// Status filters: null = All
const STATUS_FILTERS: { key: FollowUpStatus | null; label: string }[] = [
  { key: null,                   label: 'All' },
  { key: 'lead_new',             label: 'New' },
  { key: 'follow_up_due',        label: 'Follow-up Due' },
  { key: 'quote_sent',           label: 'Quote Sent' },
  { key: 'appointment_scheduled',label: 'Scheduled' },
  { key: 'won',                  label: 'Won' },
];

// ─── Main screen ──────────────────────────────────────────────────────────

export function CustomerListScreen({ navigation }: any) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch]       = useState('');
  const [loading, setLoading]     = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [sortKey, setSortKey]     = useState<SortKey>('name');
  const [statusFilter, setStatusFilter] = useState<FollowUpStatus | null>(null);
  const isFirstLoad = useRef(true);

  const load = useCallback(async () => {
    if (isFirstLoad.current) setLoading(true);
    setLoadError(false);
    try { setCustomers(await CustomerRepository.listCustomers()); }
    catch { setLoadError(true); }
    finally {
      isFirstLoad.current = false;
      setLoading(false);
    }
  }, []);

  useFocusEffect(load);

  const filtered = useMemo(() => {
    let result = customers;

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.companyName ?? '').toLowerCase().includes(q) ||
        (c.phone ?? '').includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        (c.address ?? '').toLowerCase().includes(q),
      );
    }

    // Status filter
    if (statusFilter !== null) {
      result = result.filter(c => c.followUpStatus === statusFilter);
    }

    // Sort
    result = [...result].sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name);
      if (sortKey === 'recent') return b.updatedAt.localeCompare(a.updatedAt);
      if (sortKey === 'next_action') {
        const da = a.nextActionAt ?? '9999';
        const db2 = b.nextActionAt ?? '9999';
        return da.localeCompare(db2);
      }
      return 0;
    });

    return result;
  }, [customers, search, statusFilter, sortKey]);

  const deleteCustomer = (id: string, name: string) => {
    Alert.alert('Delete Customer', `Delete ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await CustomerRepository.deleteCustomer(id);
        setCustomers(prev => prev.filter(c => c.id !== id));
      }},
    ]);
  };

  const followUpColor = (status?: FollowUpStatus) => {
    if (!status) return T.border;
    if (status === 'won') return T.green;
    if (status === 'lost') return T.muted;
    if (status === 'follow_up_due') return T.amber;
    if (status === 'quote_sent') return T.accent;
    return T.border;
  };

  return (
    <SafeAreaView style={s.safe}>
      {/* Search bar */}
      <View style={s.searchWrap}>
        <TextInput
          style={s.search}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, company, phone…"
          placeholderTextColor={T.muted}
          autoCapitalize="none"
        />
      </View>

      {/* Status filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow} contentContainerStyle={s.filterContent}>
        {STATUS_FILTERS.map(f => (
          <TouchableOpacity
            key={String(f.key)}
            style={[s.chip, statusFilter === f.key && s.chipActive]}
            onPress={() => setStatusFilter(f.key)}
          >
            <Text style={[s.chipTxt, statusFilter === f.key && s.chipTxtActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Sort pills */}
      <View style={s.sortRow}>
        <Text style={s.sortLabel}>Sort:</Text>
        {SORT_OPTIONS.map(o => (
          <TouchableOpacity key={o.key} onPress={() => setSortKey(o.key)} style={[s.sortPill, sortKey === o.key && s.sortPillActive]}>
            <Text style={[s.sortPillTxt, sortKey === o.key && s.sortPillTxtActive]}>{o.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={T.accent} />
      ) : loadError ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>⚠️</Text>
          <Text style={s.emptyTitle}>Couldn't load customers</Text>
          <Text style={s.emptySub}>Check your connection and tap to retry</Text>
          <TouchableOpacity style={s.emptyBtn} onPress={load}>
            <Text style={s.emptyBtnTxt}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filtered.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>👤</Text>
          <Text style={s.emptyTitle}>{search || statusFilter ? 'No matches' : 'No customers yet'}</Text>
          <Text style={s.emptySub}>Add customers to link them to estimates and invoices</Text>
          {!search && !statusFilter && (
            <TouchableOpacity style={s.emptyBtn} onPress={() => setShowCreate(true)}>
              <Text style={s.emptyBtnTxt}>+ Add First Customer</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={c => c.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[s.row, { borderLeftColor: followUpColor(item.followUpStatus), borderLeftWidth: 3 }]}
              onPress={() => navigation.navigate('CustomerDetail', { customerId: item.id })}
              onLongPress={() => deleteCustomer(item.id, item.name)}
            >
              <View style={s.avatar}>
                <Text style={s.avatarTxt}>{item.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{item.name}</Text>
                {item.companyName ? <Text style={s.company}>{item.companyName}</Text> : null}
                {item.phone && <Text style={s.sub}>{item.phone}</Text>}
                {item.email && <Text style={s.sub}>{item.email}</Text>}
                {item.followUpStatus && (
                  <View style={[s.statusChip, { borderColor: followUpColor(item.followUpStatus), backgroundColor: followUpColor(item.followUpStatus) + '22' }]}>
                    <Text style={[s.statusChipTxt, { color: followUpColor(item.followUpStatus) }]}>
                      {FOLLOW_UP_LABELS[item.followUpStatus]}
                    </Text>
                  </View>
                )}
                {item.nextActionAt && (
                  <Text style={s.nextAction}>
                    Next: {new Date(item.nextActionAt).toLocaleDateString()}
                    {item.nextActionNote ? ` — ${item.nextActionNote}` : ''}
                  </Text>
                )}
              </View>
              <Text style={s.arrow}>›</Text>
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity style={s.fab} onPress={() => setShowCreate(true)}>
        <Text style={s.fabTxt}>+</Text>
      </TouchableOpacity>

      <CustomerFormModal
        visible={showCreate}
        onSave={c => {
          setCustomers(prev => [c, ...prev]);
          setShowCreate(false);
          navigation.navigate('CustomerDetail', { customerId: c.id });
        }}
        onClose={() => setShowCreate(false)}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  searchWrap: { padding: 12, paddingBottom: 6 },
  search: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: radii.md, color: T.text, padding: 11, fontSize: 15 },
  // Filter chips
  filterRow: { flexGrow: 0 },
  filterContent: { paddingHorizontal: 12, paddingVertical: 6, gap: 8, flexDirection: 'row' },
  chip: { borderWidth: 1, borderColor: T.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: T.surface },
  chipActive: { backgroundColor: T.accent, borderColor: T.accent },
  chipTxt: { color: T.sub, fontSize: 13, fontWeight: '500' },
  chipTxtActive: { color: '#fff', fontWeight: '700' },
  // Sort pills
  sortRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 8, gap: 6 },
  sortLabel: { color: T.muted, fontSize: 12 },
  sortPill: { borderWidth: 1, borderColor: T.border, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  sortPillActive: { borderColor: T.accentLo, backgroundColor: T.accentLo },
  sortPillTxt: { color: T.sub, fontSize: 12 },
  sortPillTxtActive: { color: T.accentHi, fontWeight: '700' },
  // List
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingBottom: 80 },
  emptyIcon: { fontSize: 48 }, emptyTitle: { color: T.text, fontSize: 18, fontWeight: '700' },
  emptySub: { color: T.sub, fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
  emptyBtn: { backgroundColor: T.accent, borderRadius: radii.md, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  emptyBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: T.surface, borderRadius: radii.lg, padding: 14, borderWidth: 1, borderColor: T.border },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: T.accentLo, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: T.accent, fontSize: 18, fontWeight: '700' },
  name: { color: T.text, fontSize: 16, fontWeight: '600' },
  company: { color: T.sub, fontSize: 12, marginTop: 1 },
  sub: { color: T.sub, fontSize: 13, marginTop: 2 },
  statusChip: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: 7, paddingVertical: 3, marginTop: 6 },
  statusChipTxt: { fontSize: 11, fontWeight: '700' },
  nextAction: { color: T.muted, fontSize: 11, marginTop: 2 },
  arrow: { color: T.sub, fontSize: 22 },
  fab: { position: 'absolute', bottom: 28, right: 20, width: 52, height: 52, borderRadius: 26, backgroundColor: T.accent, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 5 },
  fabTxt: { color: '#fff', fontSize: 28, fontWeight: '300', lineHeight: 32 },
});
