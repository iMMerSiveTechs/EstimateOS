/**
 * services/ServiceResult.ts — Standardized result shape for all provider seams.
 *
 * Every service/adaptor call returns a ServiceResult<T>.
 * Screens render based on `status` without custom one-off error handling.
 */

// ─── Result statuses ────────────────────────────────────────────────────────

export type ServiceStatus =
  | 'success'
  | 'partial_success'         // some items succeeded, some failed
  | 'blocked_not_configured'  // provider not set up (API key missing, etc.)
  | 'blocked_not_enabled'     // feature toggled off in settings
  | 'offline'                 // device is offline
  | 'validation_error'        // input failed validation before reaching provider
  | 'provider_error'          // provider returned an error
  | 'stub_mode';              // running in demo/stub mode (no real provider)

// ─── Result shape ───────────────────────────────────────────────────────────

export interface ServiceResult<T = void> {
  status: ServiceStatus;
  /** Present when status === 'success' or 'partial_success'. */
  data?: T;
  /** Human-readable message safe to display in UI. */
  message?: string;
  /** Machine-readable error code for programmatic handling. */
  errorCode?: string;
  /** If true, show a "configure in Settings" CTA. */
  showSetupCta?: boolean;
}

// ─── Helper constructors ────────────────────────────────────────────────────

export function ok<T>(data: T, message?: string): ServiceResult<T> {
  return { status: 'success', data, message };
}

export function okVoid(message?: string): ServiceResult<void> {
  return { status: 'success', message };
}

export function partial<T>(data: T, message: string): ServiceResult<T> {
  return { status: 'partial_success', data, message };
}

export function blocked(reason: 'not_configured' | 'not_enabled', message: string): ServiceResult<never> {
  return {
    status: reason === 'not_configured' ? 'blocked_not_configured' : 'blocked_not_enabled',
    message,
    showSetupCta: reason === 'not_configured',
  };
}

export function offline(message = 'You appear to be offline. Please check your connection.'): ServiceResult<never> {
  return { status: 'offline', message };
}

export function validationError(message: string, errorCode?: string): ServiceResult<never> {
  return { status: 'validation_error', message, errorCode };
}

export function providerError(message: string, errorCode?: string): ServiceResult<never> {
  return { status: 'provider_error', message, errorCode };
}

export function stubMode(message = 'Running in demo mode — no live provider connected.'): ServiceResult<never> {
  return { status: 'stub_mode', message };
}

// ─── Type guards ────────────────────────────────────────────────────────────

export function isOk<T>(r: ServiceResult<T>): r is ServiceResult<T> & { data: T } {
  return r.status === 'success' || r.status === 'partial_success';
}

export function isBlocked(r: ServiceResult<unknown>): boolean {
  return r.status === 'blocked_not_configured' || r.status === 'blocked_not_enabled';
}
