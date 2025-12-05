# Obsidian Cortex Agent Architecture

本文件描述基于 **OpenAI Agents SDK** 与 **Svelte AI 组件** 的 Obsidian 插件整体架构设计。目标是：

- 在 Obsidian 中提供一个可视化的多 Agent 助手。
- 支持用户创建多个 Agent，每个 Agent 有独立的 instruction、model、tools、handoff 策略。
- 支持 Agent 之间 handoff，以及在 UI 中清晰可视化。
- 支持用户通过脚本编写自定义 function tool 并注入到 Agents。
- 充分利用现有的 Svelte 组件（PromptInput、Message、Response、ChainOfThought 等）。

---

## 1. 顶层结构概览

目录结构规划（与现有代码整合）：

```text
src/
├── main.ts                      # 插件入口，生命周期管理
├── types/
│   ├── agent.ts                 # Agent 配置类型
│   ├── tool.ts                  # Tool 类型定义
│   └── conversation.ts          # 会话/消息类型
│
├── core/
│   ├── agent-registry.ts        # Agent 注册与实例化
│   ├── tool-registry.ts         # Tool 注册、管理与脚本加载
│   ├── conversation-manager.ts  # 会话管理（多轮对话）
│   └── runner-service.ts        # 对 OpenAI Agents Runner 的封装
│
├── agents/                      # 内置 Agent 定义（可选）
│   ├── default-agent.ts
│   └── index.ts
│
├── tools/                       # 内置 Tools 实现（面向 vault / Obsidian）
│   ├── vault-search.ts          # 搜索 Vault 文件
│   ├── note-read.ts             # 读取笔记内容
│   ├── note-write.ts            # 创建/编辑笔记
│   ├── vault-query.ts           # Dataview 风格查询
│   └── index.ts
│
├── scripting/                   # 用户自定义脚本支持
│   ├── script-loader.ts         # 扫描并加载用户脚本
│   ├── tool-sandbox.ts          # 安全执行用户脚本
│   └── script-api.ts            # 暴露给脚本的高层 API
│
├── stores/                      # Svelte 响应式状态
│   ├── agents.svelte.ts         # Agent 列表 / 选中 Agent
│   ├── conversations.svelte.ts  # 会话状态
│   ├── settings.svelte.ts       # 插件设置
│   └── streaming.svelte.ts      # 当前流式输出状态
│
├── views/                       # Obsidian 视图与 Svelte UI
│   ├── chat-view/
│   │   ├── ChatView.ts          # Obsidian ItemView
│   │   ├── ChatView.svelte      # 核心聊天界面
│   │   ├── AgentSelector.svelte # Agent 选择
│   │   └── HandoffIndicator.svelte
│   ├── agent-config-view/
│   │   ├── AgentConfigView.ts   # Agent 配置视图
│   │   ├── AgentEditor.svelte   # 编辑名称/instruction/tools
│   │   └── ToolSelector.svelte
│   └── script-editor-view/      # 用户脚本管理/编辑视图（后期）
│
├── settings/
│   ├── settings-tab.ts          # Obsidian 设置页（PluginSettingTab）
│   ├── settings.ts              # 设置接口、默认值、load/save
│   └── SettingsUI.svelte
│
└── lib/                         # 现有 UI 组件库
    └── components/
        └── ai-elements/...
```

注意：本文件描述的是规划结构，实际实现会分阶段推进，优先实现 core 模块与 Agent 流程。

---

## 2. 核心数据模型

### 2.1 AgentConfig

用户可配置的 Agent 元数据，将通过 `plugin.loadData()` / `plugin.saveData()` 持久化：

```ts
// src/types/agent.ts
export interface AgentConfig {
    id: string; // 稳定 ID
    name: string; // 显示名称
    instructions: string; // 系统指令
    model: string; // 使用的模型 ID
    handoffDescription?: string; // 当其他 agent handoff 到它时的说明
    handoffIds: string[]; // 允许 handoff 的其他 Agent IDs
    toolIds: string[]; // 此 Agent 启用的工具 IDs
    enabled: boolean; // 是否启用
}
```

### 2.2 ToolDefinition

用于内部管理的工具定义（不直接暴露给 OpenAI SDK，而是经过 `ToolRegistry` 转换）：

