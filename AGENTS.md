# Repository Guidelines

## Project Structure & Module Organization
- Root contains `package.json`, `pnpm-workspace.yaml`, and `node_modules/`.
- No `src/` or `tests/` folders yet; add new code under `src/` and keep modules small and single‑purpose.
- Place configuration in the root (e.g., `tsconfig.json`, `.eslintrc.cjs`) when introduced.

## Build, Test, and Development Commands
- `pnpm install` — install and lock dependencies.
- `pnpm exec codex --help` — inspect the Codex CLI installed as a dependency.
- If you add scripts, prefer: `pnpm run dev`, `pnpm run build`, `pnpm run test` with clear, single‑purpose commands.

## Coding Style & Naming Conventions
- Language: JavaScript/TypeScript welcome; prefer ESM modules.
- Indentation: 2 spaces; include semicolons; single quotes for strings.
- Naming: `camelCase` for variables/functions, `PascalCase` for classes, `kebab-case` for file names; tests mirror source paths.
- Keep functions <50 lines; extract utilities to `src/lib/`.

## Testing Guidelines
- Framework: Vitest or Jest (choose one and configure once).
- Location: `tests/` (or `src/**/*.test.ts`); name tests `*.test.ts`.
- Coverage: target ≥80% for new/changed code; include edge cases and minimal regression repros.
- Run: once configured, expose as `pnpm run test`.

## Commit & Pull Request Guidelines
- Commits: concise, imperative subject (max ~72 chars). Prefer Conventional Commits (e.g., `fix: handle empty config`).
- PRs: include purpose, linked issues, reproduction steps, and screenshots/logs if relevant. Keep PRs focused and small.
- Checklist: updated docs, added/updated tests, verified `pnpm install` works cleanly.

## Security & Configuration Tips
- Use Node 18+ and pnpm 8+ for consistency.
- Do not commit secrets; use env files and document required variables.
- Respect `pnpm-workspace.yaml` (e.g., `ignoredBuiltDependencies: ws`); avoid postinstall scripts that fetch binaries.
