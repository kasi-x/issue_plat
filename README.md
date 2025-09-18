# Leptos Blog with In-Text Annotations — Cloudflare Starter

This repository contains a scaffold for the Cloudflare Pages Functions + D1 pieces described in the spec. Leptos/Rust app code and SSR integration can be added next.

What’s included:

- D1 migrations for posts/annotations/reports/settings (`migrations/0001_init.sql`).
- Cloudflare Pages Functions routes under `functions/api/*` (kept for Cloudflare deploys).
- Local Express server (no Cloudflare needed) under `src/server/` with same API and pages.
- Shared TypeScript utilities in `src/lib/` (HTTP helpers, sanitizer, crypto helpers, types).
- Vitest configured via `pnpm run test` with a sanitizer test.
- `wrangler.toml` and `.dev.vars.example` for local development.

Local (no Cloudflare) quick start:

1. pnpm install
2. Copy `.env.example` to `.env` (optional) and adjust if needed.
   - Defaults: `PORT=8788`, `TURNSTILE_MODE=mock`, `ORIGIN_HOST=localhost:8788`, `DB_PATH=./data/app.db`.
3. Start locally:
   - `pnpm run dev` (alias for `pnpm run dev:local`)
   - Server: http://localhost:8788
   - Post page: http://localhost:8788/posts/hello-world

Runtime targets

- `pnpm run dev:local` / `pnpm run dev` — native or Docker host with SQLite (`data/app.db` by default).
- `pnpm run dev:docker` — same as local but marks the runtime so SQLite lives under `data/docker/` unless `DB_PATH` is set.
- `pnpm run dev:cloudflare` — runs the WASM watcher alongside `wrangler pages dev`; schema changes should be managed with `wrangler d1` migrations.
- All runtime-aware scripts accept `--target <local|docker|cloudflare>` and also honour `RUNTIME_TARGET`, `RUNTIME`, or `DEPLOY_TARGET` environment variables.

Using Docker (recommended for local debug):

1. `docker-compose up --build`
2. Open http://localhost:8788
   - SQLite DB persisted in the `db-data` volume.

Leptos frontend (CSR) build

- Requires Rust (with `wasm32-unknown-unknown` target). If `trunk` is not installed the scripts will fall back to `wasm-pack` (using `pnpm dlx wasm-pack` when necessary).
- `pnpm run dev` now runs both the Express server *and* a Leptos watcher. Whenever files in `leptos-app/src` change the WASM bundle in `public/assets` is rebuilt automatically.
- To build the bundle once (for CI or testing), run `pnpm run build:wasm` — it uses `trunk build` when available and otherwise falls back to `wasm-pack build`. Pass `--target cloudflare` if you need to align with the Cloudflare runtime configuration.
- A fresh WASM bundle is produced automatically before `pnpm run test`, so local unit tests always see the latest assets.
- Reload http://localhost:8788/posts/hello-world and use the “Add annotation” button after selecting text.

Scripts:

- `pnpm run dev` — local Express server (no Cloudflare).
- `pnpm run dev:cf` — Cloudflare Pages dev (optional).
- `pnpm run dev:cf:local` — Pages dev in local mode (optional).
- `pnpm run build` — placeholder (Leptos/Rust build handled separately).
- `pnpm run test` — run unit tests (Vitest).

Next steps:

- Integrate Leptos SSR later; the local API is stable.
- Add a minimal browser UI to exercise create/reply with the mock Turnstile.

Security notes:

- Local mode defaults to mock Turnstile; do not use in production.
- Same-origin enforced using `ORIGIN_HOST`.
- The sanitizer is conservative; expand only if necessary and ensure tests cover new cases.
