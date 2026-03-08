// ─── Shared TypeScript types for EstimateOS ────────────────────────────────
// Field names match pricingEngineV2.ts exactly — do not rename.

export const AI_META_PREFIX = '__ai_';

// ─── Primitive answer value ────────────────────────────────────────────────

export type AnswerValue = string | number | boolean | string[] | null;

// ─── Price range ───────────────────────────────────────────────────────────

export interface PriceRange {
  min: number;
  max: number;
  currency: string;
}

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
  options?: string[];
  required?: boolean;
  placeholder?: string;
  unit?: string;         // e.g. "sq ft", "linear ft"
  min?: number;
  max?: number;
}

// ─── Custom intake fields (Phase 2 template editor) ───────────────────────

export type CustomIntakeFieldType = 'text' | 'longtext' | 'number' | 'boolean' | 'select';

export interface CustomIntakeField {
  id: string;
  label: string;
  type: CustomIntakeFieldType;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: string[];  // for 'select' type
}

// ─── Pricing rules ─────────────────────────────────────────────────────────
// Field names match pricingEngineV2.ts (valueMin/valueMax, unitMin/unitMax, etc.)

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
  valueMin: number;
  valueMax: number;
}

export interface ConditionalAddonRule {
  type: 'conditional_addon';
  id: string;
  label: string;
  bucket: DriverBucket;
  questionId: string;
  triggerValue?: string | boolean;
  answerValue?: string | boolean;  // legacy alias for triggerValue
  valueMin: number;
  valueMax: number;
}

export interface PerUnitRule {
  type: 'per_unit';
  id: string;
  label: string;
  bucket: DriverBucket;
  questionId: string;
  unitMin: number;
  unitMax: number;
  unitLabel?: string;  // e.g. "sq ft"
  unitCap?: number;
}

export interface TieredRule {
  type: 'tiered';
  id: string;
  label: string;
  bucket: DriverBucket;
  questionId: string;
  tieredData: Array<{
    label: string;
    minValue: number;
    maxValue: number;  // use Infinity for open-ended top tier
    addMin: number;
    addMax: number;
  }>;
}

export interface AdderRule {
  type: 'adder';
  id: string;
  label: string;
  bucket: DriverBucket;
  questionId: string;
  answerValue: string | boolean;
  triggerValue?: string | boolean;  // alias
  valueMin: number;
  valueMax: number;
}

export interface MultiplierRule {
  type: 'multiplier';
  id: string;
  label: string;
  bucket: DriverBucket;
  questionId: string;
  answerValue: string | boolean;
  triggerValue?: string | boolean;  // alias
  valueMin: number;  // e.g. 1.15 means ×1.15
  valueMax: number;
}

export type PricingRule =
  | FlatFeeRule
  | ConditionalAddonRule
  | PerUnitRule
  | TieredRule
  | AdderRule
  | MultiplierRule;

export type PricingRuleType = PricingRule['type'];

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
  icon: string;
  currency: string;
  variancePct: number;
  services: ServiceConfig[];
  pricingRules: PricingRule[];
  intakeQuestions: IntakeQuestion[];
  disclaimerText?: string;
  isCustom?: boolean;
}

// ─── Price drivers (engine output) ────────────────────────────────────────
// Field names match pricingEngineV2.ts exactly.

export interface PriceDriver {
  id: string;
  label: string;
  minImpact: number;
  maxImpact: number;
  bucket: DriverBucket;
  triggeredBy: string;
  explanation: string;
  editable: boolean;
  overrideMin?: number;
  overrideMax?: number;
  disabled?: boolean;
}

export interface BucketSummary {
  bucket: DriverBucket;
  totalMin: number;
  totalMax: number;
  drivers: PriceDriver[];
}

// ─── Overrides ─────────────────────────────────────────────────────────────

export interface DriverOverride {
  driverId: string;
  min?: number;
  max?: number;
  disabled?: boolean;
}

export type DriverOverrideMap = Record<string, DriverOverride>;

