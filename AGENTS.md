# Repository Guidelines

## Project Structure & Modules
- Root: `main.ts` (Obsidian plugin entry), `manifest.json`, `styles.css`.
- Source: `src/` organized by domain:
  - `agent/`, `providers/`, `session/`, `persistence/`, `config/`, `types/`.
  - UI: `src/ui/` with Svelte components and views.
- Build: `esbuild.config.mjs`, TypeScript config in `tsconfig.json`.
- Examples: `examples/` TypeScript snippets for local exploration.

## Build, Test, and Dev
- `npm run dev`: start esbuild in watch mode; outputs `main.js`.
- `npm run build`: type-check and production build.
- `npm run svelte-check`: static analysis for Svelte + TS.
- Release: bump versions with `npm run version` then follow README release steps.

## Coding Style & Naming
- Indentation: tabs, width 4; LF line endings (`.editorconfig`).
- Language: TypeScript (ESNext modules), Svelte for UI.
- Linting: ESLint (`.eslintrc`) with `@typescript-eslint`; prefer `npx eslint src main.ts` before PRs.
- Naming: TypeScript files kebab-case; classes/types/interfaces PascalCase; Svelte components PascalCase.

## Testing Guidelines
- Framework: none yet. Use `npm run build` and test in Obsidian.
- Manual checks: enable plugin, open Cortex Chat view, create an agent, switch providers, send/receive messages, and verify persistence if available.
- Optional: run `npm run svelte-check` and `npx eslint` to catch regressions.

## Commit & Pull Requests
- Commits: follow Conventional Commits seen in history (e.g., `feat: ...`, `fix: ...`, `refactor: ...`, `chore: ...`). Keep scopes concise.
- PRs must include: clear description, linked issues, reproduction steps, and screenshots/GIFs for UI changes.
- Build & lint: run `npm run build` and ensure no ESLint/Svelte-check errors.
- Versioning: update `manifest.json`/`versions.json` when releasing; do not commit secrets.

## Security & Configuration
- API keys are configured via the plugin settings; never commit keys.
- Check provider defaults in `src/config/provider-defaults.ts` and types in `src/types/` before adding new providers.
- Persistence uses PGlite; changes touch `src/persistence/`—test upgrades against an existing vault.
