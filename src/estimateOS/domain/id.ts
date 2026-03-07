// ─── Unique ID generation ──────────────────────────────────────────────────
// Uses crypto.randomUUID() where available (modern RN / Hermes),
// falling back to a manual UUID v4 implementation for older environments.

function uuidv4Fallback(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function makeId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  return uuidv4Fallback();
}
