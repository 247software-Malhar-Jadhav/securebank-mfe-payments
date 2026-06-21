import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';
import i18n from '@/i18n';
import { getToken, tryRefreshToken, clearSessionAndRedirect } from '@/lib/auth';
import type {
  Account,
  Beneficiary,
  CreateBeneficiaryRequest,
  TransferRequest,
  TransferResponse,
} from '@/types/api';

// ---------------------------------------------------------------------------
// RTK Query api slice — the single typed gateway to /api/* for this MFE.
//
// REQUEST CONTRACT (applied to every call by prepareHeaders):
//   - Authorization: Bearer <jwt>   — token resolved via the shell auth
//     contract (lib/auth.ts). Works standalone and embedded.
//   - Accept-Language: <i18n lang>  — so the backend localizes RFC-7807
//     `detail` messages (and notification copy) to the user's language.
//
// All REST traffic goes to the SAME-ORIGIN `/api` prefix; in dev the Vite
// proxy (or the shell's proxy when embedded) forwards to the gateway :8080,
// in prod nginx does. We therefore use a relative baseUrl and never hardcode
// the gateway host.
// ---------------------------------------------------------------------------

const rawBaseQuery = fetchBaseQuery({
  baseUrl: '/api',
  prepareHeaders: (headers) => {
    const token = getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    // i18n.language reflects the live language; the shell drives it when embedded
    // because react-i18next is a shared singleton.
    headers.set('Accept-Language', i18n.language || 'en');
    return headers;
  },
});

/**
 * Wrapper that adds silent refresh-on-401: if the access token expired, exchange the
 * refresh token for a new one, write it to the shared channel, and retry the request.
 * If refresh is impossible, bounce to login rather than dead-ending on "Could not load".
 */
const baseQuery: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, apiSlice, extraOptions) => {
  let result = await rawBaseQuery(args, apiSlice, extraOptions);
  if (result.error && result.error.status === 401) {
    const fresh = await tryRefreshToken();
    if (fresh) {
      result = await rawBaseQuery(args, apiSlice, extraOptions);
    } else {
      clearSessionAndRedirect();
    }
  }
  return result;
};

export const paymentsApi = createApi({
  reducerPath: 'paymentsApi',
  baseQuery,
  // Cache invalidation tags so adding a beneficiary refreshes the list and a
  // completed transfer refreshes balances.
  tagTypes: ['Account', 'Beneficiary'],
  endpoints: (builder) => ({
    // ----- Accounts (read) -------------------------------------------------
    getAccounts: builder.query<Account[], void>({
      query: () => '/accounts',
      providesTags: ['Account'],
    }),

    // ----- Beneficiaries (read + create) ----------------------------------
    getBeneficiaries: builder.query<Beneficiary[], void>({
      query: () => '/beneficiaries',
      providesTags: ['Beneficiary'],
    }),
    addBeneficiary: builder.mutation<Beneficiary, CreateBeneficiaryRequest>({
      query: (body) => ({
        url: '/beneficiaries',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Beneficiary'],
    }),

    // ----- Transfer (command) ---------------------------------------------
    // NOTE: the transaction-service returns 422 (REJECTED) / 502 (FAILED) with
    // a TransferResponse body for business outcomes. RTK Query treats non-2xx
    // as an error, so the component reads `error.data` (a TransferResponse for
    // 422/502, or a ProblemDetail for 400/404) to render the right message.
    transfer: builder.mutation<TransferResponse, TransferRequest>({
      query: (body) => ({
        url: '/transactions/transfer',
        method: 'POST',
        body,
      }),
      // A successful transfer changes the source balance -> refresh accounts.
      invalidatesTags: (_result, error) => (error ? [] : ['Account']),
    }),
  }),
});

export const {
  useGetAccountsQuery,
  useGetBeneficiariesQuery,
  useAddBeneficiaryMutation,
  useTransferMutation,
} = paymentsApi;
