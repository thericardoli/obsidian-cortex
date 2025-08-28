## Copilot instructions for obsidian-cortex

Purpose: Help AI coding agents be productive in this Obsidian plugin by capturing the architecture, workflows, conventions, and gotchas discovered in this repo.

Big picture architecture

- Entry: `main.ts` wires managers/services, registers Svelte views (`ChatViewLeaf`, `AgentViewLeaf`), settings tab, and builtin tools. Build outputs `main.js` via esbuild.
- Runtime layers:
    - Providers: `ProviderManager` + `ProviderService` resolve models using OpenAI Agents SDK providers (OpenAI and OpenAI-compatible).
    - Agents: `AgentManager` persists validated agent configs (Zod) via repositories; `AgentService` builds a runtime `Agent` with model + tools (see `tool-conversion.ts`).
    - Sessions: `SessionService`/`SessionManager` store chat items; UI reads/writes sessions around chat runs.
    - Persistence: `PersistenceManager` -> `DatabaseManager` (PGlite on IndexedDB) with in-memory fallback; repositories under `src/persistence/repositories` isolate DB access.
    - UI: Svelte 5 components under `src/ui/**` using runes ($state/$derived/$effect). `ChatView.svelte` consumes a store from `src/store/chat-store.ts` which streams messages via `@openai/agents`.

Key flows and contracts

- Build an agent at runtime: `AgentService.create|createWithModelOverride()` pulls config from `AgentManager`, resolves a `Model` via `ProviderManager.getModel()`, converts `AgentConfig.tools` to OpenAI Agent tools using `buildTools()`.
- Chat run: `createChatStore().actions.sendMessage()` -> compose input from current Svelte state + session history -> `run(agent, input, { stream: true })` -> incrementally update UI using `extractDelta()`; on completion, persist assistant item back to session.
- Events: Cross-component notifications via `SimpleEventBus`. Emitted keys include `agentsChanged`, `providersUpdated`, `modelsUpdated`, and session lifecycle events.

Tools pattern (OpenAI Agents SDK)

- Three tool kinds in `ToolConfig`: `function`, `hosted`, `agent`.
    - function: executor is looked up in `functionToolRegistry`. Parameters are strict JSON schema by default; built via Zod helpers (`zod-to-json.ts`).
    - hosted: created through `createHostedTool()`; supply `providerData` on the config.
    - agent: wraps another agent via `buildAgentAsTool()`.
- Builtins: declared/executed in `src/tool/builtin/**`; aggregated and registered in `src/tool/builtin/index.ts`. Registration happens in `main.ts` via `registerAllBuiltinFunctionExecutors()`.
    - Examples: `create_markdown_file`, `read_markdown_file`, `request_url` (wraps Obsidian `requestUrl`).

Providers pattern

- Implementations: `src/providers/openai.ts` and `src/providers/openai-compatible.ts` (both use `@openai/agents-openai` with an `OpenAI` client; `dangerouslyAllowBrowser: true`).
- Selection and lazy init: `ProviderManager.addProvider()` stores instances; `ensureInitialized()` initializes on first use. Refresh from settings via `ProviderService.refreshFromSettings()`.
- To add a new provider type, extend the switch in `ProviderManager.addProvider()` and update settings types.

Persistence and repositories

- `DatabaseManager` uses PGlite with IndexedDB dataDir; runs `SCHEMA_SQL` migrations for `agents` and `sessions`. `PGliteResourceLoader` preloads WASM/fsBundle to avoid `import.meta.url` issues; on failure, `PersistenceManager` keeps in-memory repositories.
- Use only the repositories (`agent-repository.ts`, `session-repository.ts`) from service/manager layers. Do not call PGlite directly outside persistence.

UI and state conventions (Svelte 5)

- Use runes ($state/$derived/$effect) and keep component logic thin; heavy logic lives in stores/services.
- `ChatView.svelte` renders markdown via Obsidian `MarkdownRenderer` (keep this in UI only). Avoid importing Obsidian APIs into core logic/persistence.

Logging

- Use `createLogger(scope)`; build-time `__CORTEX_DEFAULT_LOG_LEVEL__` is injected by esbuild (`debug` in dev, `error` in prod). Env override: `CORTEX_LOG_LEVEL`.

Build, test, and dev

- Scripts: `npm run dev` (esbuild watch), `npm run build` (type-check + production bundle), `npm run test` (Vitest), `npm run svelte-check`, `npm run lint`/`lint:fix`, `npm run format`.
- Tests: Vitest config expects `tests/**/*.test.ts`. Prefer repository/provider mocks for fast unit tests around managers/services.

Project-specific dos/don’ts

- Do validate agent updates via `AgentConfigInputSchema`/`UpdateAgentConfigInputSchema`. Use `AgentManager` methods; don’t write `_agentCache` directly from UI.
- Do register executors in `functionToolRegistry` before enabling a function tool on an agent. Keep tool parameters strict unless intentionally non-strict.
- Do refresh providers via `ProviderService.refreshFromSettings()` and emit `providersUpdated` when settings change.
- Don’t import Obsidian APIs into persistence/managers; keep Obsidian-only code in UI and builtin tools.

Docs references you should consult when editing these areas

- OpenAI Agents SDK (JS): construction of `Agent`, `tool()`, and `run()` streaming usage.
- Svelte 5 runes and component patterns used in `src/ui/**`.

Pointers to exemplars

- Wiring: `main.ts`. Agent runtime: `src/agent/agent-service.ts`. Tool build: `src/tool/tool-conversion.ts`. Chat flow: `src/store/chat-store.ts`. Persistence: `src/persistence/database-manager.ts`. Providers: `src/providers/provider-manager.ts`.
