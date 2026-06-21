// ---------------------------------------------------------------------------
// AUTH CONTRACT between this remote and the shell host.
//
// This MFE never logs a user in. It borrows the shell's session. There are two
// supported ways to obtain the JWT, tried in priority order:
//
//   1. window.__SECUREBANK__ — when embedded, the shell may mirror its live
//      token onto this global (and/or install a getToken() accessor). This is
//      the freshest source because it follows the shell's in-memory store
//      after a token refresh, with no storage round-trip.
//
//   2. localStorage[STORAGE_KEY] — the shared, documented key the shell writes
//      its token under. This is the source used in STANDALONE dev (no shell)
//      and is the resilient fallback when embedded.
//
// The STORAGE_KEY MUST match the shell's. It is the single most important line
// of the embed contract; see docs/mfe-payments.md.
// ---------------------------------------------------------------------------

/** The shared localStorage key the shell persists its access token under. */
export const STORAGE_KEY = 'securebank_token';

/**
 * Read the current JWT access token, or null if the user is not authenticated.
 * Safe to call in SSR-less browser context only (guards `window`).
 */
export function getToken(): string | null {
  if (typeof window === 'undefined') return null;

  // 1. Prefer the shell-provided global (freshest when embedded).
  const g = window.__SECUREBANK__;
  if (g) {
    if (typeof g.getToken === 'function') {
      const t = g.getToken();
      if (t) return t;
    }
    if (g.token) return g.token;
  }

  // 2. Fall back to the shared localStorage key (standalone + resilient embed).
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Private-mode / disabled storage: treat as unauthenticated.
    return null;
  }
}

// ---------------------------------------------------------------------------
// SILENT REFRESH. The shell persists {user, accessToken, refreshToken} as JSON
// under "securebank.auth". On a 401 we exchange the refresh token for a new
// access token, write it back to the shared channels, and retry — so an expired
// access token self-heals instead of showing "Could not load data".
// ---------------------------------------------------------------------------
const AUTH_BLOB_KEY = 'securebank.auth';
const ALL_TOKEN_KEYS = ['securebank.token', 'securebank_token'];

function readRefreshToken(): string | null {
  try {
    const raw = window.localStorage.getItem(AUTH_BLOB_KEY);
    return raw ? (JSON.parse(raw).refreshToken ?? null) : null;
  } catch {
    return null;
  }
}

function storeRefreshed(accessToken: string, refreshToken: string | null) {
  try {
    for (const k of ALL_TOKEN_KEYS) window.localStorage.setItem(k, accessToken);
    const raw = window.localStorage.getItem(AUTH_BLOB_KEY);
    const blob = raw ? JSON.parse(raw) : {};
    blob.accessToken = accessToken;
    if (refreshToken) blob.refreshToken = refreshToken;
    window.localStorage.setItem(AUTH_BLOB_KEY, JSON.stringify(blob));
  } catch {
    /* non-fatal */
  }
}

/** Exchange the refresh token for a fresh access token. Returns it, or null on failure. */
export async function tryRefreshToken(): Promise<string | null> {
  const refreshToken = readRefreshToken();
  if (!refreshToken) return null;
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.accessToken) {
      storeRefreshed(data.accessToken, data.refreshToken ?? null);
      return data.accessToken as string;
    }
    return null;
  } catch {
    return null;
  }
}

/** Clear the session and bounce to the shell's login. */
export function clearSessionAndRedirect(): void {
  try {
    for (const k of ALL_TOKEN_KEYS) window.localStorage.removeItem(k);
    window.localStorage.removeItem(AUTH_BLOB_KEY);
  } catch {
    /* non-fatal */
  }
  if (typeof window !== 'undefined') window.location.href = '/login';
}
