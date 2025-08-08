## Obsidian Cortex — 对 AI 编码助手的项目速览与约定

请遵循本仓库的真实结构与约定，避免通用化建议。重点围绕以下事实模式产出代码与解释。

架构与数据流（重要）
- Obsidian 插件主入口在 `main.ts`：初始化 ProviderManager、Persistence（PGlite/IndexedDB）、AgentManager，注册 Svelte 5 聊天视图与设置面板。
- Provider 抽象：`src/providers/*`
	- `ProviderManager` 通过 `addProvider(config)` 注册 OpenAI 或兼容源（如 Ollama），按需 `initialize()` 并暴露 `getModel(providerId, modelName)` 与 `getAvailableModels`（实时调用远端 `/models`）。
	- OpenAI 直连：`openai.ts`；OpenAI 兼容：`openai-compatible.ts`（需 `baseUrl`）。两者均返回 `@openai/agents-core` 的 `Model` 实例。
- Agent 管理：`src/agent/agent-manager.ts`
	- 以 Zod 校验的 `AgentConfig` 存/取（内存缓存 + 可选 PGlite 持久化）。
	- 创建运行态 `Agent` 时通过 ProviderManager 注入具体 `Model`；支持 `createAgentInstanceWithModel(id, providerId, modelId)` 覆盖模型。
	- 工具系统：`convertToolsToSDKTools` 支持三类：`function`（需先用 `registerFunctionToolExecutor(name, fn)` 注册执行器）、`hosted`（`web_search`/`file_search`/`code_interpreter`/`image_generation` 映射到 `@openai/agents-openai` 工具）、`agent`（Agent-as-Tool，经 `asTool()` 包装）。
- 会话与持久化：
	- 数据库：`src/persistence/database-manager.ts` 使用 PGlite + IndexedDB（`idb://cortex-db`），表：`agents`、`sessions`；资源由 `PGliteResourceLoader` 内联二进制加载，避免 Electron `import.meta.url` 限制。
	- Repos：`AgentRepository` 与 `SessionRepository` 负责 JSONB 读写；`PersistenceManager` 统一出入口。
	- 运行态会话：`src/session/chat-session.ts` 采用“内存缓存，结束统一落库”的简化策略，`toAgentInputHistory()` 映射为 Agents SDK 可用输入。
- UI（Svelte 5）：`src/ui/view/ChatViewLeaf.ts` 通过 `mount/unmount` 动态挂载 `ChatView.svelte`；`ChatView.svelte` 使用 `run(agent, text)` 执行对话，模型选择键形如 `${providerId}::${modelId}`，自动滚动与结果提取在本组件内完成。

开发与构建（在 Obsidian 中调试）
- 运行时要求 Node ≥16。主要脚本在 `package.json`：
	- `npm run dev`：esbuild 开发打包（监听）。
	- `npm run build`：`tsc -noEmit` 类型检查 + 生产打包。
	- `npm run svelte-check`：Svelte + TS 类型诊断。
- 调试流程：运行 `dev` 后在 Obsidian 中启用插件并刷新；生产发布需同时产出并上传 `manifest.json`、`main.js`、`styles.css`（参考 `README.md`“Releasing new releases”）。

项目约定与常见扩展点（写代码请遵循）
- 类型与配置：全部用 Zod 定义于 `src/types/*`（如 `AgentConfigSchema`、`ProviderConfigSchema`、`ModelSettingsSchema`）。新增字段先扩展 Schema 再落库（JSONB）。
- Provider 选择与模型：从插件设置读取 `providers`（见 `src/types/settings.ts` 与 `src/config/provider-defaults.ts`），UI 以分组下拉（provider → models）呈现；需要动态拉取模型时用 `ProviderManager.getAvailableModels(providerId)`。
- Function 工具：先 `agentManager.registerFunctionToolExecutor('toolName', executor)`，再往目标 Agent 的 `tools` 添加 `{ type: 'function', name: 'toolName', executor: 'toolName', ... }`，名称必须匹配以便 `convertToolsToSDKTools` 绑定。
- Hosted 工具命名：`web_search`、`file_search`（需 `providerData.vectorStoreIds`）、`code_interpreter`、`image_generation`，不匹配将被跳过并告警。
- 持久化容错：PGlite 初始化失败时插件退回“内存模式”，功能可用但不落库；相关代码已捕获并记录 warning。
- Svelte 5 API：使用 `import('svelte').mount/unmount`；不要回退到 Svelte 3/4 的 `new Component({ target })` 写法。

示例切入（文件定位）
- 获取模型并运行：`src/providers/provider-manager.ts#getModel` → `src/agent/agent-manager.ts#createAgentInstance(WithModel)` → `@openai/agents#run`（在 `src/ui/view/ChatView.svelte`）。
- 新增 Provider（兼容源）：调用 `CortexPlugin.addCustomProvider()` 或在设置内添加，随后 `ProviderManager.addProvider({ providerType: 'OpenAICompatible', baseUrl, apiKey })`。
- 新增工具执行器：`AgentManager.registerFunctionToolExecutor()` 并在 Agent 配置中添加对应 `ToolConfig`。

注意事项
- API Key 仅来自插件设置，不应硬编码；OpenAI 兼容源必须提供 `baseUrl`。
- `getModel/getAvailableModels` 会在未初始化时自动 `initialize()` Provider。
- 变更数据库写路径或 Schema 时，请同时更新 Repos 与迁移逻辑（`runMigrations()`）。