```ts
// src/types/tool.ts
import type { z } from 'zod';
import type { App, Vault, Workspace } from 'obsidian';

export interface ToolContext {
    app: App;
    vault: Vault;
    workspace: Workspace;
}

export interface ToolDefinition {
    id: string; // 稳定 ID
    name: string; // tool(...) 的 name
    description: string; // 工具描述
    parameters: z.ZodSchema; // 参数 schema
    execute: (input: unknown, ctx: ToolContext) => Promise<unknown>;
    builtin: boolean; // 是否为内置工具
}
```

### 2.3 Conversation / Message

用于 UI 层展示与持久化：

```ts
// src/types/conversation.ts
import type { UIMessage } from 'ai';

export interface Conversation {
    id: string;
    agentId: string; // 使用的 Agent
    messages: UIMessage[]; // 聊天记录
    createdAt: string; // ISO
    updatedAt: string; // ISO
}
```

### 2.4 PluginData

插件的整体持久化数据结构：

```ts
export interface PluginData {
    agents: AgentConfig[];
    conversations: Conversation[];
    // 用户脚本定义 custom tools 信息（元数据 + 文件路径）
    customTools: CustomToolConfig[];
    settings: PluginSettings;
}
```

---

## 3. 核心模块设计

### 3.1 AgentRegistry

职责：

- 从 `AgentConfig[]` 创建/缓存 OpenAI SDK `Agent` 实例。
- 处理 handoff：根据 `handoffIds` 递归构造代理树。
- 对外提供 CRUD 接口，便于设置页/Agent 配置 UI 管理。

关键接口（简化示意）：

```ts
class AgentRegistry {
    constructor(
        private toolRegistry: ToolRegistry,
        private getConfigs: () => AgentConfig[],
        private setConfigs: (configs: AgentConfig[]) => Promise<void>
    ) {}

    list(): AgentConfig[];
    getConfig(id: string): AgentConfig | undefined;
    upsert(config: AgentConfig): Promise<void>;
    remove(id: string): Promise<void>;

    buildAgent(id: string): Agent; // 按需构建 OpenAI Agent
}
```

`buildAgent` 的逻辑：

1. 从 `AgentConfig` 读取模型、指令、工具 ID、handoff IDs。
2. 从 `ToolRegistry` 获取工具定义，转换为 `tool({ ... })`。
3. 对每个 `handoffId` 调用 `buildAgent`，防止递归环路（需要简单的检测）。
4. 返回新的 `Agent` 实例。

### 3.2 ToolRegistry

职责：

- 管理所有可用工具（内置 + 用户自定义脚本）。
- 将内部 `ToolDefinition` 转换为 `@openai/agents` 的 `tool(...)` 实例供 Agent 使用。
- 对外提供列表/获取接口，供 Agent 配置 UI 使用。

关键接口（简化示意）：

```ts
class ToolRegistry {
    constructor(private app: App) {}

    register(def: ToolDefinition): void; // 内部注册
    getDefinition(id: string): ToolDefinition | undefined;
    listDefinitions(): ToolDefinition[];

    // 给 AgentRegistry 使用
    getSdkTool(id: string): Tool | undefined;
}
```

后续扩展（用户脚本）：

- 扫描指定目录 `.obsidian/plugins/obsidian-cortex/tools/*.js`。
- 加载脚本，读取导出的 `name/description/parameters/execute`。
- 将简单的参数 schema DSL 转为 `zod`。
- 注册为非 builtin 的 `ToolDefinition`。

### 3.3 RunnerService

职责：

- 封装 `Runner.run` / `Runner.runStreamed`。
- 把 `streamEvents()` 转为适合 Svelte UI 的状态更新（例如当前 Agent 名称、流式输出文本、工具调用日志等）。
- 支持多轮对话（`RunResult.toInputList()`）。

关键接口（简化示意）：

```ts
interface StreamCallbacks {
    onTextDelta?: (delta: string) => void;
    onAgentSwitch?: (agent: Agent) => void;
    onToolCall?: (info: unknown) => void;
}

class RunnerService {
    isStreaming = $state(false);
    currentAgentName = $state<string | null>(null);
    streamingText = $state('');

    async runOnce(agent: Agent, input: string | InputItem[]): Promise<RunResult>;

    async runStreamed(
        agent: Agent,
        input: string | InputItem[],
        callbacks?: StreamCallbacks
    ): Promise<RunResult>;
}
```

`runStreamed` 内部会：

