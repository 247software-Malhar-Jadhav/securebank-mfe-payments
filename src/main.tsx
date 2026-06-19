import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';

import App from '@/dev/App';
import { store } from '@/store';
import '@/i18n';
import '@/index.css';

// ---------------------------------------------------------------------------
// STANDALONE BOOTSTRAP (dev harness entry).
//
// This file is the entry point ONLY for running the MFE on its own at :5172.
// It provides the things a host would otherwise provide:
//   - a Redux <Provider> (our standalone store)
//   - a <BrowserRouter> (one history)
//   - i18n init (side-effect import above)
//   - the global stylesheet
//
// When consumed by the shell, the shell imports `mfe_payments/Transfer` /
// `mfe_payments/Beneficiaries` directly; this main.tsx is NOT part of the
// federated bundle.
// ---------------------------------------------------------------------------

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Provider>
  </React.StrictMode>,
);
