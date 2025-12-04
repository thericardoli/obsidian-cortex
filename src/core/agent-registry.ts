import { Agent } from '@openai/agents';
import type { AgentConfig } from '../types/agent';
import type { ToolRegistry } from './tool-registry';
import type { ModelRegistry } from './model-registry';

export class AgentRegistry {
    private configs = new Map<string, AgentConfig>();

    constructor(
        private toolRegistry: ToolRegistry,
        private modelRegistry: ModelRegistry,
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

    buildAgent(id: string, seen: Set<string> = new Set()): Agent {
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
            .map((handoffId) => this.buildAgent(handoffId, new Set(seen)))
            .filter((a): a is NonNullable<typeof a> => Boolean(a));

        const { model, modelSettings } = this.modelRegistry.resolveForAgent(config);

        return new Agent({
            name: config.name,
            instructions: config.instructions,
            model,
            modelSettings,
            handoffDescription: config.handoffDescription,
            tools,
            handoffs,
        });
    }
}
