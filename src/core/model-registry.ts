/**
 * Model Registry - 模型配置解析与实例创建
 *
 * 职责：
 * - 解析 ChatView 的模型选择 ID
 * - 创建适配后的模型实例（支持多 provider）
 * - 检查 provider 配置状态
 */

import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { aisdk } from '@openai/agents-extensions';
import type { CortexSettings } from '../settings/settings';
import { isBuiltinProvider, type BuiltinProviderId } from '../types/provider';

/** 解析后的模型配置 */
export interface ResolvedModelConfig {
    providerId: string;
    builtinId?: BuiltinProviderId;
    isCustom: boolean;
    modelName: string;
    apiKey: string;
    baseUrl?: string;
}

/**
 * 从 ChatView 的模型选择 ID 解析出模型配置
 *
 * @param selectedModelId 格式为 "providerId:modelName" 或纯 "modelName"
 * @param settings 插件设置
 * @returns 解析后的模型配置，供 createModel 创建实例
 */
export function parseModelSelection(
    selectedModelId: string,
    settings: CortexSettings
): ResolvedModelConfig | null {
    let providerId: string;
    let modelName: string;

    if (selectedModelId.includes(':')) {
        const parts = selectedModelId.split(':');
        providerId = parts[0];
        modelName = parts.slice(1).join(':');
    } else {
        providerId = 'openai';
        modelName = selectedModelId;
    }

    const providerSettings = settings.providers[providerId];
    if (!providerSettings?.apiKey) {
        console.warn(`Provider ${providerId} not configured or missing API key`);
        return null;
    }

    const isCustom = !isBuiltinProvider(providerId);

    return {
        providerId,
        builtinId: isCustom ? undefined : (providerId as BuiltinProviderId),
        isCustom,
        modelName,
        apiKey: providerSettings.apiKey,
        baseUrl: providerSettings.baseUrl,
    };
}

/**
 * 根据解析后的配置创建适配后的模型实例
 *
 * - builtin provider: 使用专用 SDK (openai/anthropic/gemini/openrouter)
 * - custom provider: 使用 OpenAI 兼容 API
 */
export function createModel(config: ResolvedModelConfig) {
    const { modelName, apiKey, baseUrl, isCustom, builtinId } = config;

    if (isCustom) {
        const openai = createOpenAI({ apiKey, baseURL: baseUrl });
        return aisdk(openai(modelName));
    }

    switch (builtinId) {
        case 'openai': {
            const openai = createOpenAI({ apiKey, baseURL: baseUrl });
            return aisdk(openai(modelName));
        }
        case 'anthropic': {
            const anthropic = createAnthropic({ apiKey, baseURL: baseUrl });
            return aisdk(anthropic(modelName));
        }
        case 'gemini': {
            const google = createGoogleGenerativeAI({ apiKey, baseURL: baseUrl });
            return aisdk(google(modelName));
        }
        case 'openrouter': {
            const openrouter = createOpenRouter({ apiKey, baseURL: baseUrl });
            return aisdk(openrouter(modelName));
        }
        default:
            throw new Error(`Unknown builtin provider: ${builtinId}`);
    }
}

/**
 * 检查指定 provider 是否已配置（有 API Key）
 */
export function isProviderConfigured(providerId: string, settings: CortexSettings): boolean {
    return !!settings.providers[providerId]?.apiKey;
}

/**
 * 获取所有已配置的 provider ID 列表
 */
export function getConfiguredProviders(settings: CortexSettings): string[] {
    return Object.entries(settings.providers)
        .filter(([_, p]) => p.apiKey)
        .map(([id]) => id);
}
