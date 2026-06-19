# Running securebank-mfe-payments

## Prerequisites

- Node 20+ (CI uses Node 22)
- The SecureBank gateway reachable at `http://localhost:8080` for live data
  (the dev server proxies `/api` there). The MFE still loads without it; data
  fetches will just error and show the retry state.

## 1. Standalone dev (its own server at :5172)

```bash
npm install
npm run dev
```

Open <http://localhost:5172>. The harness (`src/dev/App.tsx`) gives you a top
bar with links to **Transfer** and **Beneficiaries** and an EN/हि/मराठी language
switcher. `/api/*` is proxied to the gateway.

Provide a token the same way the shell would (so authenticated calls work):

```js
// in the browser console
localStorage.setItem('securebank_token', '<a valid JWT from POST /api/auth/login>');
location.reload();
```

## 2. Embedded in the shell

1. Start this remote (`npm run dev` here, or `npm run preview` on a built
   bundle) so `http://localhost:5172/assets/remoteEntry.js` is reachable.
2. Start the shell (`securebank-shell`) on `:5170`. Its `vite.config.ts`
   already points `mfe_payments` at `http://localhost:5172/assets/remoteEntry.js`.
3. Log in through the shell. The shell stores the JWT under
   `localStorage['securebank_token']` (and/or `window.__SECUREBANK__`), which
   this remote reuses. Navigate to the payments routes; the shell lazy-loads our
   `Transfer` / `Beneficiaries` modules.

> Because `react`, `react-dom`, `redux`, the router and i18next are shared
> singletons, the embedded screens use the **shell's** store, router history and
> language. Switching language in the shell re-renders our strings.

## 3. Production build

```bash
npm run build      # tsc -b && vite build
npm run preview    # serve dist/ at :5172
```

`npm run build` emits `dist/`, including `dist/assets/remoteEntry.js`. CI asserts
this file exists — it is the federation manifest the shell loads.

## 4. Docker

```bash
docker build -t securebank-mfe-payments .
docker run --rm -p 5172:80 securebank-mfe-payments
```

- nginx serves the built assets with permissive CORS on `/assets/*` so a
  different-origin shell can fetch `remoteEntry.js`.
- `remoteEntry.js` is served `no-cache` so the shell always sees the current
  exposes map; hashed chunks are cacheable.
- `/api/*` is proxied to `http://gateway:8080` (adjust the upstream host for
  your compose/k8s network).

## Troubleshooting

| Symptom                                   | Likely cause / fix                                                         |
| ----------------------------------------- | -------------------------------------------------------------------------- |
| Shell can't load the remote (CORS error)  | dev server / nginx must send `Access-Control-Allow-Origin: *` on assets.   |
| "Invalid hook call" in the shell          | a singleton (usually `react`) loaded twice — check versions match the shell. |
| All API calls 401                         | no/invalid JWT under `securebank_token`; log in via the shell or set it.   |
| Money shows wrong grouping                | check the locale mapping in `lib/utils#localeForLanguage`.                 |
| `remoteEntry.js` missing after build      | ensure `build.target: 'esnext'` (lower targets break the federation output). |
