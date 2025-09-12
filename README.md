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
1) pnpm install
2) Copy `.env.example` to `.env` (optional) and adjust if needed.
   - Defaults: `PORT=8788`, `TURNSTILE_MODE=mock`, `ORIGIN_HOST=localhost:8788`, `DB_PATH=./data/app.db`.
3) Start locally:
   - `pnpm run dev`
   - Server: http://localhost:8788
   - Post page: http://localhost:8788/posts/hello-world

Using Docker (recommended for local debug):
1) `docker-compose up --build`
2) Open http://localhost:8788
   - SQLite DB persisted in the `db-data` volume.

Leptos frontend (CSR) build
- Requires Rust + wasm-pack installed locally.
- Build the WASM bundle to `public/assets`:
  - `cd leptos-app`
  - `wasm-pack build --target web --out-dir ../public/assets --out-name app`
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
# issue_plat
# issue_plat
# issue_plat
# issue_plat
