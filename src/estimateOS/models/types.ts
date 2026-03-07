// ─── Shared TypeScript types for EstimateOS ────────────────────────────────

export const AI_META_PREFIX = '__ai_';

// ─── Primitive answer value ────────────────────────────────────────────────

export type AnswerValue = string | number | boolean | string[] | null;

// ─── Intake questions ──────────────────────────────────────────────────────

export type IntakeQuestionType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'select'
  | 'multiselect';

export interface IntakeQuestion {
  id: string;
  label: string;
  type: IntakeQuestionType;
  options?: string[];      // for select / multiselect
  required?: boolean;
  placeholder?: string;
  unit?: string;           // e.g. "sq ft", "linear ft"
  min?: number;
  max?: number;
}

// ─── Pricing rules ─────────────────────────────────────────────────────────

export type DriverBucket =
  | 'labor'
  | 'materials'
  | 'access'
  | 'disposal_fees'
  | 'risk'
  | 'other';

export const BUCKET_LABELS: Record<DriverBucket, string> = {
  labor: 'Labor',
  materials: 'Materials',
  access: 'Access & Equipment',
  disposal_fees: 'Disposal Fees',
  risk: 'Risk & Contingency',
  other: 'Other',
};

export interface FlatFeeRule {
  type: 'flat_fee';
  id: string;
  label: string;
  bucket: DriverBucket;
  min: number;
  max: number;
}

export interface ConditionalAddonRule {
  type: 'conditional_addon';
  id: string;
  label: string;
  bucket: DriverBucket;
  questionId: string;
  triggerValue: string | boolean;
  min: number;
  max: number;
}

export interface PerUnitRule {
  type: 'per_unit';
  id: string;
  label: string;
  bucket: DriverBucket;
  questionId: string;
  rateMin: number;
  rateMax: number;
  cap?: number;
}

export interface TieredRule {
  type: 'tiered';
  id: string;
  label: string;
  bucket: DriverBucket;
  questionId: string;
  tiers: Array<{ upTo: number; min: number; max: number }>;
}

export interface AdderRule {
  type: 'adder';
  id: string;
  label: string;
  bucket: DriverBucket;
  questionId: string;
  triggerValue: string | boolean;
  min: number;
  max: number;
}

export interface MultiplierRule {
  type: 'multiplier';
  id: string;
  label: string;
  bucket: DriverBucket;
  questionId: string;
  triggerValue: string | boolean;
  factor: number;
}

export type PricingRule =
  | FlatFeeRule
  | ConditionalAddonRule
  | PerUnitRule
  | TieredRule
  | AdderRule
  | MultiplierRule;

// ─── Vertical / service config ─────────────────────────────────────────────

export interface ServiceConfig {
  id: string;
  name: string;
  baseMin: number;
  baseMax: number;
}

export interface VerticalConfig {
  id: string;
  name: string;
  icon: string;            // emoji or icon name
  currency: string;        // e.g. 'USD'
  variancePct: number;     // e.g. 0.15 for ±15%
  services: ServiceConfig[];
  pricingRules: PricingRule[];
  intakeQuestions: IntakeQuestion[];
  disclaimerText?: string;
  isCustom?: boolean;      // true for user-created verticals
}

// ─── Price drivers ─────────────────────────────────────────────────────────

export interface PriceDriver {
  id: string;
  label: string;
  bucket: DriverBucket;
  min: number;
  max: number;
  isOverridden?: boolean;
  isDisabled?: boolean;
  isManual?: boolean;
}

export interface BucketSummary {
  bucket: DriverBucket;
  min: number;
  max: number;
}

// ─── Overrides ─────────────────────────────────────────────────────────────

export interface DriverOverride {
  driverId: string;
  min?: number;
  max?: number;
  disabled?: boolean;
}

export type DriverOverrideMap = Record<string, DriverOverride>;

// ─── Manual line items ─────────────────────────────────────────────────────

export interface LineItem {
  id: string;
  label: string;
  bucket: DriverBucket;
  min: number;
  max: number;
}

// ─── AI scan history ───────────────────────────────────────────────────────

export interface AiObservation {
  questionId: string;
  suggestedValue: AnswerValue;
  confidence: number;      // 0–1
  evidence?: string;       // human-readable explanation
  boundingBox?: {          // optional image annotation
    x: number; y: number; width: number; height: number;
    imageIndex: number;
  };
}

export interface AiScanRecord {
  id: string;
  estimateId: string;
  scannedAt: string;       // ISO timestamp
  mediaCount: number;
  focusNote?: string;
  observations: AiObservation[];
  preApplicationSnapshot: Record<string, AnswerValue>;
}

// ─── Estimates ─────────────────────────────────────────────────────────────

export type EstimateStatus = 'draft' | 'pending' | 'accepted' | 'rejected';

export interface Estimate {
  id: string;
  status: EstimateStatus;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  address?: string;
  notes?: string;
  verticalId: string;
  serviceId: string;
  intakeAnswers: Record<string, AnswerValue>;
  overrides: DriverOverrideMap;
  manualLineItems: LineItem[];
  createdAt: string;       // ISO timestamp
  updatedAt: string;       // ISO timestamp
  aiScanIds?: string[];    // references to AiScanRecord IDs
}

// ─── AI credits / analysis history ────────────────────────────────────────

export interface CreditBalance {
  balance: number;
  updatedAt: string;       // ISO timestamp
}

export interface AnalysisRecord {
  id: string;
  estimateId?: string;
  analyzedAt: string;
  mediaCount: number;
  creditsUsed: number;
  status: 'success' | 'failed';
  errorMessage?: string;
}
