/**
 * AgentRegistry - Agent 配置管理
 *
 * 职责：
 * - 管理 AgentConfig 配置
 * - 构建 Agent 实例（需要外部提供 model）
 *
 * 注意：model 创建由调用者负责，使用 model-registry.ts 中的 createModel
 */

import { Agent } from '@openai/agents';
import type { AgentConfig } from '../types/agent';
import type { ToolRegistry } from './tool-registry';

export interface BuildAgentOptions {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model: any;
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

    buildAgent(id: string, options: BuildAgentOptions, seen: Set<string> = new Set()): Agent {
        const config = this.configs.get(id);
        if (!config) {
            throw new Error(`Agent ${id} not found`);
        }

        if (seen.has(id)) {
            throw new Error(`Circular handoff detected for agent ${id}`);
        }

        seen.add(id);

        const tools = config.toolIds
            .map((toolId) => this.toolRegistry.getSdkTool(toolId))
            .filter((t): t is NonNullable<typeof t> => Boolean(t));

        const handoffs = config.handoffIds
            .map((handoffId) => this.buildAgent(handoffId, options, new Set(seen)))
            .filter((a): a is NonNullable<typeof a> => Boolean(a));

        return new Agent({
            name: config.name,
            instructions: config.instructions,
            model: options.model,
            handoffDescription: config.handoffDescription,
            tools,
            handoffs,
        });
    }
}
