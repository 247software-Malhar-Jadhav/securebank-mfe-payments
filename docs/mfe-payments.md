# Payments micro-frontend — architecture & contracts

`securebank-mfe-payments` is a **Module Federation remote**. The
`securebank-shell` host fetches its `remoteEntry.js` at runtime and stitches its
screens into the shell's routing and layout.

## 1. What it exposes (the remote contract)

| Specifier (after `mfe_payments/`) | Local entry                  | Export                  |
| --------------------------------- | ---------------------------- | ----------------------- |
| `./Transfer`                      | `src/exposes/Transfer.tsx`      | default React component |
| `./Beneficiaries`                 | `src/exposes/Beneficiaries.tsx` | default React component |

Federation identity:

- **name**: `mfe_payments`
- **filename**: `remoteEntry.js` (served at `/assets/remoteEntry.js`)
- **dev/preview URL**: `http://localhost:5172/assets/remoteEntry.js`
- **build target**: `esnext` (required by the federation plugin's top-level
  await / dynamic import output)

Shared **singletons** (must be exactly one copy across the federation; versions
mirror the shell): `react`, `react-dom`, `react-router-dom`, `react-i18next`,
`i18next`, `@reduxjs/toolkit`, `react-redux`.

The shell consumes them as:

```tsx
const Transfer = React.lazy(() => import('mfe_payments/Transfer'));
const Beneficiaries = React.lazy(() => import('mfe_payments/Beneficiaries'));
```

## 2. Consuming-shell auth contract

This MFE never authenticates a user. It **borrows the shell's session**. The
JWT is resolved by `src/lib/auth.ts` in priority order:

1. **`window.__SECUREBANK__`** — when embedded, the shell may mirror its live
   token here, optionally via a `getToken()` accessor. Freshest source (follows
   the shell store after a refresh, no storage round-trip).
2. **`localStorage['securebank_token']`** — the shared, documented key the shell
   persists its access token under. Used in **standalone** dev and as the
   resilient fallback when embedded.

> The `STORAGE_KEY` constant in `src/lib/auth.ts` **must** equal the key the
> shell writes. It is the single most important line of the embed contract.

Every RTK Query request (see `src/store/api.ts`) attaches:

- `Authorization: Bearer <jwt>`
- `Accept-Language: <i18next.language>` — so the backend localizes its RFC-7807
  `detail` messages (and notification copy) to the user's language. Because
  `react-i18next`/`i18next` are singletons, the shell's language switch drives
  this header automatically when embedded.

