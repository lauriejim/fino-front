# fino — MIR v2

React + Primer client for Make It Rain, packaged in Electron. Talks to the
existing Strapi backend in `../strapi-app`.

Status: **early scaffold**. Pilot scope is login → clients list → client detail
(info + contracts only). Invoices, allocations, auto-invoice generation,
supports, arbitrage and imports are not yet migrated from `../tui`.

## Stack

- React 19 + TypeScript
- [Primer](https://primer.style/react) design system (GitHub)
- [TanStack Query](https://tanstack.com/query) for server state
- React Router (browser router — Electron serves files locally)
- Vite for the renderer
- Electron 39 with `contextIsolation: true` + typed preload surface
- Strapi Users & Permissions for auth (JWT, stored in `localStorage`)

## Setup

```sh
cd fino
cp .env.example .env    # then edit VITE_STRAPI_URL if needed
npm install             # (or yarn / pnpm install)
```

## Dev

```sh
npm run dev
```

Runs Vite on `:5173` and opens an Electron window pointed at the dev server.

## Build & package

```sh
npm run build           # builds renderer (dist/) + main process (dist-electron/)
npm run package:mac     # -> release/*.dmg  (requires GH_TOKEN to publish)
npm run package:win
```

## Architecture notes

```
fino/
├── electron/            # main + preload (TS compiled to dist-electron/)
│   ├── main.ts
│   └── preload.ts
├── src/
│   ├── api/             # Strapi REST client (token-bound), entity endpoints
│   ├── contexts/        # AuthContext, QueryProvider
│   ├── components/
│   │   ├── layout/      # AppShell, Sidebar
│   │   └── routing/     # ProtectedRoute
│   ├── pages/           # LoginPage, ClientsListPage, ClientDetailPage, Placeholder
│   ├── lib/             # formatters, pure helpers
│   └── types/           # strapi.ts (entities), electron.d.ts (window.electronAPI)
├── index.html           # Vite entry
├── vite.config.ts
├── tsconfig.json
└── electron/tsconfig.json
```

### Auth

- Login is `POST /api/auth/local` with `{ identifier, password }`.
- JWT stored under `fino.auth.token` in `localStorage`.
- On boot, `AuthContext` validates the stored token via `GET /api/users/me`.
- 401/403 anywhere clears the token and redirects to `/login`.

### Secrets

- **No tokens in source.** v1 had `GH_TOKEN` and Strapi bearer tokens in
  `tui/index.js` / `tui/helpers/strapi.js`; those tokens should be revoked.
- `GH_TOKEN` is read from the shell env at build / runtime by
  `electron-updater`. Do not commit it.
- `VITE_STRAPI_URL` is bundled into the renderer (it's the API base URL —
  not a secret).

### Scope reductions vs. v1 model

Dropped in v2:
- `WealthManager` (use Strapi Users)
- `Operation`
- `Bank`
- `arbitrage.executed`

All other entities (`Client`, `Account`, `Insurer`, `Envelope`, `Product`,
`Contract`, `Support`, `Allocation`, `AllocationTarget`, `Arbitrage`,
`Invoice`, `RiskProfile`, `IsrEsgProfile`) are preserved.

## Next steps

1. Client detail — invoices table, allocations table, auto-invoice generation,
   custom invoice, fee editing, delete invoice.
2. Supports list (search + copy ISIN/name).
3. Arbitrage — cascade insurer → product → risk profile, current vs target,
   BUY/SELL actions, email copy.
4. Import — file picker, parser routing, dry-run preview, write to Strapi
   (fix the v1 dead-code issue in `helpers/importer.js` and merge behavior
   with the `importers/` CLI scripts).
5. About — aggregated dashboard.