1. 设置 `isStreaming = true`、清空 `streamingText`。
2. 调用 `Runner.runStreamed(agent, input)` 获取结果。
3. `for await (const event of result.streamEvents())` 循环：
    - `raw_response_event`：追加 `delta` 到 `streamingText`，并触发 `onTextDelta`。
    - `agent_updated_stream_event`：更新 `currentAgentName`，触发 `onAgentSwitch` —— 用于 UI 显示 handoff。
    - `run_item_stream_event`：记录 tool 调用或输出，触发 `onToolCall`。
4. 结束后设置 `isStreaming = false` 并返回 `RunResult`。

---

## 4. UI 层集成思路

### 4.1 Chat View

- 使用已有的 `PromptInput`, `Message`, `Response`, `ChainOfThought` 等组件。
- 左上角 AgentSelector 选择当前 Agent。
- 主体区域显示会话消息 + 实时 Response。
- 当发生 handoff 时，顶部或消息中显示当前回答 Agent 名称及其 handoff 路径。

示意流程：

1. 用户在 `AgentSelector` 中选择一个 Agent（`selectedAgentId`）。
2. 用户在 `PromptInput` 输入消息并提交：
    - 会话 store 记录一条新 `user` 消息。
    - 使用 `AgentRegistry.buildAgent(selectedAgentId)` 构造 Agent。
    - 调用 `RunnerService.runStreamed`：
        - 实时更新 `streamingText` 给一个临时的 `assistant` 消息。
        - 捕捉 `agent_updated_stream_event` 更新 UI 中当前 Agent 标识。
    - 最终得到 `finalOutput`：写入会话消息列表。

### 4.2 Agent 管理 UI

- 提供一个独立的 View 或设置页：
    - Agent 列表（名称、模型、启用状态）。
    - 点击某个 Agent 进入编辑界面：
        - 编辑名称、model、instructions。
        - 多选 Tools（从 `ToolRegistry.listDefinitions()` 中选择）。
        - 选择 handoff 目标 Agents（`handoffIds`）。

---

## 5. 用户自定义工具脚本（后续阶段）

目标：允许用户通过脚本扩展工具，例如：

```js
// .obsidian/plugins/obsidian-cortex/tools/get-weather.js

module.exports = {
    id: 'get_weather',
    name: 'get_weather',
    description: 'Get weather for a given city',
    parameters: {
        city: { type: 'string', description: 'City name' },
    },
    /**
     * @param {{ city: string }} input
     * @param {ToolContext} ctx
     */
    execute: async ({ city }, ctx) => {
        const res = await fetch(`https://api.example.com/weather?city=${encodeURIComponent(city)}`);
        return await res.text();
    },
};
```

大致流程：

1. `script-loader` 扫描工具目录并加载脚本模块。
2. 校验导出的对象结构是否符合要求。
3. 将 `parameters`（简化 DSL）转换为 `zod` schema。
4. 创建 `ToolDefinition` 并注册到 `ToolRegistry`。

安全性：

- 初期可以假设用户脚本在其本地环境中运行，安全界限主要由 Obsidian 插件环境本身承担。
- 后期可考虑限制网络访问、限制文件访问等。

---

## 6. 与 OpenAI Agents SDK 的映射关系

- `AgentConfig` → `new Agent({...})` 配置对象。
- `ToolDefinition` → `tool({...})` 对象，并注入 Obsidian 的 `ToolContext`。
- 多 Agent handoff：通过 `AgentConfig.handoffIds` 构造 `Agent` 的 `handoffs` 数组。
- 流式输出：使用 `Runner.runStreamed` + `streamEvents()` 映射到 UI 消息状态。
- 多轮对话：通过 `RunResult.toInputList()` 构建下一轮的输入（未来可支持对话上下文保持）。

---

## 7. 当前阶段实现范围

本阶段先实现：

1. **类型定义**：`types/agent.ts`, `types/tool.ts`, `types/conversation.ts`。
2. **核心模块**：`core/agent-registry.ts`, `core/tool-registry.ts`, `core/runner-service.ts`。
3. 在 `main.ts` 中简单初始化这些核心对象，以便后续 UI 集成。

后续阶段：

- Conversation 管理 store 与 UI 集成。
- Agent 配置 UI。
- 用户脚本工具加载与脚本 API。
- handoff 状态可视化细节。
