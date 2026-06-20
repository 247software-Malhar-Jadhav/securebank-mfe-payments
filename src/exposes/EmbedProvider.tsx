import { type ReactNode } from 'react';
import { Provider } from 'react-redux';
import { store as standaloneStore } from '@/store';
import { Toaster } from '@/components/ui/toaster';
import '@/i18n'; // Ensure our i18n bundles are registered (standalone or embedded).
import '@/index.css'; // Federation injects this stylesheet into the host.

// ---------------------------------------------------------------------------
// EmbedProvider — the wrapper every EXPOSED module renders inside.
//
// WHY WE ALWAYS MOUNT OUR OWN STORE (even when embedded):
//   Our screens use paymentsApi RTK Query hooks, which only work if the active Redux
//   store has paymentsApi's reducer + middleware. The SHELL's store does NOT register
//   paymentsApi, so reusing it would make every query silently fail (the cause of a
//   blank/non-working Transfer screen). react-redux is a shared singleton, so nesting our
//   own <Provider> cleanly shadows the store for our subtree. Auth is read from the shared
//   token channel (localStorage/window), not store state, so a separate store is fine.
//
// It also mounts a scoped <Toaster /> so toasts render regardless of host.
// ---------------------------------------------------------------------------

function Inner({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Toaster />
    </>
  );
}

export function EmbedProvider({ children }: { children: ReactNode }) {
  return (
    <Provider store={standaloneStore}>
      <Inner>{children}</Inner>
    </Provider>
  );
}
