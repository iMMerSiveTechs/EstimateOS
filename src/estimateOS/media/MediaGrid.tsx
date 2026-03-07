/**
 * MediaGrid.tsx
 *
 * The main media intake UI used in AiSiteAnalysisScreen.
 *
 * - Subscribes to MediaJobQueue for live job state.
 * - Shows MediaItemCard per job with status/progress.
 * - "Add Media" button opens MediaPickerSheet bottom sheet.
 * - Error banners for queue-level errors (too many, etc.).
 * - Shows a concise caps line + info tooltip.
 */

import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions, ScrollView,
} from 'react-native';
import { T, radii } from '../theme';
import { MediaJob, subscribeJobs, removeJob, moveJob } from './MediaJobQueue';
import { MediaItemCard } from './MediaItemCard';
import { MediaPickerSheet } from './MediaPickerSheet';
import { MEDIA_CAPS_SUMMARY, MAX_PHOTOS, MAX_VIDEO_SECONDS } from './MediaConstants';

const { width: SW } = Dimensions.get('window');
const COLS = 3;
const GAP  = 8;
const PAD  = 20;
const CELL_SIZE = Math.floor((SW - PAD * 2 - GAP * (COLS - 1)) / COLS);

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /** Called whenever job list changes (so parent can gate the Analyze button). */
  onJobsChange?: (jobs: MediaJob[]) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function MediaGrid({ onJobsChange }: Props) {
  const [jobs, setJobs]             = useState<MediaJob[]>([]);
  const [sheetOpen, setSheetOpen]   = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    const unsub = subscribeJobs(j => {
      setJobs(j);
      onJobsChange?.(j);
    });
    return unsub;
  }, []);

  // Auto-clear error banner after 4 seconds
  useEffect(() => {
    if (!errorBanner) return;
    const t = setTimeout(() => setErrorBanner(null), 4000);
    return () => clearTimeout(t);
  }, [errorBanner]);

  const readyJobs   = jobs.filter(j => j.status === 'ready');
  const hasVideo    = jobs.some(j => j.kind === 'video');
  const photoCount  = jobs.filter(j => j.kind === 'photo').length;
  const failedCount = jobs.filter(j => j.status === 'failed').length;

  return (
    <View>
      {/* Caps info row */}
      <View style={s.capsRow}>
        <Text style={s.capsText}>
          {photoCount}/{MAX_PHOTOS} photos
          {hasVideo ? ' · 1 video' : ` · 1 video ≤${MAX_VIDEO_SECONDS}s`}
        </Text>
        <TouchableOpacity
          style={s.infoBtn}
          onPress={() => setShowTooltip(t => !t)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={s.infoBtnTxt}>ⓘ</Text>
        </TouchableOpacity>
      </View>

      {/* Tooltip */}
      {showTooltip && (
        <View style={s.tooltip}>
          <Text style={s.tooltipTxt}>{MEDIA_CAPS_SUMMARY}</Text>
          <Text style={s.tooltipNote}>Long-press any item to reorder.</Text>
        </View>
      )}

      {/* Error banner */}
      {errorBanner && (
        <View style={s.errorBanner}>
          <Text style={s.errorTxt}>⚠ {errorBanner}</Text>
          <TouchableOpacity onPress={() => setErrorBanner(null)}>
            <Text style={s.errorDismiss}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Failed items warning */}
      {failedCount > 0 && (
        <View style={[s.errorBanner, s.warningBanner]}>
          <Text style={s.warningTxt}>
            {failedCount} item{failedCount !== 1 ? 's' : ''} failed to process. Remove and try again.
          </Text>
        </View>
      )}

      {/* Media grid */}
      {jobs.length === 0 ? (
        <View style={s.emptyState}>
          <Text style={s.emptyIcon}>📸</Text>
          <Text style={s.emptyTitle}>Add photos or a short video</Text>
          <Text style={s.emptySub}>Up to {MAX_PHOTOS} photos · 1 video ≤{MAX_VIDEO_SECONDS}s</Text>
          <TouchableOpacity style={s.addMediaBtn} onPress={() => setSheetOpen(true)}>
            <Text style={s.addMediaTxt}>+ Add Media</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View>
          <View style={s.grid}>
            {jobs.map((job, idx) => (
              <MediaItemCard
                key={job.id}
                job={job}
                size={CELL_SIZE}
                isFirst={idx === 0}
                isLast={idx === jobs.length - 1}
                onRemove={removeJob}
                onMoveLeft={id => moveJob(id, 'left')}
                onMoveRight={id => moveJob(id, 'right')}
              />
            ))}
          </View>

          {/* Add Media button (inline, when items exist) */}
          <TouchableOpacity style={s.addMoreBtn} onPress={() => setSheetOpen(true)}>
            <Text style={s.addMoreTxt}>+ Add Media</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Summary line when items exist */}
      {jobs.length > 0 && (
        <Text style={s.summaryLine}>
          {readyJobs.length}/{jobs.length} ready
          {jobs.some(j => j.status === 'processing') ? ' · Processing…' : ''}
        </Text>
      )}

      {/* Picker sheet */}
      <MediaPickerSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onAdded={() => setSheetOpen(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  capsRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  capsText: { color: T.sub, fontSize: 12 },
  infoBtn:  { padding: 4 },
  infoBtnTxt:{ color: T.sub, fontSize: 14 },

  tooltip: {
    backgroundColor: T.card, borderRadius: radii.md, padding: 12,
    marginBottom: 10, borderWidth: 1, borderColor: T.border,
  },
  tooltipTxt:  { color: T.textDim, fontSize: 12, lineHeight: 17, marginBottom: 4 },
  tooltipNote: { color: T.sub, fontSize: 11 },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: T.redLo, borderRadius: radii.md, padding: 10,
    marginBottom: 8, borderWidth: 1, borderColor: T.red,
  },
  errorTxt:     { color: T.red, fontSize: 12, flex: 1 },
  errorDismiss: { color: T.red, fontSize: 14, fontWeight: '700', marginLeft: 8 },

  warningBanner: { backgroundColor: T.amberLo, borderColor: T.amber },
  warningTxt:    { color: T.amber, fontSize: 12, flex: 1 },

  emptyState: { alignItems: 'center', paddingVertical: 28 },
  emptyIcon:  { fontSize: 36, marginBottom: 8 },
  emptyTitle: { color: T.text, fontSize: 15, fontWeight: '700', marginBottom: 4 },
  emptySub:   { color: T.sub, fontSize: 12, marginBottom: 16 },

  addMediaBtn: {
    backgroundColor: T.accent, borderRadius: radii.lg,
    paddingHorizontal: 24, paddingVertical: 11,
  },
  addMediaTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, marginBottom: 12 },

  addMoreBtn: {
    borderWidth: 1.5, borderColor: T.accent, borderStyle: 'dashed',
    borderRadius: radii.lg, padding: 11, alignItems: 'center', marginBottom: 4,
  },
  addMoreTxt: { color: T.accent, fontWeight: '700', fontSize: 13 },

  summaryLine: { color: T.sub, fontSize: 11, textAlign: 'center', marginBottom: 4 },
});
