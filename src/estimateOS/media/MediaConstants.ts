/**
 * MediaConstants.ts
 *
 * Single source of truth for media intake rules.
 * All enforcement (caps, duration, type checks) references these values.
 */

/** Maximum number of photos per analysis session. */
export const MAX_PHOTOS = 12;

/** Maximum number of videos per analysis session (always 1). */
export const MAX_VIDEOS = 1;

/** Total combined media cap (photos + video counts toward this). */
export const MAX_MEDIA_ITEMS = 12;

/** Maximum video duration in seconds. */
export const MAX_VIDEO_SECONDS = 30;

/** Maximum pixel dimension for a resized image (longest side). */
export const IMAGE_MAX_DIMENSION = 1536;

/** JPEG quality (0–1) after compression. */
export const IMAGE_COMPRESS_QUALITY = 0.82;

/** Number of video frames to extract when expo-video-thumbnails is available. */
export const VIDEO_FRAME_COUNT = 10;

/** Accepted image MIME types (informational — used in UI copy). */
export const ACCEPTED_IMAGE_TYPES = 'JPG · PNG · HEIC';

/** Accepted video MIME types (informational — used in UI copy). */
export const ACCEPTED_VIDEO_TYPES = 'MP4 · MOV';

/** One-line summary for the info tooltip. */
export const MEDIA_CAPS_SUMMARY =
  `Up to ${MAX_PHOTOS} photos or 1 video ≤${MAX_VIDEO_SECONDS}s · ${ACCEPTED_IMAGE_TYPES} · ${ACCEPTED_VIDEO_TYPES}`;

/** Job status values for the processing pipeline. */
export type JobStatus = 'queued' | 'processing' | 'ready' | 'failed';

/** Kinds of media items in the pipeline. */
export type MediaKind = 'photo' | 'video';
