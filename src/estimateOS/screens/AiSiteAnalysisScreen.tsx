/**
 * AiSiteAnalysisScreen.tsx — Phase 0 + Phase 1
 *
 * Phase 0: DemoModal (no billing, no history writes)
 * Phase 1: Production MediaGrid via MediaJobQueue
 *
 * Route params: { estimateId?: string; verticalId?: string; serviceId?: string }
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  SafeAreaView, Alert, TextInput, Modal, Animated,
  KeyboardAvoidingView, Platform, Dimensions, Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  getCredits, getAnalysisHistory,
  CreditBalance, AiAnalysisRecord, SuggestedAdjustment,
} from '../storage/aiCredits';
import { appendAiHistory, AiScanRecord, EvidenceEntry } from '../storage/aiHistory';
import { EstimateRepository } from '../storage/repository';
import { makeId } from '../domain/id';
import { ALL_VERTICALS } from '../config/verticals';
import { loadCustomVerticals, mergeVerticals } from '../storage/customVerticals';
import { VerticalConfig } from '../models/types';
import { T as TH, AI_D, radii } from '../theme';
import { MediaGrid } from '../media/MediaGrid';
import { MediaJob, getJobs, clearJobs } from '../media/MediaJobQueue';

const { width: SW } = Dimensions.get('window');

// ─── Design tokens ────────────────────────────────────────────────────────────
const D = {
  bg:       AI_D.bg,
  surface:  AI_D.surface,
  card:     AI_D.card,
  cardHi:   AI_D.cardHi,
  border:   AI_D.border,
  borderHi: AI_D.borderHi,
  border2:  AI_D.border2,
  accent:   TH.indigo,
  accentLo: TH.indigoLo,
  accentHi: TH.indigoHi,
  teal:     TH.teal,
  tealLo:   TH.tealLo,
  tealHi:   TH.tealHi,
  green:    TH.green,
  greenLo:  TH.greenLo,
  greenHi:  TH.greenHi,
  amber:    TH.amber,
  amberLo:  TH.amberLo,
  amberHi:  TH.amberHi,
  red:      TH.red,
  redLo:    TH.redLo,
  purple:   TH.purple,
  purpleLo: TH.purpleLo,
  text:     TH.text,
  textDim:  TH.textDim,
  sub:      TH.sub,
  muted:    TH.muted,
};

// ─── Focus presets ────────────────────────────────────────────────────────────
const FOCUS_PRESETS = [
  { label: 'Roof Pitch',    icon: '📐', prompt: 'Focus on roof pitch and slope angle' },
  { label: 'Measure Area',  icon: '📏', prompt: 'Estimate the square footage of this area' },
  { label: 'Material Type', icon: '🧱', prompt: 'Identify the material type and condition' },
  { label: 'Damage/Wear',   icon: '🔍', prompt: 'Identify damage, wear, or deterioration' },
  { label: 'Access Points', icon: '🚪', prompt: 'Assess access difficulty and entry points' },
  { label: 'Story Count',   icon: '🏢', prompt: 'Count the number of stories or levels' },
  { label: 'Scope Estimate',icon: '📊', prompt: 'Give an overall scope and complexity rating' },
  { label: 'Safety Hazards',icon: '⚠️', prompt: 'Identify safety concerns or special precautions' },
];

// ─── Phase 0: Demo Modal ──────────────────────────────────────────────────────
function DemoModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={dm.overlay}>
        <View style={dm.sheet}>
          <Text style={dm.title}>AI Analysis (Demo)</Text>
          <Text style={dm.body}>AI is not connected in this build.</Text>
          <Text style={dm.hint}>
            Media was accepted and queued. Analysis will run when the AI backend is enabled.
          </Text>
          <TouchableOpacity style={dm.btn} onPress={onClose}>
            <Text style={dm.btnTxt}>Exit</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
const dm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  sheet:   { backgroundColor: D.surface, borderRadius: radii.xxl, padding: 24, width: '100%', borderWidth: 1, borderColor: D.border },
  title:   { color: D.text, fontSize: 18, fontWeight: '800', marginBottom: 10, textAlign: 'center' },
  body:    { color: D.textDim, fontSize: 15, textAlign: 'center', marginBottom: 8 },
  hint:    { color: D.sub, fontSize: 12, textAlign: 'center', lineHeight: 17, marginBottom: 20 },
  btn:     { backgroundColor: D.accent, borderRadius: radii.lg, paddingVertical: 12, alignItems: 'center' },
  btnTxt:  { color: '#fff', fontWeight: '700', fontSize: 15 },
});

// ─── Confidence components ────────────────────────────────────────────────────
function ConfBar({ score, level }: { score?: number; level: 'high' | 'medium' | 'low' }) {
  const numericScore = score ?? (level === 'high' ? 0.85 : level === 'medium' ? 0.55 : 0.25);
  const color = level === 'high' ? D.green : level === 'medium' ? D.amber : D.sub;
  return (
    <View style={cfb.wrap}>
      <View style={cfb.track}>
        <View style={[cfb.bar, { width: `${Math.round(numericScore * 100)}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={[cfb.label, { color }]}>{Math.round(numericScore * 100)}%</Text>
    </View>
  );
}
function ConfBadge({ level }: { level: 'high' | 'medium' | 'low' }) {
  const conf = {
    high:   { color: D.green,  bg: D.greenLo,  label: 'High' },
    medium: { color: D.amber,  bg: D.amberLo,  label: 'Medium' },
    low:    { color: D.sub,    bg: D.muted,     label: 'Low' },
  }[level];
  return (
    <View style={[cb.badge, { backgroundColor: conf.bg, borderColor: conf.color }]}>
      <Text style={[cb.txt, { color: conf.color }]}>{conf.label}</Text>
    </View>
  );
}
const cfb = StyleSheet.create({
  wrap:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, marginBottom: 4 },
  track: { flex: 1, height: 4, backgroundColor: D.border, borderRadius: 2, overflow: 'hidden' },
  bar:   { height: '100%', borderRadius: 2 },
  label: { fontSize: 11, fontWeight: '700', minWidth: 32, textAlign: 'right' },
});
const cb = StyleSheet.create({
  badge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1 },
  txt:   { fontSize: 10, fontWeight: '700' },
});

// ─── BBox overlay ─────────────────────────────────────────────────────────────
function BBoxOverlay({ uri, bbox, label }: {
  uri: string;
  bbox?: [number, number, number, number];
  label?: string;
}) {
  const [imgSize, setImgSize] = useState<{ width: number; height: number } | null>(null);
  const thumbW = (SW - 80) / 2;
  if (!uri) return null;
  if (!bbox || bbox.length !== 4) {
    return (
      <View style={bbo.fallback}>
        <Text style={bbo.fallbackTxt}>📍 Highlighted region in photo #{label}</Text>
      </View>
    );
  }
  let renderedRect: { x: number; y: number; w: number; h: number } | null = null;
  if (imgSize && imgSize.width > 0 && imgSize.height > 0) {
    const scale = Math.min(thumbW / imgSize.width, thumbW / imgSize.height);
    const rw = imgSize.width * scale;
    const rh = imgSize.height * scale;
    renderedRect = { x: (thumbW - rw) / 2, y: (thumbW - rh) / 2, w: rw, h: rh };
  }
  const [ymin, xmin, ymax, xmax] = bbox;
  return (
    <View style={[bbo.container, { width: thumbW, height: thumbW }]}>
      <Image
        source={{ uri }}
        style={bbo.img}
        resizeMode="contain"
        onLoad={e => {
          const { width, height } = e.nativeEvent.source;
          if (width > 0 && height > 0) setImgSize({ width, height });
        }}
      />
      {renderedRect ? (
        <View style={[bbo.box, {
          left:   renderedRect.x + (xmin / 1000) * renderedRect.w,
          top:    renderedRect.y + (ymin / 1000) * renderedRect.h,
          width:  ((xmax - xmin) / 1000) * renderedRect.w,
          height: ((ymax - ymin) / 1000) * renderedRect.h,
        }]} />
      ) : !imgSize && (
        <View style={bbo.overlay}><Text style={bbo.overlayTxt}>📍 {label}</Text></View>
      )}
    </View>
  );
}
const bbo = StyleSheet.create({
  container:   { borderRadius: 10, overflow: 'hidden', position: 'relative', marginTop: 8, backgroundColor: D.surface },
  img:         { width: '100%', height: '100%' },
  box:         { position: 'absolute', borderWidth: 2, borderColor: '#f59e0b', borderRadius: 3, backgroundColor: 'rgba(245,158,11,0.15)' },
  overlay:     { position: 'absolute', bottom: 6, left: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 6, padding: 6, alignItems: 'center' },
  overlayTxt:  { color: '#fff', fontSize: 11 },
  fallback:    { backgroundColor: D.amberLo, borderRadius: 8, padding: 10, marginTop: 8, borderWidth: 1, borderColor: D.amber },
  fallbackTxt: { color: D.amberHi, fontSize: 12 },
});

// ─── Analysis progress ────────────────────────────────────────────────────────
function AnalysisProgress({ phase }: { phase: string }) {
  const bar = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bar, { toValue: 1, duration: 1800, useNativeDriver: false }),
        Animated.timing(bar, { toValue: 0, duration: 0,    useNativeDriver: false }),
      ])
    ).start();
  }, []);
  const width = bar.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View style={ap.wrap}>
      <View style={ap.track}><Animated.View style={[ap.bar, { width }]} /></View>
      <Text style={ap.phase}>{phase}</Text>
    </View>
  );
}
const ap = StyleSheet.create({
  wrap:  { padding: 24, alignItems: 'center', gap: 12 },
  track: { width: '100%', height: 4, backgroundColor: D.border, borderRadius: 2, overflow: 'hidden' },
  bar:   { height: '100%', backgroundColor: D.accent, borderRadius: 2 },
  phase: { color: D.textDim, fontSize: 14 },
});

// ─── Simulated AI result (demo only) ─────────────────────────────────────────
const ANALYSIS_PHASES = [
  'Uploading media…',
  'Detecting objects and surfaces…',
  'Measuring dimensions…',
  'Assessing condition…',
  'Generating pricing insights…',
  'Finalizing report…',
];

function buildSimulatedResult(
  jobs: MediaJob[],
  focusPrompt: string,
  vertical?: VerticalConfig,
): AiAnalysisRecord {
  const isRoofing  = vertical?.id?.includes('roof') ?? false;
  const photoCount = jobs.filter(j => j.kind === 'photo').length;
  const hasVideo   = jobs.some(j => j.kind === 'video');
  const focusLower = focusPrompt.toLowerCase();

  const suggestions: SuggestedAdjustment[] = isRoofing ? [
    {
      label: 'Roof pitch detected: steep (8–12/12)', questionId: 'roof_pitch', suggestedValue: 'steep (8–12/12)',
      confidence: focusLower.includes('pitch') ? 'high' : 'medium', confidenceScore: focusLower.includes('pitch') ? 0.91 : 0.67,
      note: 'Identified from angle of ridge and fascia', evidence: 'Ridge line angle measured against vertical reference.',
      mediaIndex: 0, boundingBox: [80, 100, 350, 900],
    },
    {
      label: 'Roof size estimate: large (25–40 squares)', questionId: 'roof_size', suggestedValue: 'large (25–40 sq)',
      confidence: hasVideo ? 'high' : 'medium', confidenceScore: hasVideo ? 0.88 : 0.61,
      note: hasVideo ? 'Measured from video pan' : `Estimated from ${photoCount} photos`,
      evidence: 'Surface area computed by comparing roof span to door reference widths.',
      mediaIndex: hasVideo ? undefined : 1,
    },
    {
      label: '2-story structure visible', questionId: 'stories', suggestedValue: '2',
      confidence: 'high', confidenceScore: 0.95,
      note: 'Confirmed by roofline height and window count', evidence: 'Two distinct floor levels on exterior facade.',
      mediaIndex: 0, boundingBox: [0, 0, 600, 1000],
    },
    {
      label: 'Shingle wear: moderate — replacement candidate',
      confidence: focusLower.includes('damage') ? 'high' : 'medium',
      confidenceScore: focusLower.includes('damage') ? 0.82 : 0.54,
      note: 'Granule loss and edge curling visible', evidence: 'Granule accumulation in gutters and curled tab edges detected.',
      mediaIndex: photoCount > 1 ? 1 : 0, boundingBox: [400, 50, 750, 500],
    },
  ] : [
    { label: 'Site accessible — standard equipment sufficient', confidence: 'high', confidenceScore: 0.90, note: 'No visible access barriers', evidence: 'Driveway and entry path clearly visible.' },
    { label: 'Job scope: medium complexity', confidence: 'medium', confidenceScore: 0.60, note: `Based on ${photoCount} photos`, evidence: 'Multiple work surfaces visible.' },
  ];

  const summary = [
    `Analyzed ${jobs.length} item${jobs.length === 1 ? '' : 's'} (${photoCount} photo${photoCount !== 1 ? 's' : ''}${hasVideo ? ', 1 video' : ''}).`,
    focusPrompt ? `Focus: "${focusPrompt}".` : '',
    vertical ? `Context: ${vertical.icon} ${vertical.name}.` : '',
    `${suggestions.length} observations — ${suggestions.filter(s => s.confidence === 'high').length} high-confidence.`,
  ].filter(Boolean).join(' ');

  return {
    id: makeId(),
    imageCount: jobs.length,
    focusPrompt: focusPrompt || undefined,
    verticalId: vertical?.id,
    summary,
    suggestedAdjustments: suggestions,
    creditsUsed: 0, // Phase 0: no billing
    createdAt: new Date().toISOString(),
  };
}

// ─── History item ─────────────────────────────────────────────────────────────
function HistoryItem({ record, onView }: { record: AiAnalysisRecord; onView: () => void }) {
  const date = new Date(record.createdAt);
  return (
    <TouchableOpacity style={hi.card} onPress={onView} activeOpacity={0.75}>
      <View style={hi.header}>
        <Text style={hi.date}>{date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
        <View style={hi.meta}>
          <Text style={hi.metaTxt}>📸 {record.imageCount}</Text>
          <Text style={hi.metaTxt}>{record.suggestedAdjustments.length} insights</Text>
        </View>
      </View>
      {record.focusPrompt && <Text style={hi.focus} numberOfLines={1}>🎯 {record.focusPrompt}</Text>}
      <Text style={hi.summary} numberOfLines={2}>{record.summary}</Text>
    </TouchableOpacity>
  );
}
const hi = StyleSheet.create({
  card:   { backgroundColor: D.card, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: D.border },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  date:   { color: D.sub, fontSize: 12 },
  meta:   { flexDirection: 'row', gap: 8 },
  metaTxt:{ color: D.textDim, fontSize: 11 },
  focus:  { color: D.accentHi, fontSize: 12, marginBottom: 4 },
  summary:{ color: D.sub, fontSize: 12, lineHeight: 17 },
});

// ─── Result Modal ─────────────────────────────────────────────────────────────
function ResultModal({ record, jobs, visible, onClose, onApply }: {
  record: AiAnalysisRecord | null;
  jobs: MediaJob[];
  visible: boolean;
  onClose: () => void;
  onApply?: (record: AiAnalysisRecord) => void;
}) {
  if (!record) return null;
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={rm.safe}>
        <View style={rm.header}>
          <TouchableOpacity onPress={onClose}><Text style={rm.close}>Done</Text></TouchableOpacity>
          <Text style={rm.title}>AI Analysis Report</Text>
          <View style={{ width: 50 }} />
        </View>
        <ScrollView contentContainerStyle={rm.scroll}>
          <View style={rm.summaryCard}>
            <View style={rm.summaryHeader}>
              <Text style={rm.summaryIcon}>🤖</Text>
              <View style={{ flex: 1 }}>
                <Text style={rm.summaryTitle}>Analysis Complete</Text>
                <Text style={rm.summaryDate}>{new Date(record.createdAt).toLocaleString()}</Text>
              </View>
            </View>
            {record.focusPrompt && (
              <View style={rm.focusBadge}>
                <Text style={rm.focusBadgeIcon}>🎯</Text>
                <Text style={rm.focusBadgeTxt}>{record.focusPrompt}</Text>
              </View>
            )}
            <Text style={rm.summaryTxt}>{record.summary}</Text>
          </View>

          <Text style={rm.sectionLabel}>INSIGHTS ({record.suggestedAdjustments.length})</Text>
          {record.suggestedAdjustments.map((adj, i) => {
            const refJob = adj.mediaIndex != null ? jobs[adj.mediaIndex] : undefined;
            const refUri = refJob?.outputUri ?? refJob?.uri;
            return (
              <View key={i} style={rm.adjCard}>
                <View style={rm.adjHeader}>
                  <Text style={rm.adjLabel}>{adj.label}</Text>
                  <ConfBadge level={adj.confidence} />
                </View>
                <ConfBar score={adj.confidenceScore} level={adj.confidence} />
                {(adj.evidence || adj.note) && (
                  <View style={rm.evidenceBox}>
                    <Text style={rm.evidenceIcon}>🔎</Text>
                    <Text style={rm.evidenceTxt}>{adj.evidence ?? adj.note}</Text>
                  </View>
                )}
                {refUri && (
                  <BBoxOverlay uri={refUri} bbox={adj.boundingBox} label={String((adj.mediaIndex ?? 0) + 1)} />
                )}
                {adj.questionId && adj.suggestedValue && (
                  <View style={rm.adjApplyRow}>
                    <Text style={rm.adjApplyIcon}>→</Text>
                    <Text style={rm.adjApplyTxt}>
                      Suggested: <Text style={rm.adjApplyVal}>"{adj.suggestedValue}"</Text>
                    </Text>
                  </View>
                )}
              </View>
            );
          })}

          <View style={rm.disclaimerBox}>
            <Text style={rm.disclaimerTxt}>
              AI analysis is based on image interpretation and is not a substitute for a
              professional on-site assessment. All suggestions should be verified before inclusion in a final estimate.
            </Text>
          </View>

          {onApply && (
            <TouchableOpacity style={rm.applyBtn} onPress={() => { onApply(record); onClose(); }}>
              <Text style={rm.applyBtnTxt}>Apply to Estimate →</Text>
              <Text style={rm.applyBtnSub}>
                {record.suggestedAdjustments.filter(a => a.questionId).length} answers will be pre-filled
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
const rm = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: D.bg },
  header:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: D.border },
  title:   { color: D.text, fontSize: 17, fontWeight: '700' },
  close:   { color: D.teal, fontSize: 16, fontWeight: '600' },
  scroll:  { padding: 20, paddingBottom: 48 },
  summaryCard:  { backgroundColor: D.card, borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: D.border },
  summaryHeader:{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  summaryIcon:  { fontSize: 32 },
  summaryTitle: { color: D.text, fontSize: 16, fontWeight: '700' },
  summaryDate:  { color: D.sub, fontSize: 12, marginTop: 2 },
  focusBadge:   { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: D.tealLo, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 10, borderWidth: 1, borderColor: D.teal },
  focusBadgeIcon: { fontSize: 13 },
  focusBadgeTxt:  { color: D.tealHi, fontSize: 13, fontWeight: '600', flex: 1 },
  summaryTxt:   { color: D.textDim, fontSize: 13, lineHeight: 19 },
  sectionLabel: { color: D.textDim, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 },
  adjCard:      { backgroundColor: D.card, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: D.border },
  adjHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 2 },
  adjLabel:     { color: D.text, fontSize: 14, fontWeight: '600', flex: 1, lineHeight: 19 },
  evidenceBox:  { flexDirection: 'row', gap: 6, backgroundColor: D.surface, borderRadius: 8, padding: 10, marginBottom: 6 },
  evidenceIcon: { fontSize: 13 },
  evidenceTxt:  { color: D.sub, fontSize: 12, lineHeight: 17, flex: 1 },
  adjApplyRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: D.greenLo, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5 },
  adjApplyIcon: { color: D.green, fontSize: 13, fontWeight: '700' },
  adjApplyTxt:  { color: D.greenHi, fontSize: 12 },
  adjApplyVal:  { fontWeight: '700' },
  disclaimerBox:{ backgroundColor: D.muted, borderRadius: 10, padding: 12, marginTop: 8, marginBottom: 20 },
  disclaimerTxt:{ color: D.sub, fontSize: 12, lineHeight: 17 },
  applyBtn:     { backgroundColor: D.teal, borderRadius: 14, padding: 16, alignItems: 'center', gap: 4 },
  applyBtnTxt:  { color: '#fff', fontWeight: '700', fontSize: 16 },
  applyBtnSub:  { color: 'rgba(255,255,255,0.65)', fontSize: 12 },
});

// ─── Annotate modal ───────────────────────────────────────────────────────────
function AnnotateModal({ jobId, focusNote, visible, onSave, onClose }: {
  jobId: string | null; focusNote?: string;
  visible: boolean; onSave: (id: string, note: string) => void; onClose: () => void;
}) {
  const [note, setNote] = useState('');
  useEffect(() => { if (visible) setNote(focusNote ?? ''); }, [visible, focusNote]);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <TouchableOpacity style={am.overlay} activeOpacity={1} onPress={onClose}>
          <TouchableOpacity activeOpacity={1} style={am.sheet}>
            <Text style={am.title}>Annotate Image</Text>
            <Text style={am.sub}>Add a focus directive for just this image</Text>
            <View style={am.presetsRow}>
              {['roof pitch', 'measure area', 'damage', 'material type', 'access'].map(p => (
                <TouchableOpacity key={p} style={am.preset} onPress={() => setNote(p)}>
                  <Text style={am.presetTxt}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={am.input} value={note} onChangeText={setNote}
              placeholder="e.g. focus on the ridge line" placeholderTextColor={D.sub}
              autoFocus autoCapitalize="none"
            />
            <View style={am.btnRow}>
              <TouchableOpacity style={am.cancelBtn} onPress={onClose}>
                <Text style={am.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={am.saveBtn} onPress={() => { if (jobId) onSave(jobId, note); onClose(); }}>
                <Text style={am.saveTxt}>Apply Note</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}
const am = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet:      { backgroundColor: D.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36 },
  title:      { color: D.text, fontSize: 18, fontWeight: '700', marginBottom: 4 },
  sub:        { color: D.sub, fontSize: 13, marginBottom: 16 },
  presetsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  preset:     { backgroundColor: D.card, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: D.border },
  presetTxt:  { color: D.textDim, fontSize: 12 },
  input:      { backgroundColor: D.card, borderWidth: 1, borderColor: D.border, borderRadius: 12, color: D.text, padding: 12, fontSize: 14, marginBottom: 16 },
  btnRow:     { flexDirection: 'row', gap: 12 },
  cancelBtn:  { flex: 1, backgroundColor: D.card, borderRadius: 12, padding: 13, alignItems: 'center', borderWidth: 1, borderColor: D.border },
  cancelTxt:  { color: D.sub, fontWeight: '600', fontSize: 15 },
  saveBtn:    { flex: 1, backgroundColor: D.teal, borderRadius: 12, padding: 13, alignItems: 'center' },
  saveTxt:    { color: '#fff', fontWeight: '700', fontSize: 15 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export function AiSiteAnalysisScreen({ navigation, route }: any) {
  const { estimateId, verticalId } = route?.params ?? {};

  const [credits, setCredits]           = useState<CreditBalance | null>(null);
  const [jobs, setJobs]                 = useState<MediaJob[]>([]);
  const [focusPrompt, setFocusPrompt]   = useState('');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [analyzing, setAnalyzing]       = useState(false);
  const [analysisPhase, setAnalysisPhase] = useState('');
  const [result, setResult]             = useState<AiAnalysisRecord | null>(null);
  const [showResult, setShowResult]     = useState(false);
  const [history, setHistory]           = useState<AiAnalysisRecord[]>([]);
  const [historyRecord, setHistoryRecord] = useState<AiAnalysisRecord | null>(null);
  const [showHistory, setShowHistory]   = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [annotatingJobId, setAnnotatingJobId] = useState<string | null>(null);
  const [showAnnotate, setShowAnnotate] = useState(false);
  const [jobNotes, setJobNotes]         = useState<Record<string, string>>({});
  const [allVerticals, setAllVerticals] = useState<VerticalConfig[]>(ALL_VERTICALS);

  const loadData = useCallback(async () => {
    const [bal, hist, custom] = await Promise.all([
      getCredits(),
      getAnalysisHistory(),
      loadCustomVerticals(),
    ]);
    setCredits(bal);
    setHistory(hist);
    setAllVerticals(mergeVerticals(ALL_VERTICALS, custom));
  }, []);

  useFocusEffect(loadData);

  const vertical = allVerticals.find(v => v.id === verticalId);

  const selectPreset = (preset: typeof FOCUS_PRESETS[0]) => {
    const isSelected = selectedPreset === preset.prompt;
    setSelectedPreset(isSelected ? null : preset.prompt);
    setFocusPrompt(isSelected ? '' : preset.prompt);
  };

  // Phase 0: show DemoModal, no credit deduction, no history write
  const runAnalysis = () => {
    const currentJobs = getJobs();
    if (currentJobs.length === 0) {
      Alert.alert('No media', 'Add at least one photo or video to analyze.');
      return;
    }
    setShowDemoModal(true);
  };

  // Apply AI result to estimate (preserved from prior phases)
  const applyToEstimate = async (record: AiAnalysisRecord) => {
    if (!estimateId) return;
    const estimate = await EstimateRepository.getEstimate(estimateId);
    if (!estimate) { Alert.alert('Estimate not found', 'The estimate could not be loaded.'); return; }

    const preSnapshot: Record<string, any> = {};
    for (const [k, v] of Object.entries(estimate.intakeAnswers)) {
      if (k.startsWith('__ai_')) continue;
      if (typeof v === 'string' && (v.startsWith('data:') || v.length > 2048)) continue;
      preSnapshot[k] = v;
    }

    const merged = { ...estimate.intakeAnswers };
    const evidenceByQuestion: Record<string, EvidenceEntry> = {};
    for (const adj of record.suggestedAdjustments) {
      if (adj.questionId && adj.suggestedValue !== undefined) {
        merged[adj.questionId] = adj.suggestedValue;
        merged[`${adj.questionId}__ai_confidence`] = adj.confidence;
        merged[`${adj.questionId}__ai_source`] = 'ai_scan';
        evidenceByQuestion[adj.questionId] = {
          value: adj.suggestedValue, confidence: adj.confidenceScore,
          evidence: adj.evidence ?? adj.note, mediaIndex: adj.mediaIndex, boundingBox: adj.boundingBox,
        };
      }
    }

    await EstimateRepository.upsertEstimate({ ...estimate, intakeAnswers: merged, updatedAt: new Date().toISOString() });

    const histRecord: AiScanRecord = {
      id: makeId(), estimateId, createdAt: record.createdAt, summary: record.summary,
      answersSnapshot: preSnapshot, evidenceByQuestion,
    };
    await appendAiHistory(histRecord);

    const appliedCount = record.suggestedAdjustments.filter(a => a.questionId).length;
    Alert.alert('✅ Applied', `${appliedCount} answer${appliedCount !== 1 ? 's' : ''} pre-filled from AI analysis.`, [{
      text: 'OK', onPress: () => navigation.navigate('NewEstimate', { estimateId }),
    }]);
  };

  const canAnalyze = jobs.some(j => j.status === 'ready') && !analyzing;

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          {/* Header */}
          <View style={s.header}>
            <View>
              <Text style={s.title}>AI Site Analysis</Text>
              <Text style={s.sub}>{vertical ? `${vertical.icon} ${vertical.name}` : 'Upload photos or video for AI insights'}</Text>
            </View>
            <TouchableOpacity onPress={() => setShowHistory(true)} style={s.histBtn}>
              <Text style={s.histBtnTxt}>📋</Text>
            </TouchableOpacity>
          </View>

          {/* Demo notice */}
          <View style={s.demoNotice}>
            <Text style={s.demoNoticeIcon}>🔬</Text>
            <Text style={s.demoNoticeTxt}>AI is not connected in this build. Media intake is fully functional.</Text>
          </View>

          {/* Phase 1: Production MediaGrid */}
          <Text style={s.sectionLabel}>UPLOAD MEDIA</Text>
          <View style={s.mediaSection}>
            <MediaGrid onJobsChange={setJobs} />
          </View>

          {/* Focus guidance */}
          <Text style={s.sectionLabel}>AI FOCUS GUIDANCE</Text>
          <Text style={s.focusSub}>Tell the AI what to look for. Combine preset + custom text.</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.presetsScroll}>
            <View style={s.presetsRow}>
              {FOCUS_PRESETS.map(preset => {
                const active = selectedPreset === preset.prompt;
                return (
                  <TouchableOpacity
                    key={preset.label}
                    style={[s.presetChip, active && s.presetChipActive]}
                    onPress={() => selectPreset(preset)}
                  >
                    <Text style={s.presetIcon}>{preset.icon}</Text>
                    <Text style={[s.presetLabel, active && s.presetLabelActive]}>{preset.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
          <TextInput
            style={s.focusInput}
            value={focusPrompt}
            onChangeText={(t) => { setFocusPrompt(t); setSelectedPreset(null); }}
            placeholder="Or type a custom focus directive…"
            placeholderTextColor={D.sub}
            autoCapitalize="none"
            autoCorrect={false}
          />

          {/* Tips */}
          <View style={s.tipsRow}>
            {['Be specific for better results', 'Multiple angles improve accuracy', 'Video helps measure dimensions'].map((tip, i) => (
              <View key={i} style={s.tip}>
                <Text style={s.tipDot}>·</Text>
                <Text style={s.tipTxt}>{tip}</Text>
              </View>
            ))}
          </View>

          {/* Analyzing state */}
          {analyzing && (
            <View style={s.analyzingCard}>
              <Text style={s.analyzingTitle}>🤖 Analyzing Your Site…</Text>
              <AnalysisProgress phase={analysisPhase} />
            </View>
          )}

          {/* Last result preview */}
          {result && !analyzing && (
            <TouchableOpacity style={s.lastResultCard} onPress={() => setShowResult(true)}>
              <View style={s.lastResultHeader}>
                <Text style={s.lastResultIcon}>✅</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.lastResultTitle}>Latest Analysis</Text>
                  <Text style={s.lastResultMeta}>{result.suggestedAdjustments.length} insights</Text>
                </View>
                <Text style={s.lastResultView}>View →</Text>
              </View>
              <Text style={s.lastResultSummary} numberOfLines={2}>{result.summary}</Text>
            </TouchableOpacity>
          )}

          {/* Analyze CTA */}
          <TouchableOpacity
            style={[s.analyzeBtn, !canAnalyze && s.analyzeBtnDisabled]}
            onPress={runAnalysis}
            disabled={!canAnalyze}
          >
            {analyzing ? (
              <Text style={s.analyzeBtnTxt}>Analyzing…</Text>
            ) : (
              <>
                <Text style={s.analyzeBtnTxt}>🤖 Run AI Analysis</Text>
                {jobs.length > 0 && (
                  <Text style={s.analyzeBtnSub}>
                    {jobs.filter(j => j.status === 'ready').length}/{jobs.length} items ready
                  </Text>
                )}
              </>
            )}
          </TouchableOpacity>

          {/* Recent history */}
          {history.length > 0 && (
            <>
              <Text style={[s.sectionLabel, { marginTop: 28 }]}>RECENT ANALYSES</Text>
              {history.slice(0, 3).map(rec => (
                <HistoryItem key={rec.id} record={rec} onView={() => { setHistoryRecord(rec); setShowHistory(true); }} />
              ))}
              {history.length > 3 && (
                <TouchableOpacity style={s.viewAllBtn} onPress={() => setShowHistory(true)}>
                  <Text style={s.viewAllTxt}>View all {history.length} analyses</Text>
                </TouchableOpacity>
              )}
            </>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Result modal */}
      <ResultModal
        record={showResult ? result : (historyRecord ?? null)}
        jobs={jobs}
        visible={showResult || !!historyRecord}
        onClose={() => { setShowResult(false); setHistoryRecord(null); }}
        onApply={estimateId ? applyToEstimate : undefined}
      />

      {/* History list modal */}
      <Modal
        visible={showHistory && !historyRecord}
        animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => setShowHistory(false)}
      >
        <SafeAreaView style={s.safe}>
          <View style={s.histModalHeader}>
            <TouchableOpacity onPress={() => setShowHistory(false)}><Text style={s.histModalClose}>Done</Text></TouchableOpacity>
            <Text style={s.histModalTitle}>Analysis History</Text>
            <View style={{ width: 50 }} />
          </View>
          <ScrollView contentContainerStyle={s.scroll}>
            {history.length === 0 ? (
              <View style={s.emptyHist}>
                <Text style={s.emptyHistIcon}>🔍</Text>
                <Text style={s.emptyHistTxt}>No analyses yet</Text>
              </View>
            ) : (
              history.map(rec => (
                <HistoryItem key={rec.id} record={rec} onView={() => { setHistoryRecord(rec); setShowHistory(false); }} />
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Annotate modal */}
      <AnnotateModal
        jobId={annotatingJobId}
        focusNote={annotatingJobId ? jobNotes[annotatingJobId] : undefined}
        visible={showAnnotate}
        onSave={(id, note) => setJobNotes(prev => ({ ...prev, [id]: note }))}
        onClose={() => setShowAnnotate(false)}
      />

      {/* Phase 0: Demo modal */}
      <DemoModal visible={showDemoModal} onClose={() => setShowDemoModal(false)} />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: D.bg },
  scroll: { padding: 20, paddingBottom: 48 },

  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  title:      { color: D.text, fontSize: 24, fontWeight: '800' },
  sub:        { color: D.sub, fontSize: 13, marginTop: 3 },
  histBtn:    { backgroundColor: D.card, borderRadius: 10, padding: 9, borderWidth: 1, borderColor: D.border },
  histBtnTxt: { fontSize: 18 },

  demoNotice: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: D.amberLo, borderRadius: 10, padding: 10, marginBottom: 20, borderWidth: 1, borderColor: D.amber },
  demoNoticeIcon: { fontSize: 16 },
  demoNoticeTxt:  { color: D.amberHi, fontSize: 12, flex: 1, lineHeight: 16 },

  sectionLabel: { color: D.textDim, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 },
  mediaSection: { marginBottom: 24 },

  focusSub:     { color: D.sub, fontSize: 12, marginBottom: 10, lineHeight: 17 },
  presetsScroll:{ marginBottom: 12 },
  presetsRow:   { flexDirection: 'row', gap: 8, paddingRight: 20 },
  presetChip:   { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: D.card, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: D.border },
  presetChipActive: { backgroundColor: D.accentLo, borderColor: D.accent },
  presetIcon:   { fontSize: 14 },
  presetLabel:  { color: D.textDim, fontSize: 13 },
  presetLabelActive: { color: D.accentHi, fontWeight: '700' },
  focusInput:   { backgroundColor: D.card, borderWidth: 1, borderColor: D.border, borderRadius: 12, color: D.text, padding: 13, fontSize: 14, marginBottom: 10 },

  tipsRow: { gap: 5, marginBottom: 20 },
  tip:     { flexDirection: 'row', gap: 6 },
  tipDot:  { color: D.accent, fontSize: 14, lineHeight: 18 },
  tipTxt:  { color: D.sub, fontSize: 12, lineHeight: 18, flex: 1 },

  analyzingCard: { backgroundColor: D.accentLo, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: D.accent },
  analyzingTitle:{ color: D.accentHi, fontSize: 16, fontWeight: '700', paddingTop: 16, paddingHorizontal: 16 },

  lastResultCard:    { backgroundColor: D.greenLo, borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: D.green },
  lastResultHeader:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  lastResultIcon:    { fontSize: 20 },
  lastResultTitle:   { color: D.greenHi, fontSize: 14, fontWeight: '700' },
  lastResultMeta:    { color: D.sub, fontSize: 11, marginTop: 1 },
  lastResultView:    { color: D.green, fontSize: 13, fontWeight: '700' },
  lastResultSummary: { color: D.sub, fontSize: 12, lineHeight: 17 },

  analyzeBtn:         { backgroundColor: D.accent, borderRadius: 16, paddingVertical: 18, paddingHorizontal: 24, alignItems: 'center', marginBottom: 8, gap: 4 },
  analyzeBtnDisabled: { opacity: 0.4 },
  analyzeBtnTxt:      { color: '#fff', fontWeight: '800', fontSize: 17 },
  analyzeBtnSub:      { color: 'rgba(255,255,255,0.6)', fontSize: 12 },

  viewAllBtn: { backgroundColor: D.card, borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: D.border },
  viewAllTxt: { color: D.textDim, fontSize: 14, fontWeight: '600' },

  histModalHeader:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: D.border },
  histModalTitle: { color: D.text, fontSize: 17, fontWeight: '700' },
  histModalClose: { color: D.teal, fontSize: 16, fontWeight: '600' },
  emptyHist:    { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyHistIcon:{ fontSize: 40 },
  emptyHistTxt: { color: D.sub, fontSize: 15 },
});
