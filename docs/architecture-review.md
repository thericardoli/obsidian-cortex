# Obsidian Cortex — 架构审查

作者：高级架构审查
日期：2025-08-27

## 范围

本文档审查 Obsidian Cortex 插件的当前架构，突出优势，识别问题和反模式，并提出增量路线图的目标改进。

## 高水平概述

- 入口：`main.ts` 将服务和 UI 视图连接到 Obsidian 插件生命周期。
- 领域：
    - Agent：`src/agent/*`（配置/缓存，通过 `AgentService` 进行工具组装）。
    - Providers：`src/providers/*` 与 `ProviderManager` 和具体提供商（OpenAI、OpenAI 兼容）。
    - Session：`src/session/*` 管理聊天会话，具有延迟持久化。
    - Persistence：`src/persistence/*`（PGlite WebAssembly、存储库、映射器、资源加载器）。
    - UI：`src/ui/*` 中的 Svelte 5 组件，具有 `src/store/chat-store.ts` 的存储 + 视图。
    - Config/Types/Utils：`src/config`、`src/types`、`src/utils`。
- 构建：Esbuild CJS 包 + Svelte 插件，二进制加载器用于 `.wasm`/`.data`。

总体而言，领域分离清晰且实用。代码库在 Obsidian 特定性和 SDK 抽象（OpenAI Agents）之间取得了合理的平衡。

## 优势

- 清晰的分层：代理、提供商、会话的管理器/服务；持久化的存储库。
- 使用 Zod 模式的类型化边界；映射器中的显式序列化/反序列化。
- 持久化回退策略：首先内存，然后在资源可用时使用 PGlite。
- EventBus 用于解耦 UI 刷新与领域变化；最小全局状态。
- 工具组装（`tool-conversion.ts`）干净地分离函数/托管/代理工具。
- 构建配置正确处理 PGlite 资产通过二进制加载器；CJS 输出以兼容 Obsidian。

## 关键问题和风险

1. 提供商启用逻辑阻止常见设置（Ollama）

- 代码：`src/utils/provider-runtime.ts:isRuntimeEnabled` 需要 `OpenAICompatible` 的 `baseUrl` 和 `apiKey`。
- 影响：Ollama（和其他本地 OpenAI 兼容服务器）通常不需要 API 密钥；即使在设置中启用，提供商也不会初始化。
- 症状：UI 中空的模型组；聊天无法发送。

2. 在 UI 中混合服务和管理器层

- 代码：`ChatViewLeaf`/`AgentViewLeaf` 将 `ProviderManager` 和 `AgentService` 传递到 Svelte。`ChatStore` 直接调用 `ProviderManager`，而提供商生命周期由 `ProviderService` 拥有。
- 影响：抽象泄漏和重复职责；更难演进提供商生命周期（例如，延迟模型发现、重试、健康检查）。

3. 会话持久化策略风险数据丢失和大负载重写

- 代码：`chat-session.ts` 将持久化推迟到 `dispose()` 或 `forceFullSave()`；`SessionRepository.addItems` 重写完整 JSON 数组。
- 影响：应用/Obsidian 崩溃或窗口关闭可能丢失整个对话。大型会话导致重复的全文档写入；长聊天性能差。

4. 直接 UI 变异领域对象

- 代码：`BuiltinToolsSelector.svelte` 在调用管理器方法后拼接/推送 `agent.tools`。
- 影响：打破单一真相来源。管理器已经缓存并发出变化。直接变异可能留下 UI 的陈旧引用，并需要临时刷新。

5. 重复的类型定义和不一致命名

- 代码：`ToolChoiceSchema` 在 `src/types/agent.ts` 和 `src/types/tool.ts` 中均定义。
- 影响：漂移和混淆；未来变化可能分歧。

6. PGlite 资源加载器的导入路径耦合

- 代码：`pglite-resource-loader.ts` 从 `../../node_modules/...` 导入二进制文件。
- 影响：耦合到包结构；虽然 esbuild 二进制加载器在构建时缓解，但如果包布局变化，路径脆弱性仍然存在。此外，回退日志表明在 Electron 中围绕 `import.meta.url` 的混淆。

7. 提供商错误未向用户显示

- 代码：`ProviderManager.ensureInitialized` 抛出；调用者经常吞入日志。
- 影响：用户看到静默失败（无法发送或无模型）而无可操作的 UI 反馈。

8. 最小迁移/版本策略

- 代码：`DatabaseManager` 使用单个 `migrations` 表和 `CURRENT_SCHEMA_VERSION = 1`，但记录 "V0 schema"。
- 影响：命名/版本不一致和缺乏结构化迁移使未来模式演进更难（例如，规范化会话/消息）。

9. README 与实际插件功能集不匹配

- 代码：根 `README.md` 是 Obsidian 示例；项目特定文档位于 `AGENTS.md`。
- 影响：入职摩擦；构建/运行说明和功能概述不清楚。

10. Obsidian minAppVersion 可能太旧

- 代码：`manifest.json` 有 `minAppVersion: 0.15.0`。
- 影响：低于 Obsidian 1.x 的应用版本可能不支持此处使用的现代 Svelte/运行时模式；安装在不支持版本的风险。

## 建议

1. 修复提供商启用逻辑

- 更新 `isRuntimeEnabled` 以考虑 `OpenAICompatible` 在 `baseUrl` 存在时启用；默认不要求 `apiKey`。可选地在设置中添加每个提供商标志 `requiresApiKey?: boolean` 以处理需要它的供应商。
- 或者，不要在 `ProviderService.refreshFromSettings` 中按 `isRuntimeEnabled` 过滤；将所有 `enabled` 提供商添加到 `ProviderManager`，并让每个提供商在 `initialize()` 期间抛出，并显示 Notice。

