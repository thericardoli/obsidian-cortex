# Repository Guidelines

## Project Structure & Module Organization

- Entry file `main.ts` only handles lifecycle hooks and wiring settings; business logic lives in `src/core/` (agent-, model-, tool-registry and runner-service).
- Shared types (agent, tool, model, conversation) live in `src/types/`; Obsidian views and the Svelte chat experience are in `src/ui/chat-view/`.
- Reusable Svelte components live under `src/lib/components/` (`ai-elements/` for AI UX, `ui/` for primitives) with exports composed via local `index.ts`.
- Settings UI is in `src/settings/` (Svelte tab plus persistence helpers). Avoid touching build output (`main.js`, `styles.css`); Vite writes directly to repo root.

## Build, Test, and Development Commands

- `bun install` installs dependencies; prefer Bun to stay aligned with lockfile.
- `bun run dev` watches via Vite/esbuild and rebuilds into `main.js`.
- `bun run build` produces the production bundle; `bun run build:dev` keeps sourcemaps for debugging.
- Quality checks: `bun run lint`, `bun run lint:fix`, `bun run svelte-check`, `bun run format[:check]`, `bun run build`.

## Coding Style & Naming Conventions

- TypeScript + Svelte 5 runes (`$state`, `$props`, `$derived`) with Tailwind CSS v4 classes; **never** add `<style>` blocks.
- Components are `PascalCase.svelte`; TypeScript utilities use kebab-case filenames and named exports.
- Use ESLint (config in `eslint.config.mjs`) and Prettier with Tailwind plugin; run formatters before submitting.
- Respect path alias `$lib` → `src/lib`; keep `main.ts` free from heavy logic.

## Testing Guidelines

- Use `bun run svelte-check` and `bun run lint` as the minimum verification gate; both fail CI.
- For runtime regressions, rely on `RunnerService` mocks or vault fixtures under `src/core/` (add lightweight harnesses when touching streaming logic).
- Add zod-based validation tests for new tools/agents to ensure parameter schemas throw helpful errors.

## Commit & Pull Request Guidelines

- Follow the existing Conventional Commits style (`refactor(model-registry): ...`, `fix(prompt-input): ...`, `ci: ...`); scope names match folders.
- Each PR should describe behavior changes, list the Bun/Vite commands run locally, and link related issues; include chat-view screenshots/gifs for UI updates.
- Keep PRs focused: configuration changes separate from feature work, generated files excluded, and mention if manual vault setup steps are required.

## Agent & Tool Notes

- `AgentRegistry.buildAgent()` recursively wires handoffs; ensure new tools are registered through `ToolRegistry.getSdkTool()` so they receive the Obsidian `ToolContext`.
- Model selection flows through `ModelRegistry.resolveForAgent()`, so update model metadata there instead of hardcoding IDs in UI components.
