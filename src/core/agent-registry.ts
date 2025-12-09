/**
 * AgentRegistry - Agent 配置管理
 *
 * 职责：
 * - 管理 AgentConfig 配置
 * - 构建 Agent 实例（需要外部提供 model）
 *
 * 注意：model 创建由调用者负责，使用 model-registry.ts 中的 createModel
 */

import { Agent, type Model, type ModelSettings } from '@openai/agents';
import type { AgentConfig, AgentModelSettingsOverride } from '../types/agent';
import type { ToolRegistry } from './tool-registry';

export interface BuildAgentOptions {
    model?: Model;
    resolveModel?: (config: AgentConfig) => Model;
}

export class AgentRegistry {
    private configs = new Map<string, AgentConfig>();

    constructor(
        private toolRegistry: ToolRegistry,
        initialConfigs: AgentConfig[] = []
    ) {
        for (const config of initialConfigs) {
            this.configs.set(config.id, config);
        }
    }

    list(): AgentConfig[] {
        return Array.from(this.configs.values());
    }

    getConfig(id: string): AgentConfig | undefined {
        return this.configs.get(id);
    }

    upsert(config: AgentConfig) {
        this.configs.set(config.id, config);
    }

    remove(id: string) {
        this.configs.delete(id);
    }

    buildAgent(id: string, options: BuildAgentOptions): Agent {
        const cache = new Map<string, Agent>();
        return this.buildAgentInternal(id, options, cache);
    }

    private buildAgentInternal(
        id: string,
        options: BuildAgentOptions,
        cache: Map<string, Agent>
    ): Agent {
        const cached = cache.get(id);
        if (cached) return cached;

        const config = this.configs.get(id);
        if (!config) {
            throw new Error(`Agent ${id} not found`);
        }

        const tools = config.toolIds
            .map((toolId) => this.toolRegistry.getTool(toolId))
            .filter((t): t is NonNullable<typeof t> => Boolean(t));

        const model = options.resolveModel ? options.resolveModel(config) : options.model;
        if (!model) {
            throw new Error(`Model not provided for agent ${config.name} (${config.id})`);
        }

        const modelSettings = this.applyModelSettingsOverride(config.modelSettingsOverride);

        const agent = new Agent({
            name: config.name,
            instructions: config.instructions,
            model,
            ...(modelSettings ? { modelSettings } : {}),
            // description 与 handoffDescription 语义保持一致；优先使用用户配置的 description。
            handoffDescription: config.description ?? config.handoffDescription ?? '',
            tools,
            handoffs: [],
        });

        cache.set(id, agent);

        agent.handoffs = config.handoffIds
            .map((handoffId) => this.buildAgentInternal(handoffId, options, cache))
            .filter((a): a is NonNullable<typeof a> => Boolean(a));

        return agent;
    }

    private applyModelSettingsOverride(
        override?: AgentModelSettingsOverride
    ): ModelSettings | undefined {
        if (!override) return undefined;

        const modelSettings: ModelSettings = {};

        if (override.temperature !== undefined) modelSettings.temperature = override.temperature;
        if (override.topP !== undefined) modelSettings.topP = override.topP;
        if (override.maxTokens !== undefined) modelSettings.maxTokens = override.maxTokens;
        if (override.toolChoice !== undefined) modelSettings.toolChoice = override.toolChoice;
        if (override.parallelToolCalls !== undefined)
            modelSettings.parallelToolCalls = override.parallelToolCalls;

        if (override.reasoningEffort !== undefined) {
            modelSettings.reasoning = { effort: override.reasoningEffort };
        }

        if (override.textVerbosity !== undefined) {
            modelSettings.text = { verbosity: override.textVerbosity };
        }

        return Object.keys(modelSettings).length ? modelSettings : undefined;
    }
}
