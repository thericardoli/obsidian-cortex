import type { AgentConfig } from '../types/agent';
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
    /** Agent 配置列表 */
    agentConfigs: AgentConfig[];
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

function createDefaultAgentConfigs(): AgentConfig[] {
    return [
        {
            id: 'agent-general',
            name: '通用助手',
            kind: 'builtin',
            instructions:
                '你是 Obsidian 中的通用 AI 助手，帮助用户进行写作、整理和创意发散。回答保持简洁清晰，必要时给出 Markdown 示例。',
            modelId: 'openai:gpt-4.1-mini',
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
            modelId: 'openai:gpt-4.1-mini',
            handoffDescription: '将整理好的内容交给通用助手输出最终版本。',
            handoffIds: ['agent-general'],
            toolIds: [],
            enabled: true,
        },
    ];
}

export const DEFAULT_SETTINGS: CortexSettings = {
    providers: createDefaultProviders(),
    activeProviderId: 'openai',
    customProviders: [],
    agentConfigs: createDefaultAgentConfigs(),
};
