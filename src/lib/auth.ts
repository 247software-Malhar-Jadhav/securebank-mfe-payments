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
