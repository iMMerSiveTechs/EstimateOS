/**
 * MediaItemCard.tsx
 *
 * Individual card in the MediaGrid.
 * Shows thumbnail/placeholder, status badge (queued/processing/ready/failed),
 * per-item progress indicator, remove button, and move left/right controls.
 *
 * Long-press activates reorder mode (shows move controls).
 */

import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Image, StyleSheet,
  Animated,
} from 'react-native';
import { T, radii } from '../theme';
import { MediaJob } from './MediaJobQueue';
import { JobStatus } from './MediaConstants';

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<JobStatus, { label: string; color: string; bg: string }> = {
  queued:     { label: 'Queued',      color: T.sub,    bg: T.muted },
  processing: { label: 'Processing…', color: T.amber,  bg: T.amberLo },
  ready:      { label: 'Ready',       color: T.green,  bg: T.greenLo },
  failed:     { label: 'Failed',      color: T.red,    bg: T.redLo },
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  job:        MediaJob;
  size:       number;
  isFirst:    boolean;
  isLast:     boolean;
  onRemove:   (id: string) => void;
  onMoveLeft: (id: string) => void;
  onMoveRight:(id: string) => void;
  onAnnotate?:(id: string) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function MediaItemCard({
  job, size, isFirst, isLast,
  onRemove, onMoveLeft, onMoveRight, onAnnotate,
}: Props) {
  const [reordering, setReordering] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;

  // Pulse animation during processing
  React.useEffect(() => {
    if (job.status === 'processing') {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 0.65, duration: 700, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1,    duration: 700, useNativeDriver: true }),
        ])
      );
      anim.start();
      return () => anim.stop();
    } else {
      pulse.setValue(1);
    }
  }, [job.status]);

  const cfg = STATUS_CONFIG[job.status];
  const displayUri = job.outputUri ?? job.uri;

  return (
    <View style={[s.card, { width: size, height: size }]}>

      {/* Thumbnail */}
      <TouchableOpacity
        style={s.thumb}
        activeOpacity={0.85}
        onLongPress={() => setReordering(r => !r)}
        onPress={() => { if (!reordering) onAnnotate?.(job.id); }}
        delayLongPress={400}
      >
        {displayUri ? (
          <Animated.Image
            source={{ uri: displayUri }}
            style={[s.thumbImg, { opacity: job.status === 'processing' ? pulse : 1 }]}
            resizeMode="cover"
          />
        ) : (
          <View style={[s.placeholder, job.kind === 'video' && s.placeholderVideo]}>
            <Text style={s.placeholderIcon}>{job.kind === 'video' ? '🎬' : '📷'}</Text>
          </View>
        )}

        {/* Video badge */}
        {job.kind === 'video' && (
          <View style={s.videoBadge}>
            <Text style={s.videoBadgeTxt}>VIDEO</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Status badge */}
      <View style={[s.statusBadge, { backgroundColor: cfg.bg }]}>
        <Text style={[s.statusTxt, { color: cfg.color }]}>{cfg.label}</Text>
      </View>

      {/* Progress bar (only when processing) */}
      {job.status === 'processing' && (
        <View style={s.progressBar}>
          <View style={[s.progressFill, { width: `${job.progress}%` as any }]} />
        </View>
      )}

      {/* Error message */}
      {job.status === 'failed' && job.error && (
        <View style={s.errorBanner}>
          <Text style={s.errorTxt} numberOfLines={1}>{job.error}</Text>
        </View>
      )}

      {/* Remove button */}
      <TouchableOpacity
        style={s.removeBtn}
        onPress={() => onRemove(job.id)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={s.removeX}>✕</Text>
      </TouchableOpacity>

      {/* Reorder controls (shown on long-press) */}
      {reordering && (
        <View style={s.reorderOverlay}>
          <TouchableOpacity
            style={[s.moveBtn, isFirst && s.moveBtnDisabled]}
            onPress={() => !isFirst && onMoveLeft(job.id)}
            disabled={isFirst}
          >
            <Text style={s.moveTxt}>◀</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.moveDone}
            onPress={() => setReordering(false)}
          >
            <Text style={s.moveDoneTxt}>Done</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.moveBtn, isLast && s.moveBtnDisabled]}
            onPress={() => !isLast && onMoveRight(job.id)}
            disabled={isLast}
          >
            <Text style={s.moveTxt}>▶</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card:    { borderRadius: radii.md, overflow: 'visible', position: 'relative' },

  thumb:   { width: '100%', height: '100%', borderRadius: radii.md, overflow: 'hidden', backgroundColor: T.card },
  thumbImg:{ width: '100%', height: '100%' },

  placeholder:      { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: T.card },
  placeholderVideo: { backgroundColor: '#1a1040' },
  placeholderIcon:  { fontSize: 28 },

  videoBadge:    { position: 'absolute', top: 5, left: 5, backgroundColor: 'rgba(168,85,247,0.85)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  videoBadgeTxt: { color: '#fff', fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },

  statusBadge: { position: 'absolute', bottom: 4, left: 4, borderRadius: radii.sm, paddingHorizontal: 5, paddingVertical: 2 },
  statusTxt:   { fontSize: 8, fontWeight: '700' },

  progressBar: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: T.muted },
  progressFill:{ height: '100%', backgroundColor: T.amber, borderBottomLeftRadius: radii.md },

  errorBanner: { position: 'absolute', bottom: 16, left: 0, right: 0, backgroundColor: 'rgba(239,68,68,0.85)', padding: 3 },
  errorTxt:    { color: '#fff', fontSize: 8, textAlign: 'center' },

  removeBtn: { position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: T.red, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  removeX:   { color: '#fff', fontSize: 10, fontWeight: '900' },

  reorderOverlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: radii.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  moveBtn:         { width: 28, height: 28, borderRadius: radii.sm, backgroundColor: T.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: T.border },
  moveBtnDisabled: { opacity: 0.35 },
  moveTxt:         { color: T.text, fontSize: 12, fontWeight: '700' },
  moveDone:        { backgroundColor: T.accent, borderRadius: radii.sm, paddingHorizontal: 8, paddingVertical: 5 },
  moveDoneTxt:     { color: '#fff', fontSize: 10, fontWeight: '700' },
});
