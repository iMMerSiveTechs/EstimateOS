// ─── CommReviewModal ──────────────────────────────────────────────────────────
// Phase 15B: Unified communication review + send modal.
// Supports intent-based template selection, PDF attachment, and routes
// through commProvider.sendUnified() for consistent delivery.
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Modal, ScrollView, Platform, Alert, ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { CommTemplate, CommTemplateType, CommIntent, COMM_INTENT_LABELS } from '../models/types';
import { CommTemplateRepository, fillCommTemplate, CommTemplateVars } from '../storage/commTemplates';
import { sendUnified, CommAction } from '../services/commProvider';
import { T, radii } from '../theme';

export interface CommReviewVars extends CommTemplateVars {}

interface Props {
  visible: boolean;
  /** Communication intent — drives template selection and timeline logging. */
  intent?: CommIntent;
  /** Legacy: pre-select a template type directly. */
  templateType?: CommTemplateType;
  /** Or pass a template directly. */
  template?: CommTemplate;
  vars: CommReviewVars;
  /** Recipient email (pre-filled if available). */
  recipientEmail?: string;
  /** File URIs to attach (e.g. estimate/invoice PDF). */
  attachments?: string[];
  /** Label for the attachment badge shown in the modal. */
  attachmentLabel?: string;
  onClose: () => void;
  /** Called after user sends/shares/copies — marks as sent. */
  onSent?: (action: CommAction) => void;
}

/** Map CommIntent to the CommTemplateType for template lookup. */
function intentToTemplateType(intent: CommIntent): CommTemplateType | undefined {
  switch (intent) {
    case 'estimate_send':        return 'estimate_send';
    case 'invoice_send':         return 'invoice_send';
    case 'follow_up':            return 'estimate_followup';
    case 'appointment_reminder': return 'appointment_reminder';
    case 'payment_reminder':     return 'payment_reminder';
    case 'callback_follow_up':   return 'missed_call';
    default:                     return 'checkin';
  }
}

export function CommReviewModal({
  visible, intent, templateType, template: templateProp, vars,
  recipientEmail, attachments, attachmentLabel,
  onClose, onSent,
}: Props) {
  const [templates, setTemplates] = useState<CommTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [mode, setMode] = useState<'preview' | 'edit'>('preview');
  const [sending, setSending] = useState(false);

  // Resolve template type from intent or prop
  const resolvedType = templateType ?? (intent ? intentToTemplateType(intent) : undefined);

  useEffect(() => {
    if (!visible) return;
    CommTemplateRepository.listTemplates().then(list => {
      setTemplates(list);
      const t = templateProp ?? (resolvedType ? list.find(x => x.type === resolvedType) : list[0]);
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

  const handleAction = async (action: CommAction) => {
    setSending(true);
    try {
      const result = await sendUnified({
        intent: intent ?? 'general',
        action,
        to: recipientEmail,
        subject,
        body,
        attachments,
      });
      if (result.status === 'success') {
        if (action === 'copy') {
          Alert.alert('Copied', 'Message copied to clipboard.');
        }
        onSent?.(action);
        onClose();
      } else {
        Alert.alert('Send Failed', result.message ?? 'Could not complete the action.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Unexpected error.');
    } finally {
      setSending(false);
    }
  };

  const intentLabel = intent ? COMM_INTENT_LABELS[intent] : 'Review Message';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.sheet}>
          <View style={s.handle} />

          {/* Header */}
          <View style={s.header}>
            <Text style={s.title}>{intentLabel}</Text>
            <View style={s.headerRight}>
              <TouchableOpacity onPress={() => setMode(m => m === 'preview' ? 'edit' : 'preview')}>
                <Text style={s.modeToggle}>{mode === 'preview' ? 'Edit' : 'Preview'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose}><Text style={s.close}>✕</Text></TouchableOpacity>
            </View>
          </View>

          {/* Attachment badge */}
          {attachments && attachments.length > 0 && (
            <View style={s.attachBadge}>
              <Text style={s.attachIcon}>📎</Text>
              <Text style={s.attachTxt}>{attachmentLabel ?? 'PDF attached'}</Text>
            </View>
          )}

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
                  <Text style={s.varVal} numberOfLines={1}>{String(v)}</Text>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Send actions */}
          <View style={s.footer}>
            {sending ? (
              <View style={s.sendingWrap}>
                <ActivityIndicator color={T.accent} />
                <Text style={s.sendingTxt}>Sending…</Text>
              </View>
            ) : (
              <>
                <TouchableOpacity style={s.copyBtn} onPress={() => handleAction('copy')}>
                  <Text style={s.copyTxt}>📋 Copy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.shareBtn} onPress={() => handleAction('share')}>
                  <Text style={s.shareTxt}>
                    {attachments && attachments.length > 0 ? '📎 Share PDF' : 'Share →'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.emailBtn} onPress={() => handleAction('email')}>
                  <Text style={s.emailTxt}>✉️ Email</Text>
                </TouchableOpacity>
              </>
            )}
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
  // Attachment badge
  attachBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 20, marginBottom: 8, backgroundColor: T.greenLo, borderRadius: radii.sm, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: T.green, alignSelf: 'flex-start' },
  attachIcon: { fontSize: 14 },
  attachTxt: { color: T.greenHi, fontSize: 12, fontWeight: '600' },
  // Template selector
  templateScroll: { paddingHorizontal: 20, marginBottom: 4 },
  templateRow: { flexDirection: 'row', gap: 8 },
  templateChip: { borderWidth: 1, borderColor: T.border, borderRadius: radii.lg, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: T.surface },
  templateChipActive: { borderColor: T.accent, backgroundColor: T.accentLo },
  templateChipTxt: { color: T.sub, fontSize: 12, fontWeight: '500' },
  templateChipTxtActive: { color: T.accent, fontWeight: '700' },
  // Content
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
  // Footer
  footer: { flexDirection: 'row', gap: 8, padding: 16, paddingBottom: Platform.OS === 'ios' ? 36 : 16, borderTopWidth: 1, borderTopColor: T.border },
  sendingWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13 },
  sendingTxt: { color: T.sub, fontSize: 14 },
  copyBtn: { flex: 1, borderWidth: 1, borderColor: T.border, borderRadius: radii.md, paddingVertical: 13, alignItems: 'center', backgroundColor: T.surface },
  copyTxt: { color: T.text, fontSize: 13, fontWeight: '600' },
  shareBtn: { flex: 2, backgroundColor: T.accent, borderRadius: radii.md, paddingVertical: 13, alignItems: 'center' },
  shareTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },
  emailBtn: { flex: 1, borderWidth: 1, borderColor: T.border, borderRadius: radii.md, paddingVertical: 13, alignItems: 'center', backgroundColor: T.surface },
  emailTxt: { color: T.text, fontSize: 13, fontWeight: '600' },
});
