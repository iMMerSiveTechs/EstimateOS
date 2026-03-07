// ─── ReviewSendScreen ─────────────────────────────────────────────────────
// Review an estimate and send via native email composer.
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  SafeAreaView, ActivityIndicator, Alert, Share, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Estimate } from '../models/types';
import { EstimateRepository } from '../storage/repository';
import { getSettings, saveEmailTemplate } from '../storage/settings';
import { T, radii } from '../theme';

// Try to use expo-mail-composer if available, fallback to Share
let MailComposer: any = null;
try { MailComposer = require('expo-mail-composer'); } catch {}

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

export function ReviewSendScreen({ route, navigation }: any) {
  const { estimateId } = route?.params ?? {};
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [recipients, setRecipients] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [editingTemplate, setEditingTemplate] = useState(false);
  const [recipientErr, setRecipientErr] = useState('');

  useEffect(() => {
    if (!estimateId) return;
    (async () => {
      setLoading(true);
      try {
        const [est, settings] = await Promise.all([
          EstimateRepository.getEstimate(estimateId),
          getSettings(),
        ]);
        setEstimate(est);
        if (est) {
          const vars: Record<string, string> = {
            customer_name:   est.customer.name,
            address:         est.customer.address ?? '',
            estimate_number: est.estimateNumber ?? 'N/A',
            service_name:    est.serviceId,
            vertical_name:   est.verticalId,
            price_min:       `$${(est.computedRange?.min ?? 0).toLocaleString('en-US')}`,
            price_max:       `$${(est.computedRange?.max ?? 0).toLocaleString('en-US')}`,
            business_name:   settings.businessProfile.businessName || 'EstimateOS',
          };
          if (est.customer.email) setRecipients(est.customer.email);
          setSubject(fillTemplate(settings.emailTemplate.subject, vars));
          setBody(fillTemplate(settings.emailTemplate.body, vars));
        }
      } finally { setLoading(false); }
    })();
  }, [estimateId]);

  if (loading) return <SafeAreaView style={s.safe}><ActivityIndicator style={{ marginTop: 60 }} color={T.accent} /></SafeAreaView>;
  if (!estimate) return <SafeAreaView style={s.safe}><Text style={s.notFound}>Estimate not found.</Text></SafeAreaView>;

  const parseEmails = (raw: string) =>
    raw.split(',').map(e => e.trim()).filter(e => e.includes('@'));

  const handleSend = async () => {
    const emails = parseEmails(recipients);
    if (emails.length === 0) { setRecipientErr('Enter at least one valid email'); return; }

    setSending(true);
    try {
      // Save email template for next time
      await saveEmailTemplate(subject, body);

      if (MailComposer && (await MailComposer.isAvailableAsync())) {
        await MailComposer.composeAsync({
          recipients: emails,
          subject,
          body,
          // attachments: [] — PDF attachment goes here in Phase 2 when expo-print is wired
        });
      } else {
        // Fallback: native share sheet
        await Share.share({
          title: subject,
          message: `To: ${emails.join(', ')}\nSubject: ${subject}\n\n${body}`,
        });
      }
    } catch (e: any) {
      Alert.alert('Send Failed', e?.message ?? 'Could not open mail composer.');
    } finally { setSending(false); }
  };

  const { computedRange: range } = estimate;

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          {/* Estimate summary card */}
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>ESTIMATE SUMMARY</Text>
            <Text style={s.summaryName}>{estimate.customer.name}</Text>
            {estimate.estimateNumber && <Text style={s.summaryNum}>{estimate.estimateNumber}</Text>}
            <Text style={s.summaryRange}>
              ${(range?.min ?? 0).toLocaleString('en-US')} – ${(range?.max ?? 0).toLocaleString('en-US')}
            </Text>
          </View>

          {/* Recipients */}
          <Text style={s.fieldLabel}>To</Text>
          <TextInput
            style={[s.input, recipientErr ? s.inputErr : null]}
            value={recipients}
            onChangeText={t => { setRecipients(t); setRecipientErr(''); }}
            placeholder="email@example.com, another@example.com"
            placeholderTextColor={T.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {recipientErr ? <Text style={s.err}>{recipientErr}</Text> : null}
          <Text style={s.hint}>Separate multiple emails with commas</Text>

          {/* Template toggle */}
          <View style={s.templateHeader}>
            <Text style={s.fieldLabel}>Email Template</Text>
            <TouchableOpacity onPress={() => setEditingTemplate(e => !e)}>
              <Text style={s.templateToggle}>{editingTemplate ? 'Done' : 'Customize'}</Text>
            </TouchableOpacity>
          </View>

          {editingTemplate ? (
            <>
              <Text style={s.subLabel}>Subject</Text>
              <TextInput style={s.input} value={subject} onChangeText={setSubject} placeholder="Subject…" placeholderTextColor={T.muted} />
              <Text style={s.subLabel}>Body</Text>
              <TextInput
                style={[s.input, s.inputMulti]}
                value={body} onChangeText={setBody}
                placeholder="Body…" placeholderTextColor={T.muted}
                multiline textAlignVertical="top"
              />
              <Text style={s.hint}>
                Available variables: {`{customer_name}, {address}, {estimate_number}, {price_min}, {price_max}, {business_name}`}
              </Text>
            </>
          ) : (
            <View style={s.previewCard}>
              <Text style={s.previewSubject}>{subject}</Text>
              <Text style={s.previewBody} numberOfLines={6}>{body}</Text>
            </View>
          )}

          {/* Note about PDF */}
          <View style={s.noteCard}>
            <Text style={s.noteTxt}>
              📎 PDF attachment — coming in a future update. For now, the estimate text is included in the email body.
            </Text>
          </View>

          {/* Send button */}
          <TouchableOpacity style={s.sendBtn} onPress={handleSend} disabled={sending}>
            {sending ? <ActivityIndicator color="#fff" /> : <Text style={s.sendBtnTxt}>📤 Send via Email</Text>}
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  scroll: { padding: 20, paddingBottom: 60 },
  notFound: { color: T.sub, fontSize: 16, textAlign: 'center', marginTop: 60 },
  summaryCard: { backgroundColor: T.surface, borderRadius: radii.lg, padding: 16, borderWidth: 1, borderColor: T.border, marginBottom: 24, alignItems: 'center' },
  summaryLabel: { color: T.sub, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 },
  summaryName: { color: T.text, fontSize: 20, fontWeight: '700' },
  summaryNum: { color: T.sub, fontSize: 12, marginTop: 4 },
  summaryRange: { color: T.accent, fontSize: 22, fontWeight: '800', marginTop: 6 },
  fieldLabel: { color: T.textDim, fontSize: 13, fontWeight: '700', marginBottom: 6 },
  subLabel: { color: T.sub, fontSize: 12, marginBottom: 4, marginTop: 12 },
  input: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: radii.md, color: T.text, padding: 12, fontSize: 15, marginBottom: 4 },
  inputMulti: { minHeight: 160, paddingTop: 12, textAlignVertical: 'top' },
  inputErr: { borderColor: T.red },
  err: { color: T.red, fontSize: 12, marginBottom: 4 },
  hint: { color: T.muted, fontSize: 12, marginBottom: 16, lineHeight: 17 },
  templateHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 6 },
  templateToggle: { color: T.accent, fontSize: 14, fontWeight: '600' },
  previewCard: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: radii.md, padding: 14, marginBottom: 16 },
  previewSubject: { color: T.text, fontSize: 14, fontWeight: '700', marginBottom: 8 },
  previewBody: { color: T.sub, fontSize: 13, lineHeight: 19 },
  noteCard: { backgroundColor: T.amberLo, borderRadius: radii.md, padding: 12, borderWidth: 1, borderColor: T.amber, marginBottom: 20 },
  noteTxt: { color: T.amberHi, fontSize: 12, lineHeight: 18 },
  sendBtn: { backgroundColor: T.accent, borderRadius: radii.lg, paddingVertical: 16, alignItems: 'center' },
  sendBtnTxt: { color: '#fff', fontSize: 17, fontWeight: '800' },
});