2. 通过 `ProviderService` 整合提供商访问

- 通过 `ProviderServiceApi` 公开 `getModel`、`getAvailableModels`、`getEnabledProviders`。
- 只传递 `ProviderService` 到 UI/存储。隐藏 `ProviderManager` 从 UI 以保持生命周期一致，并启用未来功能（断路器、重试、健康检查）。

3. 改进会话耐久性和写入放大

- 实现追加式持久化：添加 `appendItems(sessionId, items)` 仅更新增量。在 PGlite 中，保持 JSONB 但使用 `jsonb_set` 与连接，或切换到规范化 `session_items` 表。
- 在 `chat-session.ts` 中添加防抖/自动保存策略（例如，每 N 项或 T 秒保存）。在完成助理消息后立即持久化以减少丢失风险。
- 考虑大型会话的大小上限或归档策略。

4. 将 AgentManager 视为单一真相来源

- 避免在 UI 中直接变异 `agent.tools`。相反，调用管理器方法并重新加载快照（管理器已经在 `updateAgent` 中用新对象替换缓存条目）。
- 提供小型读取 API（例如，`getAgentSnapshot(id)`）以鼓励 UI 中的不可变消费。

5. DRY 类型模式

- 将 `ToolChoiceSchema` 去重到一个模块（例如，`src/types/common.ts`）并重新导出。
- 审计其他重叠（提供商描述符在 `types/provider.ts` 和 utils 转换中均存在）。

6. 强化 PGlite 资源加载

- 优先从包的公共导出导入（如果提供）而不是深路径。保持 esbuild 二进制加载器，但如果导入失败，添加带有说明的回退日志。
- 在 `DatabaseManager` 后面封装资源选择策略（预加载 vs IDB）以减少 `main.ts` 中的跨层知识。

7. 将提供商初始化错误显示给用户

- 在 `ProviderService.refreshFromSettings` 中添加小型 UI 通知系统或重用 Obsidian `Notice` 以报告初始化失败的提供商（无效密钥/基础 URL）。
- 通过 `EventBus` 发出详细事件（例如，带有状态负载的 `providersUpdated`），以便视图可以渲染警告。

8. 为演进准备迁移

- 将迁移重命名为 "V1: 基础模式" 并在更改时提升 `CURRENT_SCHEMA_VERSION`。
- 引入结构化迁移运行器，应用连续脚本并记录名称、校验和。

9. 文档刷新

- 用准确的功能和设置指南替换根 `README.md`；将 `AGENTS.md` 内容移到 README 或 `docs/` 下。
- 记录提供商配置、持久化行为（内存 vs PGlite）和故障排除（Electron/wasm 笔记）。

10. 纠正 `minAppVersion`

- 将 `minAppVersion` 设置为与使用的 Obsidian API 和 Svelte 5 嵌入对齐的版本（可能 `1.5.0+`）。经验验证并记录。

## 建议重构（目标差异）

- `src/utils/provider-runtime.ts`
    - 放松 `OpenAICompatible` 条件：默认仅接受 `baseUrl`。
    - 选项：包括 `requiresApiKey?: boolean` 在 `ProviderSettingsEntry` 中并尊重它。

- `src/providers/provider-service.ts`
    - 扩展 API 以代理 `getModel`、`getAvailableModels`、`getEnabledProviders`。
    - 在刷新时发出详细事件（每个提供商的成功/失败）。

- `src/session/chat-session.ts`
    - 添加可选 `autoSaveIntervalMs` 和定期刷新；在助理消息完成时立即持久化。
    - 当存储库存在时，使用追加语义而不是完整重写（尽可能）。

- `src/ui/component/tool/BuiltinToolsSelector.svelte`
    - 移除对 `agent.tools` 的直接变异；依赖管理器调用和后续刷新（`agentsChanged` 事件或注入回调）。

- `src/types/*`
    - 集中共享模式；导出并重用以消除重复。

## 增量路线图

阶段 1（低风险）

- 修复 `OpenAICompatible` 的 `isRuntimeEnabled` 逻辑。
- 为提供商初始化失败添加用户反馈（Notice + EventBus 负载）。
- 更新 README 和 `minAppVersion`。

阶段 2（中等）

- 仅通过 `ProviderService` 路由 UI；弃用 UI 中的直接 `ProviderManager` 使用。
- 移除对代理的直接 UI 变异；提供快照 API 并依赖事件。

阶段 3（中等/高）

- 引入会话自动保存和追加语义；在大型会话上测量性能。
- 加强迁移并规划规范化 `session_items` 表（如果需要）。

## 开放问题

- 提供商是否应在运行时执行模型发现并填充设置？如果是，`ProviderService` 应拥有发现并缓存结果以供 UI 使用。
- 对于托管工具（file_search/image_generation），考虑每个提供商凭据和能力发现流程。

## 验收标准（重构后）

- 仅使用 `baseUrl` 的 Ollama 开箱即用；模型列表渲染；聊天发送。
- 提供商失败作为用户可见通知显示，并在诊断面板中。
- 中途杀死 Obsidian 聊天最多丢失最后一条消息（或更少，使用自动保存）。
- UI 中无对领域对象的直接变异；变化通过事件和快照刷新传播。
- Linting 和 `svelte-check` 通过；构建保持 CJS 并完整嵌入 wasm/data。
