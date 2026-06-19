// ---------------------------------------------------------------------------
// Strong types for the REST surface this MFE consumes. These mirror the
// backend DTOs (account-service AccountDto, transaction-service Transfer
// DTOs) and the beneficiary contract documented in docs/mfe-payments.md.
// ---------------------------------------------------------------------------

/** GET /api/accounts — one funding/destination account. Mirrors AccountDto. */
export interface Account {
  id: string;
  accountNumber: string;
  customerId: string;
  type: string; // CHECKING | SAVINGS | ...
  currency: string; // ISO-4217
  balance: number; // BigDecimal-as-number on the wire
  status: string; // ACTIVE | FROZEN | ...
}

/** GET /api/beneficiaries — a saved payee. */
export interface Beneficiary {
  id: string;
  name: string;
  accountNumber: string;
  /** Optional bank routing identifier (IFSC in India). */
  ifsc?: string;
  /** Optional nickname shown in the picker. */
  nickname?: string;
}

/** POST /api/beneficiaries request body. */
export interface CreateBeneficiaryRequest {
  name: string;
  accountNumber: string;
  ifsc?: string;
  nickname?: string;
}

/** POST /api/transactions/transfer request body. Mirrors TransferRequestDto. */
export interface TransferRequest {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  currency: string;
  description?: string;
}

/** Terminal status of a transfer, as returned by the transaction-service. */
export type TransferStatus = 'COMPLETED' | 'REJECTED' | 'FAILED';

/**
 * POST /api/transactions/transfer response body. Mirrors TransferResponseDto.
 *
 * IMPORTANT contract nuance: a business rejection (INSUFFICIENT_FUNDS, fraud
 * BLOCK) does NOT come back as an RFC-7807 problem — it comes back as HTTP 422
 * with THIS body where `status === 'REJECTED'` and `reason` is a machine code
 * such as "FRAUD_BLOCK" or "INSUFFICIENT_FUNDS". HTTP 502 => `status === 'FAILED'`.
 * Only malformed input / unknown reference produce a true ProblemDetail.
 */
export interface TransferResponse {
  reference: string;
  status: TransferStatus;
  /** Machine reason code, e.g. INSUFFICIENT_FUNDS, FRAUD_BLOCK, DEBIT_DECLINED. */
  reason: string | null;
  fraudScore: number; // 0.0 safe .. 1.0 fraud
  sourceBalanceAfter: number | null;
}

/**
 * RFC-7807 ProblemDetail, as produced by Spring's `ProblemDetail`. The gateway
 * forwards these for validation (400) and not-found (404) cases. `detail` is
 * already localized by the backend (it honours our Accept-Language header).
 */
export interface ProblemDetail {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  // Spring may attach extra members; keep them addressable.
  [key: string]: unknown;
}
