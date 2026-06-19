// Ambient declarations so TypeScript is happy about runtime-resolved Module
// Federation imports and the shared global the shell exposes.

// The shell may publish its live auth token (and optionally a getter) on a
// well-known global so embedded remotes can reuse it without re-reading
// localStorage. See docs/mfe-payments.md "Consuming-shell auth".
interface SecureBankGlobal {
  /** Raw JWT access token, if the shell chose to mirror it onto the global. */
  token?: string;
  /** Optional accessor the shell may install for a fresh token each call. */
  getToken?: () => string | null | undefined;
}

interface Window {
  __SECUREBANK__?: SecureBankGlobal;
}
