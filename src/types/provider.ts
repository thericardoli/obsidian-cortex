/**
 * Provider 类型定义 - 单一数据源
 *
 * 所有 Provider 相关的类型和元数据都在这里定义
 */

/** 内置 Provider ID */
export type BuiltinProviderId = 'openai' | 'anthropic' | 'gemini' | 'openrouter';

/** Provider 元数据 */
export interface ProviderMeta {
    id: string;
    label: string;
    defaultBaseUrl: string;
    isBuiltin: boolean;
}

/** 内置 Provider 元数据注册表 */
export const BUILTIN_PROVIDERS: Record<BuiltinProviderId, ProviderMeta> = {
    openai: {
        id: 'openai',
        label: 'OpenAI',
        defaultBaseUrl: 'https://api.openai.com/v1',
        isBuiltin: true,
    },
    anthropic: {
        id: 'anthropic',
        label: 'Anthropic',
        defaultBaseUrl: 'https://api.anthropic.com',
        isBuiltin: true,
    },
    gemini: {
        id: 'gemini',
        label: 'Gemini',
        defaultBaseUrl: 'https://generativelanguage.googleapis.com',
        isBuiltin: true,
    },
    openrouter: {
        id: 'openrouter',
        label: 'OpenRouter',
        defaultBaseUrl: 'https://openrouter.ai/api/v1',
        isBuiltin: true,
    },
};

/** 内置 Provider ID 列表 */
export const BUILTIN_PROVIDER_IDS = Object.keys(BUILTIN_PROVIDERS) as BuiltinProviderId[];

/** 检查是否为内置 Provider */
export function isBuiltinProvider(providerId: string): providerId is BuiltinProviderId {
    return providerId in BUILTIN_PROVIDERS;
}

/** 获取 Provider 元数据 */
export function getProviderMeta(providerId: string): ProviderMeta | undefined {
    if (isBuiltinProvider(providerId)) {
        return BUILTIN_PROVIDERS[providerId];
    }
    return undefined;
}

/** 获取 Provider 显示名称 */
export function getProviderLabel(providerId: string): string {
    return getProviderMeta(providerId)?.label ?? providerId;
}
