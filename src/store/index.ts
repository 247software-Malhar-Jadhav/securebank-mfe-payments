import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { paymentsApi } from './api';

// ---------------------------------------------------------------------------
// STANDALONE store. Used only when the MFE runs on its own at :5172 (the dev
// harness in main.tsx provides it). When embedded in the shell, the exposed
// components are wrapped in the SHELL's <Provider>, so this store is not
// mounted — see src/exposes/*.tsx for how each exposed component provides its
// own store fallback so it also works if a host forgets to wrap it.
// ---------------------------------------------------------------------------

export const store = configureStore({
  reducer: {
    [paymentsApi.reducerPath]: paymentsApi.reducer,
  },
  middleware: (getDefault) => getDefault().concat(paymentsApi.middleware),
});

// Enables refetchOnFocus / refetchOnReconnect behaviours.
setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
