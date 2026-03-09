// ─── App settings storage (Firestore-backed) ──────────────────────────────
// Single document: users/{uid}/settings/app

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { AppSettings, BusinessProfile, QualityPreset } from '../models/types';

// Firebase v11 rejects undefined values at any nesting level — strip before write.
function deepStripUndefined(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (v !== null && typeof v === 'object' && !Array.isArray(v) && typeof v._methodName === 'undefined') {
      out[k] = deepStripUndefined(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function uid(): string {
  const user = auth.currentUser;
  if (!user) throw new Error('settings: user is not signed in');
  return user.uid;
}

function settingsRef() { return doc(db, 'users', uid(), 'settings', 'app'); }

export const DEFAULT_SETTINGS: AppSettings = {
  businessProfile: {
    businessName: '',
    phone: '',
    email: '',
    address: '',
    website: '',
    termsAndConditions: '',
  },
  exportSettings: {
    estimatePrefix: 'EST-',
    invoicePrefix: 'INV-',
    nextEstimateNumber: 1,
    nextInvoiceNumber: 1,
  },
  pricingDefaults: {
    overheadPct: 0.15,
    profitPct: 0.20,
    taxPct: 0,
    travelFee: 0,
  },
  presets: [
    { id: 'good',   label: 'Good',   description: 'Standard materials and workmanship', multiplier: 1.0 },
    { id: 'better', label: 'Better', description: 'Premium materials, enhanced warranty',  multiplier: 1.15 },
    { id: 'best',   label: 'Best',   description: 'Top-tier materials, full warranty',     multiplier: 1.35 },
  ],
  aiFeatures: {
    advancedReasoning: true,
    analyzeImages: true,
    videoUnderstanding: false,
    chatbot: false,
  },
  integrations: {
    gemini: false,
    googleMaps: false,
    voiceInput: false,
    imageCreation: false,
    cloudSync: true,    // Firebase is already connected
    stripeEnabled: false, // requires Stripe publishable key setup
  },
  emailTemplate: {
    subject: 'Estimate for {customer_name} – {address} – {estimate_number}',
    body: `Hi {customer_name},\n\nThank you for the opportunity to provide this estimate.\n\nScope: {service_name} — {vertical_name}\nEstimated Range: {price_min} – {price_max}\n\nThis estimate is valid for 30 days. Please don't hesitate to reach out with any questions.\n\nBest regards,\n{business_name}`,
  },
};

export async function getSettings(): Promise<AppSettings> {
  const snap = await getDoc(settingsRef());
  if (!snap.exists()) return DEFAULT_SETTINGS;
  // Deep merge so missing keys fall back to defaults
  const stored = snap.data() as Partial<AppSettings>;
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    businessProfile: { ...DEFAULT_SETTINGS.businessProfile, ...stored.businessProfile },
    exportSettings:  { ...DEFAULT_SETTINGS.exportSettings,  ...stored.exportSettings },
    pricingDefaults: { ...DEFAULT_SETTINGS.pricingDefaults, ...stored.pricingDefaults },
    aiFeatures:      { ...DEFAULT_SETTINGS.aiFeatures,      ...stored.aiFeatures },
    integrations:    { ...DEFAULT_SETTINGS.integrations,    ...stored.integrations },
    emailTemplate:   { ...DEFAULT_SETTINGS.emailTemplate,   ...stored.emailTemplate },
    presets: stored.presets ?? DEFAULT_SETTINGS.presets,
  };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await setDoc(settingsRef(), { ...deepStripUndefined(settings), updatedAt: serverTimestamp() }, { merge: true });
}

export async function getBusinessProfile(): Promise<BusinessProfile> {
  const s = await getSettings();
  return s.businessProfile;
}

export async function saveBusinessProfile(profile: BusinessProfile): Promise<void> {
  await setDoc(settingsRef(), { businessProfile: profile, updatedAt: serverTimestamp() }, { merge: true });
}

/** Atomically increment and return the next estimate number string (e.g. "EST-0042"). */
export async function nextEstimateNumber(): Promise<string> {
  const s = await getSettings();
  const n = s.exportSettings.nextEstimateNumber;
  const label = `${s.exportSettings.estimatePrefix}${String(n).padStart(4, '0')}`;
  await setDoc(
    settingsRef(),
    { exportSettings: { ...s.exportSettings, nextEstimateNumber: n + 1 }, updatedAt: serverTimestamp() },
    { merge: true },
  );
  return label;
}

/** Atomically increment and return the next invoice number string (e.g. "INV-0012"). */
export async function nextInvoiceNumber(): Promise<string> {
  const s = await getSettings();
  const n = s.exportSettings.nextInvoiceNumber;
  const label = `${s.exportSettings.invoicePrefix}${String(n).padStart(4, '0')}`;
  await setDoc(
    settingsRef(),
    { exportSettings: { ...s.exportSettings, nextInvoiceNumber: n + 1 }, updatedAt: serverTimestamp() },
    { merge: true },
  );
  return label;
}

export async function saveEmailTemplate(subject: string, body: string): Promise<void> {
  await setDoc(settingsRef(), { emailTemplate: { subject, body }, updatedAt: serverTimestamp() }, { merge: true });
}

export async function savePresets(presets: QualityPreset[]): Promise<void> {
  await setDoc(settingsRef(), { presets, updatedAt: serverTimestamp() }, { merge: true });
}
