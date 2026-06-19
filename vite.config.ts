import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import federation from '@originjs/vite-plugin-federation';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Vite config for the SecureBank PAYMENTS micro-frontend (a Module Federation
// REMOTE).
//
// WHAT IS A "REMOTE"?
//   In Module Federation one app (the "host" — here the `securebank-shell`)
//   pulls in modules that other apps (the "remotes") publish AT RUNTIME. A
//   remote advertises its public modules through a generated manifest file
//   called `remoteEntry.js`. The host fetches that file over HTTP and then
//   dynamically imports whichever exposed module it wants (e.g.
//   `import('mfe_payments/Transfer')`). This is the micro-frontend pattern:
//   payments ships on its own cadence; the shell stitches it in.
//
// THIS REMOTE EXPOSES two default-exported React components:
//   ./Transfer       — the money-transfer form screen
//   ./Beneficiaries  — the saved-payees list + add dialog screen
//
// WHY `build.target = 'esnext'`?
//   `@originjs/vite-plugin-federation` emits top-level-await + dynamic-import
//   shaped output. That only compiles cleanly when the build target is
//   `esnext`; a lower target makes Vite refuse the build or emit a broken
//   remoteEntry.
//
// WHY CORS on the dev server?
//   When the shell (running on :5170) loads this remote in dev, the browser
//   fetches http://localhost:5172/assets/remoteEntry.js cross-origin. Without
//   permissive CORS headers that fetch is blocked. In production nginx adds
//   the same headers (see nginx.conf).
// ---------------------------------------------------------------------------

export default defineConfig({
  plugins: [
    react(),
    federation({
      // Federation name. The shell references our modules as
      // `mfe_payments/Transfer` and `mfe_payments/Beneficiaries`; this MUST
      // match the key the shell uses in its `remotes` map.
      name: 'mfe_payments',

      // The manifest file name. Default is `remoteEntry.js`; we state it
      // explicitly so it is part of the documented contract. It is emitted to
      // `dist/assets/remoteEntry.js`.
      filename: 'remoteEntry.js',

      // ----- The modules we PUBLISH to the host ----------------------------
      // Keys are the public import specifiers (after the `mfe_payments/`
      // prefix); values are the local entry files. Each file MUST have a
      // `default` export that is a React component, because the shell lazy-
      // loads them with React.lazy(() => import('mfe_payments/Transfer')).
      exposes: {
        './Transfer': './src/exposes/Transfer.tsx',
        './Beneficiaries': './src/exposes/Beneficiaries.tsx',
      },

      // ----- Shared singletons ---------------------------------------------
      // `singleton: true` => the whole federation loads EXACTLY ONE copy of
      // each of these. This is mandatory for:
      //   - react / react-dom : two Reacts => "invalid hook call".
      //   - react-router-dom  : one history / router context.
      //   - react-i18next     : one translation registry (so the shell's
      //                         language switch drives our strings too).
      //   - @reduxjs/toolkit + react-redux : one store context when embedded.
      // The versions mirror the shell's `shared` block so the runtime does not
      // warn about a version mismatch.
      //
      // NOTE on the cast: the plugin's bundled .d.ts has `singleton` commented
      // out of `SharedConfig`, but the option IS honoured at runtime (it is the
      // standard Module Federation API and the shell uses the identical shape).
      // We cast so strict `tsc -b` accepts the correct runtime config.
      shared: {
        react: { singleton: true, requiredVersion: '^18.3.1' },
        'react-dom': { singleton: true, requiredVersion: '^18.3.1' },
        'react-router-dom': { singleton: true, requiredVersion: '^6.26.1' },
        'react-i18next': { singleton: true, requiredVersion: '^15.0.1' },
        i18next: { singleton: true, requiredVersion: '^23.14.0' },
        '@reduxjs/toolkit': { singleton: true, requiredVersion: '^2.2.7' },
        'react-redux': { singleton: true, requiredVersion: '^9.1.2' },
      } as Record<string, { singleton: boolean; requiredVersion: string }>,
    }),
  ],

  resolve: {
    alias: {
      // `@` -> src, the shadcn/ui convention used across the platform.
      '@': path.resolve(__dirname, './src'),
    },
  },

  server: {
    port: 5172,
    strictPort: true,
    // Permissive CORS so the shell on :5170 can fetch remoteEntry.js in dev.
    cors: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
    // Standalone dev convenience: proxy REST calls to the gateway so the
    // browser can hit `/api/...` same-origin. When embedded in the shell the
    // shell's own proxy handles this; this proxy only matters at :5172.
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },

  preview: {
    port: 5172,
    strictPort: true,
    cors: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },

  build: {
    // REQUIRED by the federation plugin (top-level await / dynamic import).
    target: 'esnext',
    // Keep the modulepreload polyfill off so remoteEntry loads in every host.
    modulePreload: false,
    // Federation + a single CSS file is the most reliable combo for a remote;
    // the host injects our stylesheet when it loads an exposed module.
    cssCodeSplit: false,
  },
});
