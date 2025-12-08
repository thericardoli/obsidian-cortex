export type AgentKind = 'builtin' | 'custom';

export interface AgentModelSettingsOverride {
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    toolChoice?: 'auto' | 'required' | 'none' | string;
    parallelToolCalls?: boolean;
    reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
    textVerbosity?: 'low' | 'medium' | 'high';
}

export interface AgentConfig {
    id: string;
    name: string;
    kind: AgentKind;
    instructions: string;

    /**
     * 引用某个已配置模型的 ID，而不是直接写 'gpt-4.1' 等字符串。
     * 具体的 provider、模型名和默认参数由 ModelRegistry 解析。
     */
    modelId: string;

    /** 每个 Agent 自己对默认模型参数的覆盖设置（可选）。 */
    modelSettingsOverride?: AgentModelSettingsOverride;

    /**
     * 人类可读的 Agent 描述。主要用于在 UI 中展示，以及在 handoff 场景下提示此 Agent 的专长。
     *
     * 内部会与 `handoffDescription` 保持一致，以兼容 Agents SDK 的 handoff 描述用法。
     */
    description: string;

    handoffDescription?: string;
    handoffIds: string[];
    toolIds: string[];
    enabled: boolean;
}
