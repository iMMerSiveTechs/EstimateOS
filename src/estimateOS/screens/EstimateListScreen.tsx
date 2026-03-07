// ─── EstimateListScreen ───────────────────────────────────────────────────────
// All estimates, sorted by most recent. Tap to open detail, + to create new.
import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet,
  SafeAreaView, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Estimate } from '../models/types';
import { EstimateRepository } from '../storage/repository';
import { T, radii } from '../theme';

const STATUS_COLOR: Record<string, string> = {
  draft:    T.sub,
  pending:  T.amber,
  accepted: T.green,
  rejected: T.red,
};

export function EstimateListScreen({ navigation }: any) {
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading, setLoading]     = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await EstimateRepository.listEstimates();
      setEstimates(list);
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(load);

  return (
    <SafeAreaView style={s.safe}>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={T.accent} />
      ) : (
        <FlatList
          data={estimates}
          keyExtractor={e => e.id}
          contentContainerStyle={s.list}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyIcon}>📝</Text>
              <Text style={s.emptyTitle}>No estimates yet</Text>
              <Text style={s.emptySub}>
                Create your first estimate — pick a service, answer a few{'\n'}questions, and get a price range instantly.
              </Text>
              <TouchableOpacity style={s.emptyBtn} onPress={() => navigation.navigate('NewEstimate')}>
                <Text style={s.emptyBtnTxt}>+ Create First Estimate</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item: est }) => {
            const min = est.computedRange?.min ?? 0;
            const max = est.computedRange?.max ?? 0;
            const date = new Date(est.updatedAt);
            return (
              <TouchableOpacity
                style={s.row}
                onPress={() => navigation.navigate('EstimateDetail', { estimateId: est.id })}
              >
                <View style={s.rowLeft}>
                  <Text style={s.customerName}>{est.customer.name}</Text>
                  {est.estimateNumber && (
                    <Text style={s.estNum}>{est.estimateNumber}</Text>
                  )}
                  <Text style={s.dateText}>{date.toLocaleDateString()}</Text>
                </View>
                <View style={s.rowRight}>
                  <Text style={s.range}>
                    ${min.toLocaleString('en-US')}–${max.toLocaleString('en-US')}
                  </Text>
                  <Text style={[s.status, { color: STATUS_COLOR[est.status] ?? T.sub }]}>
                    {est.status}
                  </Text>
                </View>
                <Text style={s.arrow}>›</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
      <TouchableOpacity style={s.fab} onPress={() => navigation.navigate('NewEstimate')}>
        <Text style={s.fabTxt}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  list: { padding: 16, paddingBottom: 100 },
  empty: { marginTop: 80, alignItems: 'center', paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { color: T.text, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySub: { color: T.sub, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { backgroundColor: T.accent, borderRadius: radii.md, paddingHorizontal: 24, paddingVertical: 12, marginTop: 16 },
  emptyBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: T.surface, borderRadius: radii.md,
    padding: 14, borderWidth: 1, borderColor: T.border, marginBottom: 10,
  },
  rowLeft: { flex: 1 },
  customerName: { color: T.text, fontSize: 15, fontWeight: '600' },
  estNum: { color: T.sub, fontSize: 12, marginTop: 2 },
  dateText: { color: T.muted, fontSize: 11, marginTop: 2 },
  rowRight: { alignItems: 'flex-end' },
  range: { color: T.accent, fontSize: 13, fontWeight: '700' },
  status: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize', marginTop: 3 },
  arrow: { color: T.sub, fontSize: 20 },
  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: T.accent, alignItems: 'center', justifyContent: 'center',
    shadowColor: T.accent, shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  fabTxt: { color: '#fff', fontSize: 28, fontWeight: '400', lineHeight: 32, marginTop: -1 },
});
