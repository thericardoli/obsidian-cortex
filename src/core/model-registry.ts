import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { OpenAIChatCompletionsModel, OpenAIResponsesModel } from '@openai/agents';
import { aisdk } from '@openai/agents-extensions';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import OpenAI from 'openai';

import { type BuiltinProviderId, isBuiltinProvider } from '../types/provider';

import type { CortexSettings } from '../settings/settings';

/** 解析后的模型配置 */
export interface ResolvedModelConfig {
    providerId: string;
    builtinId?: BuiltinProviderId;
    isCustom: boolean;
    modelID: string;
    apiKey: string;
    baseUrl?: string;
}

/**
 * 从 ChatView 的模型选择 ID 解析出模型配置
 *
 * @param selectedModelId 格式为 "providerId:modelID" 或纯 "modelID"
 * @param settings 插件设置
 * @returns 解析后的模型配置,供 createModel 创建实例
 */
export function parseModelSelection(
    selectedModelId: string,
    settings: CortexSettings
): ResolvedModelConfig | null {
    let providerId: string;
    let modelID: string;

    if (selectedModelId.includes(':')) {
        const parts = selectedModelId.split(':');
        providerId = parts[0];
        modelID = parts.slice(1).join(':');
    } else {
        providerId = 'openai';
        modelID = selectedModelId;
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
        modelID,
        apiKey: providerSettings.apiKey,
        baseUrl: providerSettings.baseUrl,
    };
}

/**
 * 根据解析后的配置创建适配后的模型实例
 *
 * - openai: 使用原生 OpenAIResponsesModel
 * - custom (OpenAI 兼容): 使用原生 OpenAIChatCompletionsModel（不支持 Responses API）
 * - 其他 builtin provider: 使用 ai-sdk 适配
 */
export function createModel(config: ResolvedModelConfig) {
    const { modelID, apiKey, baseUrl, isCustom, builtinId } = config;

    if (isCustom) {
        // 自定义 provider 使用 Chat Completions API（兼容性更好）
        const client = new OpenAI({ apiKey, baseURL: baseUrl, dangerouslyAllowBrowser: true });
        return new OpenAIChatCompletionsModel(client, modelID);
    }

    switch (builtinId) {
        case 'openai': {
            // OpenAI 原生使用 Responses API
            const client = new OpenAI({ apiKey, baseURL: baseUrl, dangerouslyAllowBrowser: true });
            return new OpenAIResponsesModel(client, modelID);
        }
        case 'anthropic': {
            const anthropic = createAnthropic({ apiKey, baseURL: baseUrl });
            return aisdk(anthropic(modelID));
        }
        case 'google': {
            const google = createGoogleGenerativeAI({ apiKey, baseURL: baseUrl });
            return aisdk(google(modelID));
        }
        case 'openrouter': {
            const openrouter = createOpenRouter({ apiKey, baseURL: baseUrl });
            return aisdk(openrouter(modelID));
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
