// ─── ReminderSheet ────────────────────────────────────────────────────────────
// Phase 6+7: Bottom sheet modal for creating or editing a reminder.
// Used anywhere a quick "remind me" action is needed.
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Modal, ScrollView, Platform, KeyboardAvoidingView, Alert,
} from 'react-native';
import { Reminder, ReminderType, REMINDER_TYPE_LABELS } from '../models/types';
import { ReminderRepository } from '../storage/reminders';
import { scheduleReminderNotification } from '../services/notificationService';
import { T, radii } from '../theme';

interface Props {
  visible: boolean;
  initial?: Partial<Reminder>;          // pre-fill from caller
  onClose: () => void;
  onSaved: (reminder: Reminder) => void;
}

// Quick-pick day offsets
const QUICK_DATES = [
  { label: 'Tomorrow',  days: 1 },
  { label: '3 days',    days: 3 },
  { label: '1 week',    days: 7 },
  { label: '2 weeks',   days: 14 },
  { label: '1 month',   days: 30 },
];

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function ReminderSheet({ visible, initial, onClose, onSaved }: Props) {
  const [type, setType] = useState<ReminderType>('estimate_followup');
  const [dueDate, setDueDate] = useState(addDays(3));
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (visible) {
      setType(initial?.type ?? 'estimate_followup');
      setDueDate(initial?.dueDate?.slice(0, 10) ?? addDays(3));
      setNote(initial?.note ?? '');
      setErrors({});
    }
  }, [visible, initial]);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!dueDate.match(/^\d{4}-\d{2}-\d{2}$/)) e.dueDate = 'Enter a valid date (YYYY-MM-DD)';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const reminder = ReminderRepository.makeNew({
        ...initial,
        type,
        dueDate,
        note,
      });

      // Schedule local notification — non-blocking, reminder saves regardless of result
      const { notificationId, permissionStatus } = await scheduleReminderNotification(reminder);
      const finalReminder: Reminder = notificationId
        ? { ...reminder, notificationId }
        : reminder;

      await ReminderRepository.upsertReminder(finalReminder);

      // If permission was explicitly denied, inform operator calmly after saving
      if (permissionStatus === 'denied') {
        Alert.alert(
          'Reminder saved',
          'Notifications are turned off for JobForge. Your reminder is saved and visible in the app — enable notifications in Settings to receive device alerts.',
          [{ text: 'OK' }],
        );
      }

      onSaved(finalReminder);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.sheet}>
          <View style={s.handle} />
          <View style={s.header}>
            <Text style={s.title}>Set a Reminder</Text>
            <TouchableOpacity onPress={onClose}><Text style={s.close}>✕</Text></TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

            {/* Reminder type */}
            <Text style={s.label}>Reminder Type</Text>
            <View style={s.typeGrid}>
              {(Object.keys(REMINDER_TYPE_LABELS) as ReminderType[]).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[s.typeChip, type === t && s.typeChipActive]}
                  onPress={() => setType(t)}
                >
                  <Text style={[s.typeChipTxt, type === t && s.typeChipTxtActive]}>{REMINDER_TYPE_LABELS[t]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Quick date pickers */}
            <Text style={s.label}>Due Date</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.quickScroll}>
              <View style={s.quickRow}>
                {QUICK_DATES.map(q => (
                  <TouchableOpacity
                    key={q.days}
                    style={[s.quickChip, dueDate === addDays(q.days) && s.quickChipActive]}
                    onPress={() => { setDueDate(addDays(q.days)); setErrors(e => ({ ...e, dueDate: '' })); }}
                  >
                    <Text style={[s.quickTxt, dueDate === addDays(q.days) && s.quickTxtActive]}>{q.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <TextInput
              style={[s.input, errors.dueDate && s.inputErr]}
              value={dueDate}
              onChangeText={v => { setDueDate(v); setErrors(e => ({ ...e, dueDate: '' })); }}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={T.muted}
              keyboardType="numbers-and-punctuation"
            />
            {errors.dueDate ? <Text style={s.err}>{errors.dueDate}</Text> : null}

            {/* Note */}
            <Text style={s.label}>Note (optional)</Text>
            <TextInput
              style={[s.input, s.noteInput]}
              value={note}
              onChangeText={setNote}
              placeholder="What needs to happen by this date?"
              placeholderTextColor={T.muted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            {/* If tied to a customer, show it */}
            {initial?.customerName && (
              <View style={s.contextRow}>
                <Text style={s.contextIcon}>👤</Text>
                <Text style={s.contextTxt}>{initial.customerName}</Text>
              </View>
            )}
          </ScrollView>

          <View style={s.footer}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
              <Text style={s.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.saveBtn} onPress={save} disabled={saving}>
              <Text style={s.saveTxt}>{saving ? 'Saving…' : 'Set Reminder'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: T.bg, borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, maxHeight: '85%' },
  handle: { width: 40, height: 4, backgroundColor: T.border, borderRadius: 2, alignSelf: 'center', marginTop: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  title: { color: T.text, fontSize: 18, fontWeight: '700' },
  close: { color: T.sub, fontSize: 18, padding: 4 },
  scroll: { paddingHorizontal: 20, paddingBottom: 10 },
  label: { color: T.textDim, fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 16 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: { borderWidth: 1, borderColor: T.border, borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: T.surface },
  typeChipActive: { borderColor: T.accent, backgroundColor: T.accentLo },
  typeChipTxt: { color: T.sub, fontSize: 13, fontWeight: '500' },
  typeChipTxtActive: { color: T.accent, fontWeight: '700' },
  quickScroll: { marginBottom: 10, marginHorizontal: -4 },
  quickRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 4 },
  quickChip: { borderWidth: 1, borderColor: T.border, borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: T.surface },
  quickChipActive: { borderColor: T.green, backgroundColor: T.greenLo },
  quickTxt: { color: T.sub, fontSize: 13, fontWeight: '500' },
  quickTxtActive: { color: T.green, fontWeight: '700' },
  input: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: radii.md, color: T.text, padding: 12, fontSize: 15 },
  noteInput: { minHeight: 80, paddingTop: 10 },
  inputErr: { borderColor: T.red },
  err: { color: T.red, fontSize: 12, marginTop: 4 },
  contextRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, padding: 10, backgroundColor: T.surface, borderRadius: radii.md, borderWidth: 1, borderColor: T.border },
  contextIcon: { fontSize: 16 },
  contextTxt: { color: T.sub, fontSize: 13 },
  footer: { flexDirection: 'row', gap: 10, padding: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 20, borderTopWidth: 1, borderTopColor: T.border },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: T.border, borderRadius: radii.lg, paddingVertical: 14, alignItems: 'center' },
  cancelTxt: { color: T.sub, fontSize: 15, fontWeight: '600' },
  saveBtn: { flex: 2, backgroundColor: T.accent, borderRadius: radii.lg, paddingVertical: 14, alignItems: 'center' },
  saveTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
