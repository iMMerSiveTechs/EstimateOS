// ─── FollowUpPanel ────────────────────────────────────────────────────────────
// Phase 6+7: Reusable follow-up status widget for CustomerDetail + EstimateDetail.
// Shows current status, lets operator update it, quick-set next action date/note.
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  TextInput, ScrollView, Platform,
} from 'react-native';
import { FollowUpStatus, FOLLOW_UP_LABELS } from '../models/types';
import { T, radii } from '../theme';

// ─── Status color map (theme-based, not in types.ts) ─────────────────────────
const FU_COLOR: Record<FollowUpStatus, { bg: string; border: string; text: string }> = {
  lead_new:              { bg: T.indigoLo,  border: T.indigo, text: T.indigoHi },
  quote_in_progress:     { bg: T.amberLo,   border: T.amber,  text: T.amberHi },
  quote_sent:            { bg: T.tealLo,    border: T.teal,   text: T.teal },
  follow_up_due:         { bg: T.redLo,     border: T.red,    text: T.red },
  awaiting_customer:     { bg: T.amberLo,   border: T.amber,  text: T.amberHi },
  appointment_scheduled: { bg: T.purpleLo,  border: T.purple, text: T.purple },
  won:                   { bg: T.greenLo,   border: T.green,  text: T.greenHi },
  lost:                  { bg: T.surface,   border: T.border, text: T.sub },
};

const STATUS_ORDER: FollowUpStatus[] = [
  'lead_new',
  'quote_in_progress',
  'quote_sent',
  'follow_up_due',
  'awaiting_customer',
  'appointment_scheduled',
  'won',
  'lost',
];

interface Props {
  status?: FollowUpStatus;
  lastContactAt?: string;
  nextActionAt?: string;
  nextActionNote?: string;
  onStatusChange: (status: FollowUpStatus) => void;
  onNextActionChange: (date: string, note: string) => void;
  onMarkContacted: () => void;
}

