import { BUILTIN_PROVIDER_IDS, BUILTIN_PROVIDERS, type BuiltinProviderId } from '../types/provider';

import type { AgentConfig } from '../types/agent';
import type { ModelConfig } from '../types/model';

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
export { BUILTIN_PROVIDER_IDS, BUILTIN_PROVIDERS };
export type { BuiltinProviderId };

/** Workspace event fired whenever settings are saved */
export const SETTINGS_UPDATED_EVENT = 'cortex-settings-updated';

/** 生成默认 Provider 配置 */
function createDefaultProviders(): Record<string, ProviderSettings> {
    return {
        openai: {
            apiKey: '',
            baseUrl: BUILTIN_PROVIDERS.openai.defaultBaseUrl,
            models: [],
        },
        anthropic: {
            apiKey: '',
            baseUrl: BUILTIN_PROVIDERS.anthropic.defaultBaseUrl,
            models: [],
        },
        gemini: {
            apiKey: '',
            baseUrl: BUILTIN_PROVIDERS.gemini.defaultBaseUrl,
            models: [],
        },
        openrouter: {
            apiKey: '',
            baseUrl: BUILTIN_PROVIDERS.openrouter.defaultBaseUrl,
            models: [],
        },
    };
}

function createDefaultAgentConfigs(): AgentConfig[] {
    return [
        {
            id: 'agent-general',
            name: '通用助手',
            kind: 'builtin',
            instructions:
                '你是 Obsidian 中的通用 AI 助手，帮助用户进行写作、整理和创意发散。回答保持简洁清晰，必要时给出 Markdown 示例。',
            description: '默认处理日常问题和内容润色。',
            handoffDescription: '默认处理日常问题和内容润色。',
            handoffIds: [],
            toolIds: [],
            enabled: true,
        },
        {
            id: 'agent-researcher',
            name: '研究助手',
            kind: 'builtin',
            instructions:
                '善于信息拆解、总结要点与给出行动步骤。遇到写作类任务可以移交给通用助手继续润色。',
            description: '将整理好的内容交给通用助手输出最终版本。',
            handoffDescription: '将整理好的内容交给通用助手输出最终版本。',
            handoffIds: ['agent-general'],
            toolIds: [],
            enabled: true,
        },
    ];
}

export const DEFAULT_AGENT_CONFIGS = createDefaultAgentConfigs();

export const DEFAULT_SETTINGS: CortexSettings = {
    providers: createDefaultProviders(),
    activeProviderId: 'openai',
    customProviders: [],
};
