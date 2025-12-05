import type { ModelConfig } from '../types/model';
import { BUILTIN_PROVIDERS, BUILTIN_PROVIDER_IDS, type BuiltinProviderId } from '../types/provider';

/** Provider 运行时配置（存储于 Settings） */
export interface ProviderSettings {
    apiKey: string;
    baseUrl?: string;
    models: ModelConfig[];
}

/** 自定义 Provider 配置 */
export interface CustomProviderConfig {
    id: string;
    name: string;
    baseUrl: string;
    apiKey: string;
}

export interface CortexSettings {
    /** Provider 配置，key 为 provider id */
    providers: Record<string, ProviderSettings>;
    /** 当前选中的 provider id */
    activeProviderId: string;
    /** 自定义 Provider 列表 */
    customProviders: CustomProviderConfig[];
}

// Re-export for backward compatibility
export { BUILTIN_PROVIDERS, BUILTIN_PROVIDER_IDS };
export type { BuiltinProviderId };

/** 生成默认 Provider 配置 */
function createDefaultProviders(): Record<string, ProviderSettings> {
    return {
        openai: {
            apiKey: '',
            baseUrl: BUILTIN_PROVIDERS.openai.defaultBaseUrl,
            models: [{ id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', modelName: 'gpt-4.1-mini' }],
        },
        anthropic: {
            apiKey: '',
            baseUrl: BUILTIN_PROVIDERS.anthropic.defaultBaseUrl,
            models: [
                {
                    id: 'claude-sonnet-4',
                    name: 'Claude Sonnet 4',
                    modelName: 'claude-sonnet-4-20250514',
                },
            ],
        },
        gemini: {
            apiKey: '',
            baseUrl: BUILTIN_PROVIDERS.gemini.defaultBaseUrl,
            models: [
                { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', modelName: 'gemini-2.5-flash' },
            ],
        },
        openrouter: {
            apiKey: '',
            baseUrl: BUILTIN_PROVIDERS.openrouter.defaultBaseUrl,
            models: [
                { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', modelName: 'openai/gpt-4o-mini' },
            ],
        },
    };
}

export const DEFAULT_SETTINGS: CortexSettings = {
    providers: createDefaultProviders(),
    activeProviderId: 'openai',
    customProviders: [],
};
