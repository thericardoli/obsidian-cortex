/**
 * Model 类型定义
 *
 * Provider 相关类型已移至 ./provider.ts
 */

// Re-export provider types for backward compatibility
export type { BuiltinProviderId } from './provider';

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
    modelName: string; // 发送给 provider 的模型名
}
