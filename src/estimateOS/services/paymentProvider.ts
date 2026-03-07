/**
 * services/paymentProvider.ts — Service payment provider adaptor boundary.
 *
 * Handles customer payments for real-world service work (roofing, painting, etc.).
 * Completely separate from app monetization (see appMonetization.ts).
 *
 * Responsibilities:
 *   - Deposit request checkout
 *   - Invoice payment request
 *   - Payment plan execution
 *   - Recording manual (cash/check) payments locally
 *
 * When Stripe (or another provider) is connected, replace the checkout stubs.
 * Manual payment recording works fully offline with local persistence.
 */

import {
  PaymentRequest, ServicePaymentRecord, PaymentPlan,
  InvoicePaymentEvent, Invoice,
} from '../models/types';
import { ServiceResult, ok, blocked, stubMode, providerError } from './ServiceResult';
import { isStripeReady } from './capabilities';
import { PaymentRequestRepository, PaymentPlanRepository } from '../storage/payments';
import { makeId } from '../domain/id';

// ─── Checkout (provider-dependent) ──────────────────────────────────────────

export interface CheckoutInput {
  amount: number;
  customerId?: string;
  estimateId?: string;
  invoiceId?: string;
  description?: string;
}

export interface CheckoutOutput {
  transactionId: string;
  amount: number;
  method: string;
}

/**
 * Initiate a provider-based checkout (e.g. Stripe payment sheet).
 * Returns stub_mode when Stripe is not configured — screens should
 * fall back to manual payment recording.
 */
export async function initiateCheckout(
  input: CheckoutInput,
): Promise<ServiceResult<CheckoutOutput>> {
  const ready = await isStripeReady();
  if (!ready) {
    return stubMode(
      'Online payment is not configured. Record payments manually, or enable Stripe in Settings → Integrations.',
    );
  }

  // TODO: Wire Stripe payment sheet here.
  // Expected flow:
  //   1. Call backend to create PaymentIntent for input.amount
  //   2. Present Stripe payment sheet
  //   3. On success, return CheckoutOutput
  //   4. On cancel, return providerError with 'user_cancelled'
  //   5. On failure, return providerError with Stripe error message
  return stubMode('Stripe payment flow not yet connected.');
}

// ─── Manual payment recording (always works locally) ────────────────────────

/**
 * Record a manual payment (cash, check, transfer) against a PaymentRequest.
 * Works fully offline — no provider required.
 */
export async function recordManualPayment(
  requestId: string,
  amount: number,
  method?: string,
  note?: string,
): Promise<ServiceResult<PaymentRequest>> {
  const result = await PaymentRequestRepository.recordPayment(requestId, {
    amount,
    method,
    note,
    recordedAt: new Date().toISOString(),
  });

  if (!result) {
    return providerError('Payment request not found.');
  }
  return ok(result, `$${amount.toFixed(2)} recorded.`);
}

/**
 * Record a payment against an invoice (local-first).
 * Returns the new InvoicePaymentEvent for the caller to merge into state.
 */
export function createInvoicePaymentEvent(
  amount: number,
  method?: string,
  note?: string,
): InvoicePaymentEvent {
  return {
    id: makeId(),
    amount,
    method,
    note,
    recordedAt: new Date().toISOString(),
  };
}

// ─── Payment plan helpers ───────────────────────────────────────────────────

/**
 * Mark a payment plan stage as paid.
 * Works locally — no provider required.
 */
export async function markStagePaid(
  planId: string,
  stageId: string,
): Promise<ServiceResult<PaymentPlan>> {
  const plan = await PaymentPlanRepository.markStagePaid(planId, stageId);
  if (!plan) return providerError('Payment plan not found.');
  return ok(plan);
}

// ─── Provider status ────────────────────────────────────────────────────────

/**
 * Check whether online checkout is available.
 * Screens use this to show/hide the "Pay Online" button vs "Record Payment" only.
 */
export async function isCheckoutAvailable(): Promise<boolean> {
  return isStripeReady();
}
