import { type ReactNode, useContext } from 'react';
import { Provider, ReactReduxContext } from 'react-redux';
import { store as standaloneStore } from '@/store';
import { Toaster } from '@/components/ui/toaster';
import '@/i18n'; // Ensure our i18n bundles are registered (standalone or embedded).
import '@/index.css'; // Federation injects this stylesheet into the host.

// ---------------------------------------------------------------------------
// EmbedProvider — the wrapper every EXPOSED module renders inside.
//
// THE EMBED PROBLEM: an exposed component might be mounted by a host that
// already has a Redux <Provider> (the shell) OR by a host that does NOT
// (a bare federation consumer, or our own dev harness which provides its own).
// Our RTK Query hooks need SOME store. To be robust we:
//   - detect whether a parent <Provider> is already present, and only mount our
//     own standalone store as a FALLBACK when there isn't one.
// This keeps a single store when embedded (the shell's) and still works when
// mounted bare.
//
// It also mounts a scoped <Toaster /> so toasts render regardless of host.
// ---------------------------------------------------------------------------

/**
 * True when a react-redux <Provider> already exists above us. We read the
 * ReactReduxContext directly (a non-throwing check) — its value is `null` when
 * no Provider is mounted.
 */
function useHasReduxProvider(): boolean {
  const ctx = useContext(ReactReduxContext);
  return ctx !== null;
}

function Inner({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Toaster />
    </>
  );
}

export function EmbedProvider({ children }: { children: ReactNode }) {
  const hasProvider = useHasReduxProvider();
  if (hasProvider) {
    // Embedded under the shell's store — reuse it.
    return <Inner>{children}</Inner>;
  }
  // No host store — provide our own standalone one.
  return (
    <Provider store={standaloneStore}>
      <Inner>{children}</Inner>
    </Provider>
  );
}
