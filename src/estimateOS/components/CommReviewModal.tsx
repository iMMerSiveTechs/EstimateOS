// ─── CommReviewModal ──────────────────────────────────────────────────────────
// Phase 7: Review communication template before sending.
// Shows filled preview, lets operator edit subject/body, then Copy or Share.
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Modal, ScrollView, Platform, Share, Clipboard, Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { CommTemplate, CommTemplateType, COMM_TEMPLATE_TYPE_LABELS } from '../models/types';
import { CommTemplateRepository, fillCommTemplate } from '../storage/commTemplates';
import { T, radii } from '../theme';

export interface CommReviewVars {
  customer_name?: string;
  business_name?: string;
  estimate_number?: string;
  price_range?: string;
  address?: string;
}

interface Props {
  visible: boolean;
  templateType?: CommTemplateType;    // pre-select a template type
  template?: CommTemplate;            // or pass directly
  vars: CommReviewVars;
  onClose: () => void;
  onSent?: () => void;                // callback after user copies/shares (marks as sent)
}

export function CommReviewModal({ visible, templateType, template: templateProp, vars, onClose, onSent }: Props) {
  const [templates, setTemplates] = useState<CommTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [mode, setMode] = useState<'preview' | 'edit'>('preview');

  useEffect(() => {
    if (!visible) return;
    CommTemplateRepository.listTemplates().then(list => {
      setTemplates(list);
      const t = templateProp ?? (templateType ? list.find(x => x.type === templateType) : list[0]);
      if (t) applyTemplate(t, vars);
    });
  }, [visible]);

  const applyTemplate = (t: CommTemplate, v: CommReviewVars) => {
    setSelectedId(t.id);
    setSubject(fillCommTemplate(t.subject, v));
    setBody(fillCommTemplate(t.body, v));
  };

  const handleSelectTemplate = (t: CommTemplate) => {
    applyTemplate(t, vars);
  };

  const copyToClipboard = () => {
    const full = `${subject}\n\n${body}`;
    Clipboard.setString(full);
    Alert.alert('Copied', 'Message copied to clipboard.');
    onSent?.();
    onClose();
  };

  const shareMessage = async () => {
    try {
      await Share.share({
        title: subject,
        message: body,
      });
      onSent?.();
    } catch { /* user cancelled */ }
  };

  const shareEmail = async () => {
    const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    try {
      await Share.share({ url: mailto, message: body, title: subject });
      onSent?.();
    } catch { /* user cancelled */ }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.sheet}>
          <View style={s.handle} />

          {/* Header */}
          <View style={s.header}>
            <Text style={s.title}>Review Message</Text>
            <View style={s.headerRight}>
              <TouchableOpacity onPress={() => setMode(m => m === 'preview' ? 'edit' : 'preview')}>
                <Text style={s.modeToggle}>{mode === 'preview' ? 'Edit' : 'Preview'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose}><Text style={s.close}>✕</Text></TouchableOpacity>
            </View>
          </View>

          {/* Template selector */}
          {templates.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.templateScroll}>
              <View style={s.templateRow}>
                {templates.map(t => (
                  <TouchableOpacity
                    key={t.id}
                    style={[s.templateChip, selectedId === t.id && s.templateChipActive]}
                    onPress={() => handleSelectTemplate(t)}
                  >
                    <Text style={[s.templateChipTxt, selectedId === t.id && s.templateChipTxtActive]}>
                      {t.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}

          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

            {/* Subject */}
            <Text style={s.fieldLabel}>Subject</Text>
            {mode === 'edit' ? (
              <TextInput
                style={s.input}
                value={subject}
                onChangeText={setSubject}
                placeholder="Subject…"
                placeholderTextColor={T.muted}
              />
            ) : (
              <View style={s.previewField}>
                <Text style={s.previewSubject}>{subject}</Text>
              </View>
            )}

            {/* Body */}
            <Text style={s.fieldLabel}>Message</Text>
            {mode === 'edit' ? (
              <TextInput
                style={[s.input, s.bodyInput]}
                value={body}
                onChangeText={setBody}
                placeholder="Message body…"
                placeholderTextColor={T.muted}
                multiline
                textAlignVertical="top"
              />
            ) : (
              <View style={s.previewField}>
                <Text style={s.previewBody}>{body}</Text>
              </View>
            )}

            {/* Vars used */}
            <View style={s.varsRow}>
              {Object.entries(vars).filter(([, v]) => v).map(([k, v]) => (
                <View key={k} style={s.varChip}>
                  <Text style={s.varKey}>{k.replace(/_/g, ' ')}:</Text>
                  <Text style={s.varVal} numberOfLines={1}>{v}</Text>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Send actions */}
          <View style={s.footer}>
            <TouchableOpacity style={s.copyBtn} onPress={copyToClipboard}>
              <Text style={s.copyTxt}>📋 Copy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.shareBtn} onPress={shareMessage}>
              <Text style={s.shareTxt}>Share / Text →</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.emailBtn} onPress={shareEmail}>
              <Text style={s.emailTxt}>✉️ Email</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: T.bg, borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, maxHeight: '92%' },
  handle: { width: 40, height: 4, backgroundColor: T.border, borderRadius: 2, alignSelf: 'center', marginTop: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  title: { color: T.text, fontSize: 18, fontWeight: '700' },
  headerRight: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  modeToggle: { color: T.accent, fontSize: 14, fontWeight: '600' },
  close: { color: T.sub, fontSize: 18, padding: 4 },
  templateScroll: { paddingHorizontal: 20, marginBottom: 4 },
  templateRow: { flexDirection: 'row', gap: 8 },
  templateChip: { borderWidth: 1, borderColor: T.border, borderRadius: radii.lg, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: T.surface },
  templateChipActive: { borderColor: T.accent, backgroundColor: T.accentLo },
  templateChipTxt: { color: T.sub, fontSize: 12, fontWeight: '500' },
  templateChipTxtActive: { color: T.accent, fontWeight: '700' },
  scroll: { paddingHorizontal: 20, paddingBottom: 10 },
  fieldLabel: { color: T.textDim, fontSize: 12, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6, marginTop: 16 },
  input: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: radii.md, color: T.text, padding: 12, fontSize: 14 },
  bodyInput: { minHeight: 200, paddingTop: 10 },
  previewField: { backgroundColor: T.surface, borderRadius: radii.md, padding: 14, borderWidth: 1, borderColor: T.border },
  previewSubject: { color: T.text, fontSize: 15, fontWeight: '600' },
  previewBody: { color: T.text, fontSize: 14, lineHeight: 22 },
  varsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 16 },
  varChip: { flexDirection: 'row', gap: 4, backgroundColor: T.surface, borderRadius: radii.sm, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: T.border, maxWidth: 200 },
  varKey: { color: T.muted, fontSize: 11 },
  varVal: { color: T.sub, fontSize: 11, flex: 1 },
  footer: { flexDirection: 'row', gap: 8, padding: 16, paddingBottom: Platform.OS === 'ios' ? 36 : 16, borderTopWidth: 1, borderTopColor: T.border },
  copyBtn: { flex: 1, borderWidth: 1, borderColor: T.border, borderRadius: radii.md, paddingVertical: 13, alignItems: 'center', backgroundColor: T.surface },
  copyTxt: { color: T.text, fontSize: 13, fontWeight: '600' },
  shareBtn: { flex: 2, backgroundColor: T.accent, borderRadius: radii.md, paddingVertical: 13, alignItems: 'center' },
  shareTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },
  emailBtn: { flex: 1, borderWidth: 1, borderColor: T.border, borderRadius: radii.md, paddingVertical: 13, alignItems: 'center', backgroundColor: T.surface },
  emailTxt: { color: T.text, fontSize: 13, fontWeight: '600' },
});
