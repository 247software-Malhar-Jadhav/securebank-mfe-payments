import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import type { TFunction } from 'i18next';
import type { ProblemDetail, TransferResponse } from '@/types/api';

// ---------------------------------------------------------------------------
// Turn an RTK Query error into a user-facing, LOCALIZED message.
//
// The transaction-service has two distinct error shapes (see types/api.ts):
//   - 422 / 502  -> a TransferResponse body with a machine `reason` code such
//                   as FRAUD_BLOCK or INSUFFICIENT_FUNDS. We map the code to a
//                   localized string from our i18n bundle so the copy is
//                   friendly and translated even though the code is in English.
//   - 400 / 404  -> an RFC-7807 ProblemDetail whose `detail` is ALREADY
//                   localized by the backend (it honoured Accept-Language).
//                   We surface that text directly.
// Anything else falls back to a generic localized message.
// ---------------------------------------------------------------------------

/** Type guard: does this error carry a transfer-style body with a `reason`? */
function isTransferErrorBody(data: unknown): data is TransferResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'status' in data &&
    'reason' in data
  );
}

/** Type guard for an RFC-7807 problem detail. */
function isProblemDetail(data: unknown): data is ProblemDetail {
  return (
    typeof data === 'object' &&
    data !== null &&
    ('detail' in data || 'title' in data || 'type' in data)
  );
}

/**
 * Map a transfer `reason` code to a localized message. The reason may be a
 * compound like "INSUFFICIENT_FUNDS;COMPENSATION_FAILED:..." from the saga, so
 * we key off the FIRST segment and fall back to a generic FAILED/insufficient
 * message.
 */
function messageForReason(reason: string | null, status: string, t: TFunction): string {
  const code = (reason ?? '').split(/[;:]/)[0].trim().toUpperCase();
  const key = `transfer.error.${code}`;
  const translated = t(key);
  // i18next returns the key itself when there is no entry; detect that.
  if (translated !== key) return translated;
  // No specific copy for this code: use the status-level fallback.
  if (status === 'FAILED') return t('transfer.error.FAILED');
  return t('transfer.error.generic');
}

/**
 * Resolve an RTK Query error into a localized title + body for a toast/alert.
 */
export function describeTransferError(
  error: FetchBaseQueryError | { status?: unknown } | undefined,
  t: TFunction,
): { title: string; body: string } {
  const title = t('transfer.error.title');

  if (!error) return { title, body: t('transfer.error.generic') };

  // Network / fetch errors have a string status like 'FETCH_ERROR'.
  const status = (error as FetchBaseQueryError).status;

  if (status === 401 || status === 403) {
    return { title, body: t('transfer.error.unauthorized') };
  }

  const data = (error as { data?: unknown }).data;

  if (isTransferErrorBody(data)) {
    return { title, body: messageForReason(data.reason, data.status, t) };
  }

  if (isProblemDetail(data) && data.detail) {
    // Backend already localized this string.
    return { title, body: String(data.detail) };
  }

  return { title, body: t('transfer.error.generic') };
}

/** Generic localized message for a non-transfer error (e.g. add beneficiary). */
export function describeError(
  error: FetchBaseQueryError | { status?: unknown } | undefined,
  t: TFunction,
): string {
  if (!error) return t('common.loadingError');
  const status = (error as FetchBaseQueryError).status;
  if (status === 401 || status === 403) return t('transfer.error.unauthorized');
  const data = (error as { data?: unknown }).data;
  if (isProblemDetail(data) && data.detail) return String(data.detail);
  return t('common.loadingError');
}
