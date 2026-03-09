// ─── ReviewSendScreen ─────────────────────────────────────────────────────
// Review an estimate and send via email with PDF attachment.
// Routes through commProvider.sendUnified() for consistent delivery.
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  SafeAreaView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Estimate } from '../models/types';
import { EstimateRepository } from '../storage/repository';
import { getSettings, saveEmailTemplate } from '../storage/settings';
import { sendUnified } from '../services/commProvider';
import { generateEstimatePdf, isPdfAvailable } from '../services/pdfService';
import { TimelineRepository } from '../storage/workflow';
import { T, radii } from '../theme';

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
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Phase 1: load estimate + template — clears loading immediately so screen renders
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

  // Phase 2: generate PDF after screen is visible (doesn't block the loading spinner)
  useEffect(() => {
    if (!estimate) return;
    if (!isPdfAvailable()) return;
    let cancelled = false;
    (async () => {
      setGeneratingPdf(true);
      try {
        const settings = await getSettings();
        if (cancelled) return;
        const result = await generateEstimatePdf(estimate, settings.businessProfile);
        if (cancelled) return;
        if (result.ok) { setPdfUri(result.fileUri); }
        else { setPdfError(result.error); }
      } catch (e: any) {
        if (!cancelled) setPdfError(e?.message ?? 'Could not generate PDF');
      } finally {
        if (!cancelled) setGeneratingPdf(false);
      }
    })();
    return () => { cancelled = true; };
  }, [estimate?.id]); // re-run only if the estimate changes, not on every render

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

      const result = await sendUnified({
        intent: 'estimate_send',
        action: 'email',
        to: emails[0],
        subject,
        body,
        attachments: pdfUri ? [pdfUri] : undefined,
      });

      if (result.status === 'success') {
        // Log timeline event
        if (estimate.customerId) {
          await TimelineRepository.appendEvent({
            customerId: estimate.customerId,
            estimateId: estimate.id,
            type: 'estimate_sent',
            note: `Estimate ${estimate.estimateNumber ?? ''} sent to ${emails.join(', ')}`,
          });
        }
        navigation.goBack();
      } else {
        Alert.alert('Send Issue', result.message ?? 'Could not complete send.');
      }
    } catch (e: any) {
      Alert.alert('Send Failed', e?.message ?? 'Could not send estimate.');
    } finally { setSending(false); }
  };

  const handleShare = async () => {
    if (sending) return;
    setSending(true);
    try {
      await saveEmailTemplate(subject, body);
      const result = await sendUnified({
        intent: 'estimate_send',
        action: 'share',
        subject,
        body,
        attachments: pdfUri ? [pdfUri] : undefined,
      });
      if (result.status === 'success' && estimate.customerId) {
        await TimelineRepository.appendEvent({
          customerId: estimate.customerId,
          estimateId: estimate.id,
          type: 'estimate_sent',
          note: `Estimate ${estimate.estimateNumber ?? ''} shared`,
        });
      }
    } catch (e: any) {
      Alert.alert('Share Failed', e?.message ?? 'Could not open share sheet.');
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

          {/* PDF status badge */}
          {generatingPdf && (
            <View style={s.pdfBadge}>
              <ActivityIndicator size="small" color={T.accent} />
              <Text style={s.pdfBadgeTxt}>Generating PDF…</Text>
            </View>
          )}
          {pdfUri && !generatingPdf && (
            <View style={[s.pdfBadge, { backgroundColor: T.greenLo, borderColor: T.green }]}>
              <Text style={[s.pdfBadgeTxt, { color: T.greenHi }]}>📎 PDF ready — will be attached to email</Text>
            </View>
          )}
          {pdfError && !generatingPdf && (
            <View style={[s.pdfBadge, { backgroundColor: T.amberLo, borderColor: T.amber }]}>
              <Text style={[s.pdfBadgeTxt, { color: T.amberHi }]}>PDF not available — estimate text will be sent instead</Text>
            </View>
          )}

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

          {/* Send + Share buttons */}
          <TouchableOpacity style={s.sendBtn} onPress={handleSend} disabled={sending}>
            {sending ? <ActivityIndicator color="#fff" /> : (
              <Text style={s.sendBtnTxt}>{pdfUri ? '📎 Send with PDF' : '📤 Send via Email'}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={[s.shareSecondaryBtn, sending && { opacity: 0.5 }]} onPress={handleShare} disabled={sending}>
            <Text style={s.shareSecondaryTxt}>{pdfUri ? '📄 Share PDF' : '📤 Share via Share Sheet'}</Text>
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
  summaryCard: { backgroundColor: T.surface, borderRadius: radii.lg, padding: 20, borderWidth: 1, borderColor: T.border, marginBottom: 16, alignItems: 'center' },
  summaryLabel: { color: T.sub, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 },
  summaryName: { color: T.text, fontSize: 22, fontWeight: '700' },
  summaryNum: { color: T.sub, fontSize: 12, marginTop: 4 },
  summaryRange: { color: T.green, fontSize: 24, fontWeight: '800', marginTop: 8 },
  // PDF badge
  pdfBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.surface, borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: T.border, marginBottom: 16 },
  pdfBadgeTxt: { color: T.sub, fontSize: 12, fontWeight: '500' },
  // Form
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
  sendBtn: { backgroundColor: T.accent, borderRadius: radii.lg, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  sendBtnTxt: { color: '#fff', fontSize: 17, fontWeight: '800' },
  shareSecondaryBtn: { borderWidth: 1, borderColor: T.border, borderRadius: radii.lg, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  shareSecondaryTxt: { color: T.text, fontSize: 15, fontWeight: '600' },
});
