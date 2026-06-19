# securebank-mfe-payments

The **Payments** micro-frontend for the SecureBank platform — a Module
Federation **remote** that owns two screens:

| Exposed module               | Screen                                            |
| ---------------------------- | ------------------------------------------------- |
| `mfe_payments/Transfer`      | Money-transfer form (POST `/api/transactions/transfer`) |
| `mfe_payments/Beneficiaries` | Saved-payee list + add dialog (`/api/beneficiaries`)    |

It runs **standalone** on `http://localhost:5172` in dev (its own Vite server,
store, router and i18n) **and** is consumed by the `securebank-shell` host at
runtime via `remoteEntry.js`.

## Stack

React 18 · TypeScript 5 · Vite · `@originjs/vite-plugin-federation` ·
Redux Toolkit + RTK Query · shadcn/ui on Tailwind · react-i18next (en/hi/mr) ·
react-hook-form + zod · lucide-react.

## Quick start

```bash
npm install
npm run dev        # standalone dev harness at http://localhost:5172
npm run build      # type-check + federated build -> dist/ (incl. assets/remoteEntry.js)
npm run preview    # serve the built bundle at :5172
npm run lint
```

The standalone harness proxies `/api` to the gateway at
`http://localhost:8080`, so run the backend (or at least the gateway) for live
data.

## How the shell consumes it

The shell declares this remote in its `vite.config.ts`:

```ts
remotes: {
  mfe_payments: 'http://localhost:5172/assets/remoteEntry.js',
}
```

and lazy-loads the screens:

```tsx
const Transfer = React.lazy(() => import('mfe_payments/Transfer'));
const Beneficiaries = React.lazy(() => import('mfe_payments/Beneficiaries'));
```

Both are **default-exported** React components.

## Auth & i18n contract (short version)

- **JWT**: read from `window.__SECUREBANK__` (if the shell mirrors it) else from
  `localStorage['securebank_token']` — the shared key the shell writes. Sent as
  `Authorization: Bearer <jwt>`.
- **Language**: `Accept-Language` is set from the live `i18next.language`
  (a federation singleton the shell drives).

Full details, diagrams and the transfer/error flow are in
[`docs/mfe-payments.md`](docs/mfe-payments.md). Running instructions
(standalone, embedded, Docker) are in [`docs/running.md`](docs/running.md).

## Docker

```bash
docker build -t securebank-mfe-payments .
docker run -p 5172:80 securebank-mfe-payments
# remoteEntry.js -> http://localhost:5172/assets/remoteEntry.js (CORS: *)
```

## Source layout

```
src/
  components/ui/      shadcn primitives (button, card, input, label, select,
                      dialog, form, badge, skeleton, toast, toaster, use-toast)
  dev/App.tsx         standalone dev harness (top bar + router + lang switch)
  exposes/            federation entries: Transfer.tsx, Beneficiaries.tsx,
                      EmbedProvider.tsx (store/toaster/i18n wrapper)
  features/
    transfer/         Transfer screen
    beneficiaries/    Beneficiaries screen
  i18n/               i18next init + locales/{en,hi,mr}.json
  lib/                utils (cn, formatMoney), auth (token contract), errors
  store/              RTK Query api slice + standalone store
  types/              api types + ambient remote/global declarations
  main.tsx            standalone bootstrap
```
