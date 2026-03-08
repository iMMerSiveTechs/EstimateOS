/**
 * GettingStartedChecklist.tsx — Pilot onboarding checklist.
 *
 * Shown on the dashboard until dismissed or all items completed.
 * Progress is persisted via AsyncStorage.
 * Each item links to the relevant screen.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { T, radii } from '../theme';

const CHECKLIST_KEY = '@estimateos_getting_started_v1';
const DISMISSED_KEY = '@estimateos_getting_started_dismissed';

export interface ChecklistContext {
  hasBusinessProfile: boolean;
  hasCustomer: boolean;
  hasEstimate: boolean;
  hasInvoice: boolean;
  hasReminder: boolean;
  hasIntake: boolean;
}

interface ChecklistItem {
  id: string;
  label: string;
  hint: string;
  done: boolean;
  screen: string;
  params?: Record<string, any>;
}

function buildItems(ctx: ChecklistContext): ChecklistItem[] {
  return [
    { id: 'profile', label: 'Set up business profile', hint: 'Company name, phone, and address', done: ctx.hasBusinessProfile, screen: 'Settings' },
    { id: 'customer', label: 'Add your first client', hint: 'Capture a lead or add a customer', done: ctx.hasCustomer, screen: 'Intake' },
    { id: 'estimate', label: 'Create your first estimate', hint: 'Pick a service, answer questions, get a price range', done: ctx.hasEstimate, screen: 'NewEstimate' },
    { id: 'invoice', label: 'Create an invoice', hint: 'Convert an accepted estimate to an invoice', done: ctx.hasInvoice, screen: 'EstimatesTab' },
    { id: 'followup', label: 'Schedule a follow-up', hint: 'Set a reminder to check back with a customer', done: ctx.hasReminder, screen: 'CustomersTab' },
  ];
}

export function useGettingStartedDismissed() {
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(DISMISSED_KEY).then(v => setDismissed(v === 'true'));
  }, []);
  const dismiss = useCallback(async () => {
    await AsyncStorage.setItem(DISMISSED_KEY, 'true');
    setDismissed(true);
  }, []);
  return { dismissed, dismiss };
}

export function GettingStartedChecklist({ context, navigation, onDismiss }: {
  context: ChecklistContext;
  navigation: any;
  onDismiss: () => void;
}) {
  const items = buildItems(context);
  const completed = items.filter(i => i.done).length;
  const total = items.length;
  const allDone = completed === total;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  if (allDone) {
    return (
      <View style={s.card}>
        <Text style={s.doneIcon}>🎉</Text>
        <Text style={s.doneTitle}>You're all set!</Text>
        <Text style={s.doneSub}>Your workspace is ready for real jobs.</Text>
        <TouchableOpacity style={s.dismissBtn} onPress={onDismiss}>
          <Text style={s.dismissTxt}>Hide checklist</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.card}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Getting Started</Text>
          <Text style={s.sub}>{completed} of {total} complete</Text>
        </View>
        <TouchableOpacity onPress={onDismiss}>
          <Text style={s.dismissSmall}>Hide</Text>
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      <View style={s.progressTrack}>
        <View style={[s.progressBar, { width: `${pct}%` as any }]} />
      </View>

      {/* Items */}
      {items.map(item => (
        <TouchableOpacity
          key={item.id}
          style={[s.itemRow, item.done && s.itemRowDone]}
          onPress={() => !item.done && navigation.navigate(item.screen, item.params)}
          disabled={item.done}
        >
          <View style={[s.checkCircle, item.done && s.checkCircleDone]}>
            {item.done && <Text style={s.checkMark}>✓</Text>}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.itemLabel, item.done && s.itemLabelDone]}>{item.label}</Text>
            {!item.done && <Text style={s.itemHint}>{item.hint}</Text>}
          </View>
          {!item.done && <Text style={s.goArrow}>→</Text>}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: T.surface, borderRadius: radii.xl, padding: 18, borderWidth: 1, borderColor: T.accent + '44', marginBottom: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  title: { color: T.text, fontSize: 16, fontWeight: '800' },
  sub: { color: T.sub, fontSize: 12, marginTop: 2 },
  dismissSmall: { color: T.muted, fontSize: 12 },
  progressTrack: { height: 6, backgroundColor: T.border, borderRadius: 3, overflow: 'hidden', marginBottom: 14 },
  progressBar: { height: '100%', backgroundColor: T.accent, borderRadius: 3 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: T.border },
  itemRowDone: { opacity: 0.6 },
  checkCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: T.border, alignItems: 'center', justifyContent: 'center' },
  checkCircleDone: { backgroundColor: T.green, borderColor: T.green },
  checkMark: { color: '#fff', fontSize: 13, fontWeight: '800' },
  itemLabel: { color: T.text, fontSize: 14, fontWeight: '600' },
  itemLabelDone: { textDecorationLine: 'line-through', color: T.muted },
  itemHint: { color: T.sub, fontSize: 12, marginTop: 1 },
  goArrow: { color: T.accent, fontSize: 16, fontWeight: '700' },
  doneIcon: { fontSize: 36, textAlign: 'center', marginBottom: 8 },
  doneTitle: { color: T.text, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  doneSub: { color: T.sub, fontSize: 13, textAlign: 'center', marginTop: 4 },
  dismissBtn: { marginTop: 14, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: radii.md, borderWidth: 1, borderColor: T.border },
  dismissTxt: { color: T.sub, fontSize: 13, fontWeight: '600' },
});