All REST traffic targets the **same-origin** `/api` prefix; the dev Vite proxy
(or the shell's proxy when embedded, or nginx in prod) forwards to the gateway
on `:8080`. The remote never hardcodes the gateway host.

## 3. Standalone vs embedded

| Concern        | Standalone (`:5172`)                          | Embedded (in shell)                                  |
| -------------- | --------------------------------------------- | ---------------------------------------------------- |
| Entry          | `src/main.tsx` dev harness                    | shell imports `mfe_payments/Transfer` etc.           |
| Redux store    | own store (`src/store`)                        | reuses the shell's store (detected via context)      |
| Router         | own `<BrowserRouter>` (`src/dev/App.tsx`)      | shell's router                                       |
| i18n           | this MFE inits i18next with en/hi/mr           | shell already inited; we only `addResourceBundle`    |
| JWT            | `localStorage['securebank_token']`             | `window.__SECUREBANK__` first, then localStorage     |
| `/api` proxy   | Vite dev proxy / nginx                         | shell's proxy                                        |

`src/exposes/EmbedProvider.tsx` makes the exposed components robust to either
case: it checks for an existing `ReactReduxContext` and only mounts the MFE's
**own** store as a fallback when no host store is present. It also mounts a
scoped `<Toaster />` and ensures the i18n bundles are registered. So an exposed
component works whether the host wraps it in a `<Provider>` or not.

## 4. The transfer flow (and how errors render)

```mermaid
sequenceDiagram
    participant U as User
    participant T as Transfer screen
    participant API as RTK Query (/api)
    participant GW as Gateway :8080
    participant TX as transaction-service

    U->>T: pick from-account, beneficiary, amount, submit
    T->>T: zod validation (localized) — blocks if invalid
    T->>API: POST /api/transactions/transfer<br/>Authorization + Accept-Language
    API->>GW: forward
    GW->>TX: Transfer saga (fraud → debit → credit → ledger → Kafka)

    alt COMPLETED (HTTP 201)
        TX-->>T: { reference, status:"COMPLETED", sourceBalanceAfter }
        T-->>U: success panel: reference + new balance (Intl.NumberFormat)
    else REJECTED (HTTP 422)
        TX-->>T: { status:"REJECTED", reason:"FRAUD_BLOCK"|"INSUFFICIENT_FUNDS"|... }
        T-->>U: destructive toast (localized message keyed by reason)
    else FAILED (HTTP 502)
        TX-->>T: { status:"FAILED", reason:"...;COMPENSATION_*" }
        T-->>U: destructive toast ("transfer failed, amount refunded")
    else Bad input / not found (HTTP 400/404)
        GW-->>T: RFC-7807 ProblemDetail (detail already localized by backend)
        T-->>U: destructive toast (problem.detail verbatim)
    end
```

### Two error shapes — important nuance

The transaction-service does **not** wrap business rejections in RFC-7807. From
`TransactionController`:

- **201** → `TransferResponseDto` with `status:"COMPLETED"`.
- **422** → `TransferResponseDto` with `status:"REJECTED"` and a machine
  `reason` such as `FRAUD_BLOCK` (fraud `Score` returned `BLOCK`) or
  `INSUFFICIENT_FUNDS` (account-service `Debit` declined).
- **502** → `TransferResponseDto` with `status:"FAILED"` (a downstream step
  failed and the saga compensated).
- **400 / 404** → a genuine RFC-7807 `ProblemDetail` (bean validation / unknown
  reference), whose `detail` the backend already localized via
  `Accept-Language`.

`src/lib/errors.ts#describeTransferError` handles both:

- For 422/502 it reads `error.data.reason`, takes the first `;`/`:`-delimited
  segment (the saga can emit compound reasons like
  `INSUFFICIENT_FUNDS;COMPENSATION_FAILED:...`), and maps the code to a friendly
  **localized** string from the i18n bundle
  (`transfer.error.FRAUD_BLOCK`, `transfer.error.INSUFFICIENT_FUNDS`, …), with a
  status-level fallback (`transfer.error.FAILED` / `transfer.error.generic`).
- For 400/404 it surfaces `problem.detail` verbatim (already localized).
- For 401/403 it shows `transfer.error.unauthorized` (session expired).

#### Concrete example — a fraud BLOCK

1. User submits a transfer the fraud-service scores as `BLOCK`.
2. The saga short-circuits (no money moves) and the controller returns **422**
   `{ status:"REJECTED", reason:"FRAUD_BLOCK", fraudScore:0.9x, sourceBalanceAfter:null }`.
3. RTK Query treats non-2xx as an error; `.unwrap()` throws.
4. The screen calls `describeTransferError`, which maps `FRAUD_BLOCK` to the
   localized copy ("This transfer was blocked by our fraud checks…").
5. A **destructive toast** appears; no success panel is shown; the form keeps
   its values so the user can adjust.

#### Concrete example — insufficient funds

Same path, but `reason:"INSUFFICIENT_FUNDS"` → localized "Insufficient funds in
the selected account." The form's zod schema also caps the amount at the
selected account's live balance, so most of these are caught client-side first;
the server check is authoritative.

## 5. Money & i18n

- All amounts are formatted with `Intl.NumberFormat` via `lib/utils#formatMoney`
  (`localeForLanguage` maps `hi`/`mr` → `hi-IN`/`mr-IN` for Indian grouping).
- Strings live in `src/i18n/locales/{en,hi,mr}.json` under the `payments`
  namespace; Hindi/Marathi are real Devanagari. Validation messages are
  localized too (`validation.*`).

## 6. REST endpoints consumed

| Method | Path                          | Used by         | Shape                                  |
| ------ | ----------------------------- | --------------- | -------------------------------------- |
| GET    | `/api/accounts`               | Transfer        | `Account[]` (mirrors `AccountDto`)     |
| GET    | `/api/beneficiaries`          | Beneficiaries / Transfer | `Beneficiary[]`               |
| POST   | `/api/beneficiaries`          | Beneficiaries   | `CreateBeneficiaryRequest → Beneficiary` |
| POST   | `/api/transactions/transfer`  | Transfer        | `TransferRequest → TransferResponse`   |

> **Note:** `/api/accounts`, `/api/transactions/transfer` are defined by the
> account- and transaction-services. `/api/beneficiaries` is the beneficiary
> contract this MFE expects from the gateway; types are in `src/types/api.ts`.
