// ─── CommTemplatesScreen ──────────────────────────────────────────────────────
// Phase 7: Manage communication templates (email/text) with merge fields.
// Edit defaults, add custom templates, preview with merge fields.
import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  SafeAreaView, Alert, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CommTemplate, CommTemplateType, COMM_TEMPLATE_TYPE_LABELS } from '../models/types';
import { CommTemplateRepository, fillCommTemplate, DEFAULT_COMM_TEMPLATES } from '../storage/commTemplates';
import { T, radii } from '../theme';

const MERGE_FIELD_HINT = '{customer_name}  {business_name}  {estimate_number}  {price_range}  {address}';

const PREVIEW_VARS = {
  customer_name: 'Jane Smith',
  business_name: 'Your Company Name',
  estimate_number: 'EST-0042',
  price_range: '$8,500 – $11,200',
  address: '123 Maple St, Austin TX',
};

function TypeBadge({ type }: { type: CommTemplateType }) {
  return (
    <View style={[badge.wrap, { backgroundColor: T.accentLo, borderColor: T.accent + '55' }]}>
      <Text style={badge.txt}>{COMM_TEMPLATE_TYPE_LABELS[type]}</Text>
    </View>
  );
}
const badge = StyleSheet.create({
  wrap: { borderRadius: radii.sm, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, alignSelf: 'flex-start', marginTop: 4 },
  txt: { color: T.accent, fontSize: 11, fontWeight: '600' },
});

