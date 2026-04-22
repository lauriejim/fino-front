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

## Release process

Releases are cut from your laptop by pushing a version tag. CI takes over
from there — `.github/workflows/release.yml` builds the Electron app for
macOS + Windows in parallel and publishes the artefacts (DMG, zips,
NSIS installer) to a GitHub Release on this repo. `electron-updater` in
the installed app polls that Release on startup and prompts the user to
install when a newer version shows up.

### Standard flow

```sh
# Bump version in package.json — yarn version does commit + tag locally
yarn version --new-version 2.0.1

# Push branch + the freshly-created tag to GitHub
git push origin main --follow-tags
```

That's it. The tag (`v2.0.1`) triggers the Release workflow.

### Pre-release / alpha

Use a semver pre-release suffix to test the pipeline or ship to beta
users without promoting to "latest":

```sh
yarn version --new-version 2.0.0-alpha.1
git push origin main --follow-tags
```

### Manual tagging (if you want to keep the commit separate from the tag)

```sh
yarn version --new-version 2.0.1 --no-git-tag-version
git commit -am "Release v2.0.1"
git tag v2.0.1
git push origin main --tags
```

### Redo a release under the same version

Use this when a release is broken (build failed, wrong env URL baked in,
missing file) and you want to republish with **the same version number**
after fixing things. Fine for pre-releases / alphas; for a version that
users may already have installed, prefer bumping to the next patch/alpha
instead — re-using a version silently overwrites their update metadata.

```sh
# 1. Delete the local tag
git tag -d v2.0.0-alpha.1

# 2. Delete the remote tag
git push origin --delete v2.0.0-alpha.1

# 3. Delete the GitHub Release
#    github.com/lauriejim/fino-front/releases → "…" → Delete

# 4. Re-tag from the current commit (after you've pushed your fix)
git tag v2.0.0-alpha.1
git push origin v2.0.0-alpha.1
```

The workflow picks the new tag up and publishes a fresh Release with
the same name. electron-updater on installed apps won't re-download
(same version string) — that's why this flow is safer for alphas than
for stable releases.

### Checklist before tagging

- [ ] Dependencies stable (no half-baked branch work)
- [ ] `.env.production` points to the right Strapi URL (this is the file
      Vite reads at build time; `.env` only affects `yarn dev`)
- [ ] Build works locally (`yarn package:mac` on Mac / `yarn package:win` on Windows)
- [ ] Changelog / release notes drafted somewhere (optional but nice)

### Auto-update behavior per platform

- **Windows** — fully automatic. User clicks *Install & restart*, NSIS
  swaps the binary and relaunches the new version.
- **macOS** — **manual drag-and-drop**. Apple's Squirrel framework
  refuses the in-place swap unless both the old and new bundle are
  signed by the same Apple Developer ID. Without the $99/year Developer
  Program, each ad-hoc build has a different signature so validation
  always fails (`Code signature … did not pass validation`). The
  banner's *Open download* button opens the downloaded file in Finder;
  the user drags the new Fino.app into /Applications, confirms the
  overwrite, then right-clicks → Open (Gatekeeper one-time prompt).
- **When to enroll in the Apple Developer Program** — not before the
  user base outgrows a handful of people or the manual drag-and-drop
  friction starts costing real time.

### Env file strategy

Vite loads env files by mode:

| File              | Mode         | Git-tracked? | Purpose                                           |
|-------------------|--------------|--------------|---------------------------------------------------|
| `.env.production` | `build`      | yes          | API URL used in the packaged app — edit to change prod backend |
| `.env`            | `dev`        | **no**       | Your personal dev settings (localhost / staging) |
| `.env.local`      | dev + build  | **no**       | One-off overrides; rarely needed                  |

More specific wins — so in a `build`, `.env.production` wins over `.env`.

### If the workflow fails

Check **GitHub → Actions** for the failed run. Common causes:

- **"Resource not accessible by integration"** → go to *Settings → Actions
  → General → Workflow permissions* and enable "Read and write permissions".
- **Icon not found (`build/icon.png` / `build/icon.ico`)** → place the
  icons at those paths, or remove the `build.mac.icon` / `build.win.icon`
  fields from `package.json`.
- **`concurrently` not found or peer-dep errors** → `.npmrc` with
  `legacy-peer-deps=true` must be committed (it is — don't delete it).

To re-run a release under the same version after a failure, see the
"Redo a release under the same version" section above.

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
