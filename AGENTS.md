# Repository Guidelines

## Project Structure & Module Organization
- Core entry: `main.ts` (builds to `main.js`), plugin manifest: `manifest.json`.
- Source: `src/` organized by domain:
  - `agent/`, `session/`, `store/`: agent/session logic and chat state.
  - `providers/`: LLM providers (OpenAI and compatible).
  - `persistence/`: PGlite-backed storage with in-memory fallback.
  - `tool/`: builtin and function tools (e.g., markdown, request_url).
  - `ui/`: Svelte views/components, styles, and view leaves.
  - `settings/`, `config/`, `utils/`, `types/`: support modules.
- Docs: `docs/`. Global styles: `styles.css`.

## Build, Test, and Development Commands
- `npm run dev`: Start esbuild in watch mode for local development.
- `npm run build`: Type-check then production build (outputs `main.js`).
- `npm run test`: Run Vitest test suite once.
- `npm run lint` / `lint:fix`: Lint (and auto-fix) TS/Svelte.
- `npm run format` / `format:all`: Prettier formatting.
- `npm run svelte-check`: Svelte type/diagnostics.
- `npm run version`: Bump version and stage `manifest.json`/`versions.json`.

## Coding Style & Naming Conventions
- Language: TypeScript + Svelte. Indent 2 spaces; Prettier-enforced; semicolons on.
- Files: TS/utility files kebab-case; Svelte components PascalCase (e.g., `ChatPanel.svelte`).
- Symbols: classes PascalCase; functions/vars camelCase; constants UPPER_SNAKE.
- Tooling: ESLint (`eslint.config.mjs`) + Prettier (`.prettierrc`) + Svelte plugins.

## Testing Guidelines
- Framework: Vitest (`vitest.config.ts`).
- Location/naming: co-locate tests as `*.spec.ts` next to sources or under `__tests__/`.
- Run: `npm test`. Target new logic with fast unit tests; prefer provider/persistence mocks.

## Commit & Pull Request Guidelines
- Commits: Conventional Commits used in history (e.g., `feat(ui): …`, `refactor(chat): …`, `chore: …`). Scope with folder/domain.
- PRs: include purpose, linked issues, screenshots for UI, and notes on migration if persistence/schema changes.
- Versioning: run `npm run version` when changing public behavior or manifest.
- Checks: ensure `build`, `lint`, `test`, and `svelte-check` pass.

## Security & Configuration Tips
- Do not hardcode API keys; configure providers via the plugin Settings UI.
- Avoid committing generated artifacts beyond `main.js`. Review diffs for secrets.
- When touching storage, use repository interfaces in `persistence/repositories` and provide safe fallbacks.
