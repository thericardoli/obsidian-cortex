import type { LLMModelConfig, LLMProviderConfig } from '../types/model';

/** Provider 设置，存储 API Key 和 Base URL */
export interface ProviderSettings {
    apiKey: string;
    baseUrl?: string;
    models: ModelSettings[];
}

/** 模型设置 */
export interface ModelSettings {
    id: string;
    name: string;
    modelName: string;
}

export interface CortexSettings {
    /** Provider 配置，key 为 provider id */
    providers: Record<string, ProviderSettings>;
    /** 当前选中的 provider id */
    activeProviderId: string;
    
    // 保留旧字段以兼容
    openaiApiKey: string;
    openrouterApiKey: string;
    openaiDefaultModel: string;
    openrouterDefaultModel: string;
}

/** 默认支持的 Provider 列表 */
export const DEFAULT_PROVIDERS = [
    { id: 'openai', label: 'OpenAI', defaultBaseUrl: 'https://api.openai.com/v1' },
    { id: 'anthropic', label: 'Anthropic', defaultBaseUrl: 'https://api.anthropic.com' },
    { id: 'gemini', label: 'Gemini', defaultBaseUrl: 'https://generativelanguage.googleapis.com' },
    { id: 'openrouter', label: 'OpenRouter', defaultBaseUrl: 'https://openrouter.ai/api/v1' },
    { id: 'custom1', label: 'Custom 1', defaultBaseUrl: '' },
    { id: 'custom2', label: 'Custom 2', defaultBaseUrl: '' },
] as const;

export const DEFAULT_SETTINGS: CortexSettings = {
    providers: {
        openai: {
            apiKey: '',
            baseUrl: 'https://api.openai.com/v1',
            models: [{ id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', modelName: 'gpt-4.1-mini' }],
        },
        anthropic: {
            apiKey: '',
            baseUrl: 'https://api.anthropic.com',
            models: [{ id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', modelName: 'claude-3-5-sonnet-20241022' }],
        },
        gemini: {
            apiKey: '',
            baseUrl: 'https://generativelanguage.googleapis.com',
            models: [{ id: 'gemini-pro', name: 'Gemini Pro', modelName: 'gemini-pro' }],
        },
        openrouter: {
            apiKey: '',
            baseUrl: 'https://openrouter.ai/api/v1',
            models: [{ id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', modelName: 'openai/gpt-4o-mini' }],
        },
        custom1: {
            apiKey: '',
            baseUrl: '',
            models: [],
        },
        custom2: {
            apiKey: '',
            baseUrl: '',
            models: [],
        },
    },
    activeProviderId: 'openai',
    // 保留旧字段
    openaiApiKey: '',
    openrouterApiKey: '',
    openaiDefaultModel: 'gpt-4.1-mini',
    openrouterDefaultModel: 'openai/gpt-4o-mini',
};

export function buildDefaultProviders(): LLMProviderConfig[] {
    const providers: LLMProviderConfig[] = [
        {
            id: 'openai',
            label: 'OpenAI',
            kind: 'openai',
            apiKeySettingKey: 'openaiApiKey',
        },
        {
            id: 'openrouter',
            label: 'OpenRouter',
            kind: 'ai-sdk',
            apiKeySettingKey: 'openrouterApiKey',
            baseUrl: 'https://openrouter.ai/api/v1',
        },
    ];

    return providers;
}

export function buildDefaultModels(settings: CortexSettings): LLMModelConfig[] {
    const models: LLMModelConfig[] = [];

    // OpenAI 默认模型
    models.push({
        id: 'openai:default',
        providerId: 'openai',
        displayName: `OpenAI (${settings.openaiDefaultModel})`,
        modelName: settings.openaiDefaultModel,
        mode: 'text',
        modelSettings: {
            temperature: 0.3,
        },
    });

    // OpenRouter 默认模型（基于 AI SDK 提供者）
    models.push({
        id: 'openrouter:default',
        providerId: 'openrouter',
        displayName: `OpenRouter (${settings.openrouterDefaultModel})`,
        modelName: settings.openrouterDefaultModel,
        mode: 'text',
        modelSettings: {
            temperature: 0.3,
        },
    });

    return models;
}
