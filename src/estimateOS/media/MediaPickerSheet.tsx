/**
 * MediaPickerSheet.tsx
 *
 * Bottom sheet triggered by "Add Media" button.
 * Options: Add Photos | Add Video | Cancel
 *
 * All validation (cap checks, duration checks, permission handling) lives here
 * so the parent screen just calls enqueueMedia() after picking.
 */

import React from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet,
  Platform, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { T, radii } from '../theme';
import {
  MAX_PHOTOS, MAX_VIDEOS, MAX_VIDEO_SECONDS,
  MEDIA_CAPS_SUMMARY, MediaKind,
} from './MediaConstants';
import { enqueueMedia, getJobs } from './MediaJobQueue';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  visible:  boolean;
  onClose:  () => void;
  /** Called after jobs are enqueued so parent can show the grid. */
  onAdded?: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function MediaPickerSheet({ visible, onClose, onAdded }: Props) {

  async function requestPermission(): Promise<boolean> {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission required',
        'Allow photo library access in Settings to add media.',
        [{ text: 'OK' }],
      );
      return false;
    }
    return true;
  }

  async function handleAddPhotos() {
    onClose();
    if (!(await requestPermission())) return;

    const existing = getJobs();
    const currentPhotos = existing.filter(j => j.kind === 'photo').length;
    const remaining = MAX_PHOTOS - currentPhotos;

    if (remaining <= 0) {
      Alert.alert('Photo limit reached', `Maximum ${MAX_PHOTOS} photos per session.`);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes:          ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality:             1,       // compress handled by MediaJobQueue
      selectionLimit:      remaining,
    });

    if (result.canceled || !result.assets?.length) return;

    const items: Array<{ uri: string; kind: MediaKind }> =
      result.assets.map(a => ({ uri: a.uri, kind: 'photo' }));

    enqueueMedia(items);
    onAdded?.();
  }

  async function handleAddVideo() {
    onClose();

    const existing = getJobs();
    const hasVideo = existing.some(j => j.kind === 'video');
    if (hasVideo) {
      Alert.alert('One video allowed', 'Remove the current video before adding another.');
      return;
    }

    if (!(await requestPermission())) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes:       ImagePicker.MediaTypeOptions.Videos,
      allowsMultipleSelection: false,
      videoMaxDuration: MAX_VIDEO_SECONDS,
    });

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];

    // Hard-enforce duration cap (videoMaxDuration is advisory on some iOS versions)
    const durationSec = asset.duration ? asset.duration / 1000 : 0;
    if (durationSec > MAX_VIDEO_SECONDS) {
      Alert.alert(
        'Video too long',
        `Your clip is ${Math.round(durationSec)}s. Please choose one ≤${MAX_VIDEO_SECONDS}s.`,
      );
      return;
    }

    enqueueMedia([{ uri: asset.uri, kind: 'video' }]);
    onAdded?.();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={s.sheet}>
          {/* Handle bar */}
          <View style={s.handle} />

          <Text style={s.title}>Add Media</Text>
          <Text style={s.caps}>{MEDIA_CAPS_SUMMARY}</Text>

          <TouchableOpacity style={[s.option, s.optionPhoto]} onPress={handleAddPhotos}>
            <Text style={s.optionIcon}>📷</Text>
            <View style={s.optionBody}>
              <Text style={s.optionLabel}>Add Photos</Text>
              <Text style={s.optionSub}>JPG · PNG · HEIC · up to {MAX_PHOTOS} images</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[s.option, s.optionVideo]} onPress={handleAddVideo}>
            <Text style={s.optionIcon}>🎬</Text>
            <View style={s.optionBody}>
              <Text style={s.optionLabel}>Add Video</Text>
              <Text style={s.optionSub}>MP4 · MOV · max {MAX_VIDEO_SECONDS}s · 1 per session</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={s.cancel} onPress={onClose}>
            <Text style={s.cancelTxt}>Cancel</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:  {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: T.surface,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    borderWidth: 1,
    borderColor: T.border,
  },
  handle:    { width: 40, height: 4, borderRadius: 2, backgroundColor: T.muted, alignSelf: 'center', marginBottom: 16 },
  title:     { color: T.text, fontSize: 18, fontWeight: '800', marginBottom: 4 },
  caps:      { color: T.sub, fontSize: 11, marginBottom: 16, lineHeight: 16 },

  option:    {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: radii.lg, padding: 14, marginBottom: 10,
    borderWidth: 1,
  },
  optionPhoto: { backgroundColor: T.accentLo, borderColor: T.accent },
  optionVideo: { backgroundColor: T.purpleLo, borderColor: T.purple },
  optionIcon:  { fontSize: 28 },
  optionBody:  { flex: 1 },
  optionLabel: { color: T.text, fontSize: 15, fontWeight: '700', marginBottom: 2 },
  optionSub:   { color: T.sub, fontSize: 12 },

  cancel:    {
    alignItems: 'center', padding: 14,
    borderRadius: radii.lg, marginTop: 4,
    backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
  },
  cancelTxt: { color: T.sub, fontSize: 15, fontWeight: '600' },
});