// ─── Line items (manual additions) ────────────────────────────────────────

export interface LineItem {
  id: string;
  label: string;
  bucket: DriverBucket;
  min: number;
  max: number;
  note?: string;
}

// ─── Material library & per-estimate material rows ────────────────────────

export interface Material {
  id: string;
  name: string;
  unit: string;         // e.g. "sq ft", "each", "bundle"
  unitCost: number;
  vendor?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialLineItem {
  id: string;
  materialId?: string;  // from library; omit for custom entries
  name: string;
  unit: string;
  unitCost: number;
  quantity: number;
  vendor?: string;
}

// ─── Customer ──────────────────────────────────────────────────────────────

export type PreferredContact = 'phone' | 'email' | 'text' | 'any';

export const PREFERRED_CONTACT_LABELS: Record<PreferredContact, string> = {
  phone: 'Phone call',
  email: 'Email',
  text:  'Text / SMS',
  any:   'Any',
};

export interface Customer {
  id: string;
  name: string;
  companyName?: string;           // business/company name (Phase 12+)
  phone?: string;
  email?: string;
  address?: string;               // service address
  billingAddress?: string;        // if different from service address (Phase 12+)
  preferredContact?: PreferredContact;  // (Phase 12+)
  tags?: string[];                // e.g. ['roofing', 'repeat', 'referral'] (Phase 12+)
  notes?: string;
  // Follow-up workflow (Phase 6+)
  followUpStatus?: FollowUpStatus;
  lastContactAt?: string;
  nextActionAt?: string;
  nextActionNote?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Estimates ─────────────────────────────────────────────────────────────

export type EstimateStatus = 'draft' | 'pending' | 'accepted' | 'rejected';

export interface Estimate {
  id: string;
  status: EstimateStatus;
  estimateNumber?: string;        // e.g. "EST-0042"
  customerId?: string;            // linked Customer id
  customer: {
    name: string;
    phone?: string;
    email?: string;
    address?: string;
  };
  verticalId: string;
  serviceId: string;
  intakeAnswers: Record<string, AnswerValue>;
  lineItems: LineItem[];
  materialLineItems?: MaterialLineItem[];
  computedRange: PriceRange;
  drivers: PriceDriver[];
  driverOverrides?: DriverOverrideMap;
  disclaimerText?: string;
  photos: string[];               // local URIs or remote URLs
  aiScanIds?: string[];
  // Follow-up workflow (Phase 6+)
  followUpStatus?: FollowUpStatus;
  quoteSentAt?: string;
  lastContactAt?: string;
  nextActionAt?: string;
  nextActionNote?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Invoices ──────────────────────────────────────────────────────────────

export type InvoiceStatus = 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'void';

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft:          'Draft',
  sent:           'Sent',
  partially_paid: 'Partial',
  paid:           'Paid',
  overdue:        'Overdue',
  void:           'Void',
};

export interface InvoiceLineItem {
  id: string;
  label: string;
  unitCost: number;
  quantity: number;
}

export interface InvoicePaymentEvent {
  id: string;
  amount: number;                 // amount paid in this event
  method?: string;                // e.g. "check", "cash", "card", "transfer"
  note?: string;
  recordedAt: string;             // ISO timestamp
}

export interface Invoice {
  id: string;
  invoiceNumber: string;          // e.g. "INV-0012"
  estimateId?: string;
  customerId?: string;
  customer: {
    name: string;
    phone?: string;
    email?: string;
    address?: string;
  };
  status: InvoiceStatus;
  lineItems: InvoiceLineItem[];
  // Computed totals (snapshot at last save)
  subtotal?: number;
  discountAmount?: number;        // flat discount applied
  taxRate: number;                // 0.08 = 8%
  taxAmount?: number;             // snapshot
  totalAmount?: number;           // final total snapshot
  // Payment tracking (Phase 12+)
  amountPaid?: number;            // cumulative amount paid so far
  paymentEvents?: InvoicePaymentEvent[];   // individual payment records
  dueDate?: string;               // ISO date — if set, used to flag overdue
  // Payment
  paymentTerms: string;           // e.g. "Due on receipt", "Net 30"
  // Snapshot of business terms at invoice creation
  termsFooterSnapshot?: string;
  notes?: string;
  voidedAt?: string;
  voidReason?: string;
  sentAt?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Settings ──────────────────────────────────────────────────────────────

export interface BusinessProfile {
  businessName: string;
  phone?: string;
  email?: string;
  address?: string;
  website?: string;
  termsAndConditions?: string;
  logoUri?: string;
}

export interface ExportSettings {
  estimatePrefix: string;       // e.g. "EST-"
  invoicePrefix: string;        // e.g. "INV-"
  nextEstimateNumber: number;
  nextInvoiceNumber: number;
}

export interface PricingDefaults {
  overheadPct: number;          // e.g. 0.15
  profitPct: number;            // e.g. 0.20
  taxPct: number;               // e.g. 0.08
  travelFee: number;            // flat $ amount
}

export interface QualityPreset {
  id: 'good' | 'better' | 'best';
  label: string;
  description?: string;
  multiplier: number;           // e.g. 1.0, 1.15, 1.35
}

export interface AiFeatureSettings {
  advancedReasoning: boolean;
  analyzeImages: boolean;
  videoUnderstanding: boolean;  // stub — "coming soon"
  chatbot: boolean;             // stub — "coming soon"
}

export interface IntegrationSettings {
  gemini: boolean;              // stub — requires API key in Firebase
  googleMaps: boolean;          // stub — requires Maps API key
  voiceInput: boolean;          // stub
  imageCreation: boolean;       // stub
  cloudSync: boolean;           // Firebase — already connected
  // Billing — requires Stripe setup
  stripeEnabled: boolean;       // false until Stripe publishable key configured
  stripePublishableKey?: string;
  googleMapsApiKey?: string;
}

export interface EmailTemplate {
  subject: string;
  body: string;
}

export interface AppSettings {
  businessProfile: BusinessProfile;
  exportSettings: ExportSettings;
  pricingDefaults: PricingDefaults;
  presets: QualityPreset[];
  aiFeatures: AiFeatureSettings;
  integrations: IntegrationSettings;
  emailTemplate: EmailTemplate;
  aiCreditSettings?: AiCreditSettings;
}

// ─── Service templates (Phase 2 template editor) ──────────────────────────

export interface ServiceTemplate {
  id: string;                   // `${verticalId}_${serviceId}`
  verticalId: string;
  serviceId: string;
  customIntakeFields: CustomIntakeField[];
  materialDefaults: Array<{ materialId: string; defaultQty: number }>;
  updatedAt: string;
}

// ─── AI analysis (working/in-memory result, NOT persisted directly) ───────────
// This is the rich result from an AI analysis session.
// The persisted history record is AiScanRecord (below).

export interface SuggestedAdjustment {
  label: string;
  questionId?: string;            // maps to an IntakeQuestion id
  suggestedValue?: AnswerValue;
  confidence: 'high' | 'medium' | 'low';
  confidenceScore?: number;       // 0–1
  note?: string;
  evidence?: string;
  mediaIndex?: number;
  boundingBox?: [number, number, number, number];
}

export interface AiAnalysisRecord {
  id: string;
  imageCount: number;
  focusPrompt?: string;
  verticalId?: string;
  summary: string;
  suggestedAdjustments: SuggestedAdjustment[];
  creditsUsed: number;
  createdAt: string;              // ISO timestamp
  // Failure info (populated when analysis errored)
  failed?: boolean;
  failureType?: AiFailureType;
  errorMessage?: string;
}

export type AiFailureType =
  | 'missing_api_key'
  | 'provider_unavailable'
  | 'no_credits'
  | 'offline'
  | 'timeout'
  | 'unsupported_media'
  | 'oversized_media'
  | 'parse_failure'
  | 'invalid_site_photo'
  | 'unknown';

// ─── AI scan history (persisted checkpoint per estimate) ──────────────────

export interface EvidenceEntry {
  value: AnswerValue;
  confidence?: number;          // 0–1
  evidence?: string;
  mediaIndex?: number;
  boundingBox?: [number, number, number, number];
}

export interface AiScanRecord {
  id: string;
  estimateId: string;
  createdAt: string;            // ISO timestamp
  summary: string;
  answersSnapshot: Record<string, AnswerValue>;
  evidenceByQuestion: Record<string, EvidenceEntry>;
}

// ─── AI credits / analysis history ────────────────────────────────────────

export interface CreditBalance {
  balance: number;
  updatedAt: string;
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

// ─── AI credit packs (for purchase flow) ─────────────────────────────────

export interface AiCreditPack {
  id: string;
  label: string;
  credits: number;
  price: number;                // USD cents
  priceLabel: string;           // e.g. "$4.99"
  popular?: boolean;
}

export const AI_CREDIT_PACKS: AiCreditPack[] = [
  { id: 'pack_100', label: '100 Credits',  credits: 100,  price: 499,  priceLabel: '$4.99' },
  { id: 'pack_500', label: '500 Credits',  credits: 500,  price: 1999, priceLabel: '$19.99', popular: true },
  { id: 'pack_1200',label: '1200 Credits', credits: 1200, price: 3999, priceLabel: '$39.99' },
];

export const AI_CREDITS_LOW_THRESHOLD = 10;  // amber warning below this

export interface AutoReloadSettings {
  enabled: boolean;
  packId: string;               // which pack to auto-purchase
  threshold: number;            // reload when balance drops below this
}

export interface AiCreditSettings {
  autoReload: AutoReloadSettings;
  stripeCustomerId?: string;    // set after first purchase
}

// ─── Follow-up / workflow types (Phase 6+) ──────────────────────────────────

export type FollowUpStatus =
  | 'lead_new'
  | 'quote_in_progress'
  | 'quote_sent'
  | 'follow_up_due'
  | 'awaiting_customer'
  | 'appointment_scheduled'
  | 'won'
  | 'lost';

export const FOLLOW_UP_LABELS: Record<FollowUpStatus, string> = {
  lead_new:              'New Lead',
  quote_in_progress:     'In Progress',
  quote_sent:            'Quote Sent',
  follow_up_due:         'Follow-up Due',
  awaiting_customer:     'Awaiting Customer',
  appointment_scheduled: 'Appt. Scheduled',
  won:                   'Won',
  lost:                  'Lost',
};

export type LeadUrgency = 'asap' | 'this_week' | 'this_month' | 'flexible';

export const LEAD_URGENCY_LABELS: Record<LeadUrgency, string> = {
  asap:       'ASAP',
  this_week:  'This Week',
  this_month: 'This Month',
  flexible:   'Flexible',
};

export type ReminderType =
  | 'estimate_followup'
  | 'callback'
  | 'appointment'
  | 'invoice_reminder'
  | 'checkin';

export const REMINDER_TYPE_LABELS: Record<ReminderType, string> = {
  estimate_followup: 'Estimate Follow-up',
  callback:          'Callback Needed',
  appointment:       'Appointment Reminder',
  invoice_reminder:  'Invoice Reminder',
  checkin:           'Check-in',
};

export interface Reminder {
  id: string;
  customerId?: string;
  customerName?: string;        // denormalized for display
  estimateId?: string;
  type: ReminderType;
  dueDate: string;              // ISO date string
  note: string;
  completed: boolean;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type CommTemplateType =
  | 'estimate_followup'
  | 'estimate_send'
  | 'invoice_send'
  | 'appointment_reminder'
  | 'checkin'
  | 'invoice_reminder'
  | 'payment_reminder'
  | 'missed_call';

export const COMM_TEMPLATE_TYPE_LABELS: Record<CommTemplateType, string> = {
  estimate_followup:    'Estimate Follow-up',
  estimate_send:        'Send Estimate',
  invoice_send:         'Send Invoice',
  appointment_reminder: 'Appointment Reminder',
  checkin:              'Check-in',
  invoice_reminder:     'Invoice Reminder',
  payment_reminder:     'Payment Reminder',
  missed_call:          'Missed Call Callback',
};

// ─── Communication intent (Phase 15B) ─────────────────────────────────────────

export type CommIntent =
  | 'estimate_send'
  | 'invoice_send'
  | 'follow_up'
  | 'appointment_reminder'
  | 'payment_reminder'
  | 'callback_follow_up'
  | 'general';

export const COMM_INTENT_LABELS: Record<CommIntent, string> = {
  estimate_send:        'Send Estimate',
  invoice_send:         'Send Invoice',
  follow_up:            'Follow Up',
  appointment_reminder: 'Appointment Reminder',
  payment_reminder:     'Payment Reminder',
  callback_follow_up:   'Callback Follow-up',
  general:              'General Message',
};

export interface CommTemplate {
  id: string;
  name: string;
  type: CommTemplateType;
  subject: string;
  body: string;           // {customer_name} {business_name} {estimate_number} {price_range} {address}
  isDefault: boolean;
  updatedAt: string;
}

export type TimelineEventType =
  | 'intake_created'
  | 'estimate_created'
  | 'quote_sent'
  | 'estimate_sent'
  | 'invoice_sent'
  | 'followup_scheduled'
  | 'followup_sent'
  | 'reminder_sent'
  | 'payment_reminder_sent'
  | 'reminder_completed'
  | 'invoice_created'
  | 'status_changed'
  | 'note_added'
  | 'won'
  | 'lost'
  // Payment events (Phase 12+)
  | 'payment_requested'
  | 'payment_received'
  | 'payment_plan_created';

export const TIMELINE_EVENT_LABELS: Record<TimelineEventType, string> = {
  intake_created:         'Lead created',
  estimate_created:       'Estimate created',
  quote_sent:             'Quote sent',
  estimate_sent:          'Estimate sent',
  invoice_sent:           'Invoice sent',
  followup_scheduled:     'Follow-up scheduled',
  followup_sent:          'Follow-up sent',
  reminder_sent:          'Reminder sent',
  payment_reminder_sent:  'Payment reminder sent',
  reminder_completed:     'Reminder completed',
  invoice_created:        'Invoice created',
  status_changed:         'Status changed',
  note_added:             'Note added',
  won:                    'Marked as Won',
  lost:                   'Marked as Lost',
  payment_requested:      'Payment requested',
  payment_received:       'Payment received',
  payment_plan_created:   'Payment plan created',
};

export interface TimelineEvent {
  id: string;
  customerId: string;
  estimateId?: string;
  invoiceId?: string;
  type: TimelineEventType;
  note?: string;
  createdAt: string;
}

export interface IntakeDraft {
  id: string;
  customerName: string;
  phone: string;
  email: string;
  propertyAddress: string;
  serviceType: string;
  urgency: LeadUrgency;
  notes: string;
  referralSource?: string;
  status: 'new' | 'converted' | 'archived';
  followUpStatus: FollowUpStatus;
  customerId?: string;          // set after converting to customer
  estimateId?: string;          // set after converting to estimate
  lastContactAt?: string;
  nextActionAt?: string;
  nextActionNote?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Payment architecture (Phase 12+) ─────────────────────────────────────
// SERVICE PAYMENTS: customer pays for real-world roofing/service work.
// APP MONETIZATION: business user pays for software features (separate module).

// --- Service payment types -----------------------------------------------

export type ServicePaymentStatus =
  | 'pending'        // request created, not yet paid
  | 'partially_paid' // some amount received
  | 'paid'           // fully settled
  | 'cancelled';

export const SERVICE_PAYMENT_STATUS_LABELS: Record<ServicePaymentStatus, string> = {
  pending:        'Pending',
  partially_paid: 'Partially Paid',
  paid:           'Paid',
  cancelled:      'Cancelled',
};

export type DepositType = 'none' | 'fixed' | 'percentage';

/** A payment request attached to an accepted estimate or invoice. */
export interface PaymentRequest {
  id: string;
  estimateId?: string;
  invoiceId?: string;
  customerId?: string;
  depositType: DepositType;
  depositAmount?: number;         // flat dollar amount (when depositType === 'fixed')
  depositPct?: number;            // 0–1 fraction (when depositType === 'percentage')
  totalDue: number;               // full amount requested
  status: ServicePaymentStatus;
  amountPaid: number;             // cumulative paid so far
  payments: ServicePaymentRecord[]; // individual payment receipts
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/** One recorded payment against a PaymentRequest or Invoice. */
export interface ServicePaymentRecord {
  id: string;
  paymentRequestId?: string;
  invoiceId?: string;
  amount: number;
  method?: string;                // 'check' | 'cash' | 'card' | 'transfer' | 'other'
  referenceNumber?: string;       // check #, transaction ID, etc.
  note?: string;
  recordedAt: string;             // ISO timestamp
}

// --- Payment plan types --------------------------------------------------

export type PaymentPlanStatus = 'active' | 'completed' | 'cancelled';

export type PaymentStageStatus = 'pending' | 'paid' | 'overdue';

export interface PaymentStage {
  id: string;
  label: string;                  // e.g. "Deposit", "Progress Payment", "Final Balance"
  amount: number;
  dueDate?: string;               // ISO date; optional
  status: PaymentStageStatus;
  paidAt?: string;
  note?: string;
}

/** A milestone-based or installment-based payment plan tied to a service job. */
export interface PaymentPlan {
  id: string;
  estimateId?: string;
  invoiceId?: string;
  customerId?: string;
  name: string;                   // e.g. "3-Part Roofing Plan"
  totalAmount: number;
  stages: PaymentStage[];
  status: PaymentPlanStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// --- App monetization types (separate from service payments) --------------
// These apply to the business operator's use of the app software,
// NOT to customer payments for real-world service jobs.

export type AppPlanTier = 'free' | 'starter' | 'pro' | 'enterprise';

export const APP_PLAN_LABELS: Record<AppPlanTier, string> = {
  free:       'Free',
  starter:    'Starter',
  pro:        'Pro',
  enterprise: 'Enterprise',
};

export type AppSubscriptionState = 'active' | 'trialing' | 'past_due' | 'cancelled' | 'none';

export interface AppSubscriptionStatus {
  tier: AppPlanTier;
  state: AppSubscriptionState;
  expiresAt?: string;             // ISO timestamp; undefined = no expiry (free)
  // Feature entitlements
  aiCreditsIncluded: number;      // credits per billing period; 0 on free
  maxEstimates?: number;          // undefined = unlimited
  maxCustomers?: number;
  premiumPricingRules: boolean;
  customVerticals: boolean;
  paymentPlans: boolean;
  prioritySupport: boolean;
  // Provider reference (future hookup)
  providerCustomerId?: string;    // RevenueCat / App Store customer ID
  providerSubscriptionId?: string;
}

// ─── Sync status ────────────────────────────────────────────────────────────
// Used to show users whether data is saved locally, syncing, or failed.

export type SyncState = 'saved_local' | 'syncing' | 'synced' | 'sync_failed';

export interface SyncStatus {
  state: SyncState;
  lastSyncedAt?: string;        // ISO timestamp of last successful sync
  errorMessage?: string;
}

// ─── Org / workspace (Phase 5+ multi-company groundwork) ──────────────────
// Currently single-user; this stub prepares for future org model.
// TODO: When multi-company is needed, expand this into a full Org entity.

export type UserRole = 'owner' | 'admin' | 'estimator' | 'viewer';

export interface OrgWorkspace {
  // TODO: Populated when company/team features are enabled.
  workspaceId?: string;         // unique per company; undefined = personal/solo mode
  workspaceName?: string;
  userRole?: UserRole;
  // owner uid for future billing/permission scoping
  ownerUid?: string;
}
