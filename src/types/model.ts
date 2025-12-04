// LLM Provider & Model 配置类型，用于支持多 provider、多模型。

export type ProviderKind = 'openai' | 'ai-sdk' | 'custom';

export interface LLMProviderConfig {
    id: string; // 内部 ID，例如 "openai"、"openrouter"
    label: string; // UI 显示名称
    kind: ProviderKind;

    // 身份认证 / 连接信息由插件 settings 提供，这里只保存 key 的键名
    apiKeySettingKey: string;
    baseUrl?: string;
}

export interface LLMModelSettings {
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    toolChoice?: 'auto' | 'required' | 'none' | string;
    parallelToolCalls?: boolean;
    reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
    textVerbosity?: 'low' | 'medium' | 'high';
}

export interface LLMModelConfig {
    id: string; // 内部模型 ID，例如 "openai:gpt-4.1"
    providerId: string; // 对应的 provider
    displayName: string; // UI 展示名称
    modelName: string; // 发送给 provider 的模型名，例如 'gpt-4.1'
    mode: 'text'; // 预留，将来可以支持 'realtime' 等
    modelSettings?: LLMModelSettings; // 默认参数，可被 Agent 覆盖
}
