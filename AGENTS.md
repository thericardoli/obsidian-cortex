# Obsidian Cortex - AI Coding Instructions

Obsidian 插件，提供基于 OpenAI Agents SDK 的多 Agent 可视化助手，支持 Agent handoff、自定义工具和流式响应。

## 架构概览

```
main.ts                 # 插件入口，只负责生命周期管理
src/core/               # 核心业务逻辑
  ├── agent-registry    # Agent 配置管理与 SDK Agent 实例构建
  ├── model-registry    # LLM provider/model 配置解析
  ├── tool-registry     # 工具注册，ToolDefinition → SDK tool() 转换
  └── runner-service    # Runner.runStreamed 封装，流式事件处理
src/types/              # 核心类型定义 (AgentConfig, ToolDefinition, LLMModelConfig)
src/ui/chat-view/       # Obsidian ItemView + Svelte 聊天界面
src/lib/components/     # 可复用 Svelte 组件库 (ai-elements/, ui/)
src/settings/           # 插件设置 (CortexSettings, PluginSettingTab)
```

## 技术栈

- **构建**: Vite + esbuild，直接输出到根目录 (`outDir: './'`)
- **UI**: Svelte 5 (runes 模式, `$state`, `$props`)，Tailwind CSS v4
- **AI SDK**: `@openai/agents` (Agent/Runner/tool)，`ai` 包类型
- **路径别名**: `$lib` → `src/lib`（见 `tsconfig.json` paths）

## 关键开发命令

```bash
bun install                    # 安装依赖
bun run dev                    # watch 模式构建
bun run build 2>&1 | tail -3   # 生产构建（简洁输出）
bun run build:dev              # 开发构建（未压缩，带 sourcemap）
bun run lint                   # ESLint 检查
bun run svelte-check           # Svelte 类型检查
```

## 核心模式与约定

### Agent 系统

1. **AgentConfig** → **Agent** 转换流程 (`agent-registry.ts`):
    - `AgentRegistry.buildAgent(id)` 递归构建含 handoff 的 Agent 树
    - 工具 ID 通过 `ToolRegistry.getSdkTool()` 解析
    - 模型通过 `ModelRegistry.resolveForAgent()` 解析

2. **工具定义** (`src/types/tool.ts`):

    ```ts
    interface ToolDefinition {
        id: string;
        parameters: z.ZodSchema; // 必须是 zod schema
        execute: (input, ctx: ToolContext) => Promise<unknown>;
    }
    ```

    - `ToolContext` 提供 `app`, `vault`, `workspace` 访问

### Svelte 组件

- 使用 **Svelte 5 runes**: `$state()`, `$props()`, `$derived()`
- 组件挂载到 Obsidian 视图: `mount(Component, { target, props })`
- AI 组件位于 `src/lib/components/ai-elements/`，按功能分组
- UI 基础组件位于 `src/lib/components/ui/`
- **禁止使用 `<style>` 块**，所有样式必须使用 Tailwind CSS 类名

### 设置管理

```ts
// main.ts 中加载/保存
this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
await this.saveData(this.settings);
```

## 文件命名与导出

- Svelte 组件: `PascalCase.svelte`
- TypeScript: `kebab-case.ts`
- 每个组件目录包含 `index.ts` 导出所有公共组件
- 类型定义集中在 `src/types/`

## 注意事项

- **勿提交构建产物**: `main.js`, `styles.css` 由构建生成
- **保持 main.ts 精简**: 只包含 `onload/onunload` 和命令注册
- **Obsidian API 外部化**: Vite 配置中 `obsidian` 已设为 external
- **ESLint any 规则**: 部分 SDK 交互处需 `eslint-disable` 注释