export function FollowUpPanel({
  status,
  lastContactAt,
  nextActionAt,
  nextActionNote,
  onStatusChange,
  onNextActionChange,
  onMarkContacted,
}: Props) {
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showNextAction, setShowNextAction] = useState(false);
  const [draftDate, setDraftDate] = useState(nextActionAt?.slice(0, 10) ?? '');
  const [draftNote, setDraftNote] = useState(nextActionNote ?? '');

  const current = status ?? 'lead_new';
  const colors = FU_COLOR[current];

  const isOverdue = nextActionAt && nextActionAt.slice(0, 10) < new Date().toISOString().slice(0, 10);

  return (
    <View style={s.wrap}>
      <View style={s.row}>
        {/* Status badge + tap to change */}
        <TouchableOpacity
          style={[s.badge, { backgroundColor: colors.bg, borderColor: colors.border }]}
          onPress={() => setShowStatusPicker(true)}
        >
          <Text style={[s.badgeTxt, { color: colors.text }]}>{FOLLOW_UP_LABELS[current]}</Text>
          <Text style={[s.badgeChevron, { color: colors.text }]}>▾</Text>
        </TouchableOpacity>

        {/* Quick actions */}
        <TouchableOpacity style={s.contactedBtn} onPress={onMarkContacted}>
          <Text style={s.contactedTxt}>✓ Contacted</Text>
        </TouchableOpacity>
      </View>

      {/* Last contact */}
      {lastContactAt && (
        <Text style={s.meta}>Last contact: {new Date(lastContactAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
      )}

      {/* Next action */}
      <TouchableOpacity style={[s.nextAction, isOverdue && s.nextActionOverdue]} onPress={() => { setDraftDate(nextActionAt?.slice(0, 10) ?? ''); setDraftNote(nextActionNote ?? ''); setShowNextAction(true); }}>
        <View style={{ flex: 1 }}>
          <Text style={s.nextActionLabel}>{nextActionAt ? 'Next Action' : '+ Set Next Action'}</Text>
          {nextActionAt && (
            <Text style={[s.nextActionDate, isOverdue && { color: T.red }]}>
              {new Date(nextActionAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              {isOverdue ? '  ⚠️ Overdue' : ''}
            </Text>
          )}
          {nextActionNote ? <Text style={s.nextActionNote} numberOfLines={1}>{nextActionNote}</Text> : null}
        </View>
        <Text style={s.editHint}>Edit →</Text>
      </TouchableOpacity>

      {/* Status picker modal */}
      <Modal visible={showStatusPicker} transparent animationType="slide" onRequestClose={() => setShowStatusPicker(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setShowStatusPicker(false)}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>Update Status</Text>
            <ScrollView>
              {STATUS_ORDER.map(st => {
                const c = FU_COLOR[st];
                const isCurrent = st === current;
                return (
                  <TouchableOpacity
                    key={st}
                    style={[s.statusRow, isCurrent && { backgroundColor: c.bg }]}
                    onPress={() => { onStatusChange(st); setShowStatusPicker(false); }}
                  >
                    <View style={[s.statusDot, { backgroundColor: c.border }]} />
                    <Text style={[s.statusLabel, { color: isCurrent ? c.text : T.text }]}>{FOLLOW_UP_LABELS[st]}</Text>
                    {isCurrent && <Text style={[s.currentCheck, { color: c.text }]}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Next action modal */}
      <Modal visible={showNextAction} transparent animationType="slide" onRequestClose={() => setShowNextAction(false)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>Set Next Action</Text>
            <Text style={s.fieldLabel}>Date (YYYY-MM-DD)</Text>
            <TextInput
              style={s.input}
              value={draftDate}
              onChangeText={setDraftDate}
              placeholder={new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10)}
              placeholderTextColor={T.muted}
              keyboardType="numbers-and-punctuation"
            />
            <Text style={s.fieldLabel}>Note (optional)</Text>
            <TextInput
              style={[s.input, { minHeight: 80, textAlignVertical: 'top', paddingTop: 10 }]}
              value={draftNote}
              onChangeText={setDraftNote}
              placeholder="Call to check decision, send updated estimate…"
              placeholderTextColor={T.muted}
              multiline
            />
            <View style={s.sheetFooter}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setShowNextAction(false)}>
                <Text style={s.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.saveBtn}
                onPress={() => { onNextActionChange(draftDate, draftNote); setShowNextAction(false); }}
              >
                <Text style={s.saveTxt}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { backgroundColor: T.surface, borderRadius: radii.lg, padding: 14, borderWidth: 1, borderColor: T.border, gap: 10 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1 },
  badgeTxt: { fontSize: 13, fontWeight: '700' },
  badgeChevron: { fontSize: 11, marginTop: 1 },
  contactedBtn: { borderWidth: 1, borderColor: T.green, borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 8 },
  contactedTxt: { color: T.green, fontSize: 13, fontWeight: '600' },
  meta: { color: T.muted, fontSize: 12, marginTop: -4 },
  nextAction: { backgroundColor: T.bg, borderRadius: radii.md, padding: 12, borderWidth: 1, borderColor: T.border, flexDirection: 'row', alignItems: 'center' },
  nextActionOverdue: { borderColor: T.red, backgroundColor: T.redLo },
  nextActionLabel: { color: T.textDim, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  nextActionDate: { color: T.text, fontSize: 14, fontWeight: '600' },
  nextActionNote: { color: T.sub, fontSize: 12, marginTop: 2 },
  editHint: { color: T.sub, fontSize: 13 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: T.bg, borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  sheetTitle: { color: T.text, fontSize: 17, fontWeight: '700', marginBottom: 16 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radii.md, marginBottom: 4 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
  currentCheck: { fontSize: 16, fontWeight: '700' },
  fieldLabel: { color: T.textDim, fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: radii.md, color: T.text, padding: 12, fontSize: 15 },
  sheetFooter: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: T.border, borderRadius: radii.lg, paddingVertical: 13, alignItems: 'center' },
  cancelTxt: { color: T.sub, fontSize: 15, fontWeight: '600' },
  saveBtn: { flex: 1, backgroundColor: T.accent, borderRadius: radii.lg, paddingVertical: 13, alignItems: 'center' },
  saveTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
