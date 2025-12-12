/** 模型参数设置 */
export interface ModelSettings {
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    toolChoice?: 'auto' | 'required' | 'none' | string;
    parallelToolCalls?: boolean;
    reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
    textVerbosity?: 'low' | 'medium' | 'high';
}

/** 模型配置（用于 Settings 存储） */
export interface ModelConfig {
    id: string;
    name: string; // UI 显示名称
    modelID: string; // 发送给 provider 的模型名
}