export function CommTemplatesScreen({ navigation }: any) {
  const [templates, setTemplates] = useState<CommTemplate[]>([]);
  const [editing, setEditing] = useState<CommTemplate | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const list = await CommTemplateRepository.listTemplates();
    setTemplates(list);
  }, []);
  useFocusEffect(load);

  const openNew = () => {
    setEditing(CommTemplateRepository.makeNew());
    setErrors({});
  };

  const openEdit = (t: CommTemplate) => {
    setEditing({ ...t });
    setErrors({});
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!editing?.name?.trim()) e.name = 'Name required';
    if (!editing?.subject?.trim()) e.subject = 'Subject required';
    if (!editing?.body?.trim()) e.body = 'Body required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!editing || !validate()) return;
    await CommTemplateRepository.upsertTemplate(editing);
    setEditing(null);
    await load();
  };

  const remove = (t: CommTemplate) => {
    if (t.isDefault) {
      Alert.alert('Default Template', 'Reset this template to its original default?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset', style: 'destructive', onPress: async () => {
            const def = DEFAULT_COMM_TEMPLATES.find(d => d.id === t.id);
            if (def) { await CommTemplateRepository.upsertTemplate(def); await load(); }
          },
        },
      ]);
    } else {
      Alert.alert('Delete Template', `Delete "${t.name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => { await CommTemplateRepository.deleteTemplate(t.id); await load(); } },
      ]);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll}>

        <Text style={s.hint}>
          Templates support merge fields:{'\n'}
          <Text style={s.hintCode}>{MERGE_FIELD_HINT}</Text>
        </Text>

        {templates.map(t => (
          <View key={t.id} style={s.card}>
            <View style={s.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.cardName}>{t.name}</Text>
                <TypeBadge type={t.type} />
              </View>
              <View style={s.cardActions}>
                <TouchableOpacity style={s.editBtn} onPress={() => openEdit(t)}>
                  <Text style={s.editBtnTxt}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.moreBtn} onPress={() => remove(t)}>
                  <Text style={s.moreBtnTxt}>{t.isDefault ? 'Reset' : 'Delete'}</Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text style={s.cardSubject} numberOfLines={1}>Subject: {t.subject}</Text>
            <Text style={s.cardBody} numberOfLines={3}>{t.body}</Text>
          </View>
        ))}

        <TouchableOpacity style={s.addBtn} onPress={openNew}>
          <Text style={s.addBtnTxt}>+ Add Custom Template</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Edit modal */}
      <Modal visible={!!editing} animationType="slide" transparent onRequestClose={() => setEditing(null)}>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.sheet}>
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>{editing?.isDefault === false && !DEFAULT_COMM_TEMPLATES.find(d => d.id === editing?.id) ? 'New Template' : 'Edit Template'}</Text>
              <View style={s.sheetHeaderActions}>
                <TouchableOpacity onPress={() => setShowPreview(p => !p)}>
                  <Text style={s.previewToggle}>{showPreview ? 'Edit' : 'Preview'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setEditing(null)}>
                  <Text style={s.closeBtn}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView contentContainerStyle={s.sheetScroll} keyboardShouldPersistTaps="handled">
              {showPreview && editing ? (
                <View style={s.previewWrap}>
                  <Text style={s.previewLabel}>SUBJECT PREVIEW</Text>
                  <Text style={s.previewSubject}>{fillCommTemplate(editing.subject, PREVIEW_VARS)}</Text>
                  <Text style={[s.previewLabel, { marginTop: 16 }]}>BODY PREVIEW</Text>
                  <Text style={s.previewBody}>{fillCommTemplate(editing.body, PREVIEW_VARS)}</Text>
                  <Text style={s.previewNote}>Preview uses sample values for merge fields.</Text>
                </View>
              ) : editing ? (
                <>
                  <Text style={s.fieldLabel}>Template Name *</Text>
                  <TextInput
                    style={[s.input, errors.name && s.inputErr]}
                    value={editing.name}
                    onChangeText={v => { setEditing(e => e ? { ...e, name: v } : e); setErrors(er => ({ ...er, name: '' })); }}
                    placeholder="e.g. Quick Follow-up"
                    placeholderTextColor={T.muted}
                  />
                  {errors.name ? <Text style={s.err}>{errors.name}</Text> : null}

                  <Text style={s.fieldLabel}>Type</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {(Object.keys(COMM_TEMPLATE_TYPE_LABELS) as CommTemplateType[]).map(tp => (
                        <TouchableOpacity
                          key={tp}
                          style={[s.typeChip, editing.type === tp && s.typeChipActive]}
                          onPress={() => setEditing(e => e ? { ...e, type: tp } : e)}
                        >
                          <Text style={[s.typeChipTxt, editing.type === tp && s.typeChipTxtActive]}>
                            {COMM_TEMPLATE_TYPE_LABELS[tp]}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>

                  <Text style={s.fieldLabel}>Subject *</Text>
                  <TextInput
                    style={[s.input, errors.subject && s.inputErr]}
                    value={editing.subject}
                    onChangeText={v => { setEditing(e => e ? { ...e, subject: v } : e); setErrors(er => ({ ...er, subject: '' })); }}
                    placeholder="Email subject…"
                    placeholderTextColor={T.muted}
                  />
                  {errors.subject ? <Text style={s.err}>{errors.subject}</Text> : null}

                  <Text style={s.fieldLabel}>Body *</Text>
                  <Text style={s.mergeHint}>Merge fields: {MERGE_FIELD_HINT}</Text>
                  <TextInput
                    style={[s.input, s.inputBody, errors.body && s.inputErr]}
                    value={editing.body}
                    onChangeText={v => { setEditing(e => e ? { ...e, body: v } : e); setErrors(er => ({ ...er, body: '' })); }}
                    placeholder="Message body…"
                    placeholderTextColor={T.muted}
                    multiline
                    numberOfLines={10}
                    textAlignVertical="top"
                  />
                  {errors.body ? <Text style={s.err}>{errors.body}</Text> : null}
                </>
              ) : null}
            </ScrollView>

            {!showPreview && (
              <View style={s.sheetFooter}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setEditing(null)}>
                  <Text style={s.cancelTxt}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.saveBtn} onPress={save}>
                  <Text style={s.saveTxt}>Save Template</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  scroll: { padding: 20, paddingBottom: 60 },
  hint: { color: T.sub, fontSize: 13, marginBottom: 20, lineHeight: 20, backgroundColor: T.surface, borderRadius: radii.md, padding: 12, borderWidth: 1, borderColor: T.border },
  hintCode: { color: T.accent, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 11 },
  card: { backgroundColor: T.surface, borderRadius: radii.lg, padding: 14, borderWidth: 1, borderColor: T.border, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  cardName: { color: T.text, fontSize: 15, fontWeight: '700' },
  cardActions: { flexDirection: 'row', gap: 8, marginLeft: 8 },
  editBtn: { backgroundColor: T.accentLo, borderRadius: radii.sm, paddingHorizontal: 10, paddingVertical: 5 },
  editBtnTxt: { color: T.accent, fontSize: 12, fontWeight: '600' },
  moreBtn: { backgroundColor: T.surface, borderRadius: radii.sm, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: T.border },
  moreBtnTxt: { color: T.sub, fontSize: 12, fontWeight: '600' },
  cardSubject: { color: T.textDim, fontSize: 12, marginTop: 6, fontStyle: 'italic' },
  cardBody: { color: T.muted, fontSize: 12, marginTop: 4, lineHeight: 17 },
  addBtn: { borderWidth: 1.5, borderColor: T.accent, borderStyle: 'dashed', borderRadius: radii.lg, padding: 16, alignItems: 'center', marginTop: 8 },
  addBtnTxt: { color: T.accent, fontSize: 15, fontWeight: '600' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: T.bg, borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, maxHeight: '92%' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: T.border },
  sheetTitle: { color: T.text, fontSize: 17, fontWeight: '700' },
  sheetHeaderActions: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  previewToggle: { color: T.accent, fontSize: 14, fontWeight: '600' },
  closeBtn: { color: T.sub, fontSize: 18, padding: 4 },
  sheetScroll: { padding: 20 },
  fieldLabel: { color: T.textDim, fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 16 },
  mergeHint: { color: T.muted, fontSize: 11, marginBottom: 6, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  input: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: radii.md, color: T.text, padding: 12, fontSize: 14 },
  inputBody: { minHeight: 200, paddingTop: 10 },
  inputErr: { borderColor: T.red },
  err: { color: T.red, fontSize: 12, marginTop: 4 },
  typeChip: { borderWidth: 1, borderColor: T.border, borderRadius: radii.lg, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: T.surface },
  typeChipActive: { borderColor: T.accent, backgroundColor: T.accentLo },
  typeChipTxt: { color: T.sub, fontSize: 12, fontWeight: '500' },
  typeChipTxtActive: { color: T.accent, fontWeight: '700' },
  previewWrap: { padding: 4 },
  previewLabel: { color: T.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 },
  previewSubject: { color: T.text, fontSize: 15, fontWeight: '600', backgroundColor: T.surface, borderRadius: radii.md, padding: 12, borderWidth: 1, borderColor: T.border },
  previewBody: { color: T.text, fontSize: 14, lineHeight: 22, backgroundColor: T.surface, borderRadius: radii.md, padding: 14, borderWidth: 1, borderColor: T.border },
  previewNote: { color: T.muted, fontSize: 11, marginTop: 12, fontStyle: 'italic', textAlign: 'center' },
  sheetFooter: { flexDirection: 'row', gap: 10, padding: 20, paddingBottom: 40, borderTopWidth: 1, borderTopColor: T.border },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: T.border, borderRadius: radii.lg, paddingVertical: 14, alignItems: 'center' },
  cancelTxt: { color: T.sub, fontSize: 15, fontWeight: '600' },
  saveBtn: { flex: 1, backgroundColor: T.accent, borderRadius: radii.lg, paddingVertical: 14, alignItems: 'center' },
  saveTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
