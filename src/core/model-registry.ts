import type { ModelSettings } from '@openai/agents-core';
import type { AgentConfig, AgentModelSettingsOverride } from '../types/agent';
import type { LLMModelConfig, LLMModelSettings, LLMProviderConfig } from '../types/model';

// 最小版 ModelRegistry：目前只支持 kind === 'openai'，即直接使用字符串模型名。
// 后续可以扩展 ai-sdk/custom 等。

export interface ProviderSecrets {
    apiKey?: string;
    baseUrl?: string;
}

export class ModelRegistry {
    private providers = new Map<string, LLMProviderConfig>();
    private models = new Map<string, LLMModelConfig>();

    constructor(
        providerConfigs: LLMProviderConfig[] = [],
        modelConfigs: LLMModelConfig[] = [],
        private readonly getSecrets: (providerId: string) => ProviderSecrets = () => ({})
    ) {
        for (const p of providerConfigs) {
            this.providers.set(p.id, p);
        }
        for (const m of modelConfigs) {
            this.models.set(m.id, m);
        }
    }

    upsertProvider(config: LLMProviderConfig) {
        this.providers.set(config.id, config);
    }

    listProviders(): LLMProviderConfig[] {
        return Array.from(this.providers.values());
    }

    upsertModel(config: LLMModelConfig) {
        this.models.set(config.id, config);
    }

    listModels(): LLMModelConfig[] {
        return Array.from(this.models.values());
    }

    getModelConfig(id: string): LLMModelConfig | undefined {
        return this.models.get(id);
    }

    /**
     * 根据 Agent 配置解析出传给 Agent 构造函数的 model / modelSettings。
     * 当前实现：
     * - kind === 'openai' 时，直接返回 modelName 字符串；
     * - 其它 provider 暂时返回 undefined（后续扩展）。
     */
    resolveForAgent(agent: AgentConfig): {
        model?: string;
        modelSettings?: ModelSettings;
    } {
        const modelConfig = this.getModelConfig(agent.modelId);
        if (!modelConfig) return {};

        const provider = this.providers.get(modelConfig.providerId);
        if (!provider) return {};

        const merged = this.mergeSettings(modelConfig.modelSettings, agent.modelSettingsOverride);

        if (provider.kind === 'openai') {
            return {
                model: modelConfig.modelName,
                modelSettings: this.toSdkModelSettings(merged),
            };
        }

        // 其它 provider 暂未实现，留空让 SDK 使用默认设置
        return {
            modelSettings: this.toSdkModelSettings(merged),
        };
    }

    private mergeSettings(
        base?: LLMModelSettings,
        override?: AgentModelSettingsOverride
    ): LLMModelSettings | undefined {
        if (!base && !override) return undefined;
        return {
            ...base,
            ...override,
        };
    }

    private toSdkModelSettings(settings?: LLMModelSettings): ModelSettings | undefined {
        if (!settings) return undefined;

        const result: ModelSettings = {};

        if (typeof settings.temperature === 'number') {
            result.temperature = settings.temperature;
        }
        if (typeof settings.topP === 'number') {
            result.topP = settings.topP;
        }
        if (typeof settings.maxTokens === 'number') {
            result.maxTokens = settings.maxTokens;
        }
        if (typeof settings.toolChoice !== 'undefined') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (result as any).toolChoice = settings.toolChoice;
        }
        if (typeof settings.parallelToolCalls === 'boolean') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (result as any).parallelToolCalls = settings.parallelToolCalls;
        }
        if (settings.reasoningEffort) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (result as any).reasoning = { effort: settings.reasoningEffort };
        }
        if (settings.textVerbosity) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (result as any).text = { verbosity: settings.textVerbosity };
        }

        return result;
    }
}
