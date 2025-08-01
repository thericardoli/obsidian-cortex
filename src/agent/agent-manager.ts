import { Agent } from "@openai/agents";
import type { AgentConfig, AgentConfigInput } from '../types/agent';
import { ProviderManager } from '../providers';

export class AgentManager {
    private agents: Map<string, AgentConfig> = new Map();
    private providerManager: ProviderManager;

    constructor(providerManager: ProviderManager) {
        this.providerManager = providerManager;
    }

    async createAgent(config: AgentConfigInput): Promise<AgentConfig> {
        const agent: AgentConfig = {
            id: crypto.randomUUID(),
            ...config,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        this.agents.set(agent.id, agent);
        return agent;
    }

    async createAgentInstance(id: string): Promise<Agent | null> {
        const agentConfig = this.agents.get(id);
        if (!agentConfig) {
            return null;
        }

        // 通过 ProviderManager 获取 Model 实例
        const model = await this.providerManager.getModel(
            agentConfig.modelConfig.provider,
            agentConfig.modelConfig.model
        );

        const agentConfiguration = {
            name: agentConfig.name,
            instructions: agentConfig.instructions,
            model: model, // 现在是 Model 实例而不是字符串
            modelSettings: agentConfig.modelConfig.settings,
        };

        const agent = new Agent(agentConfiguration);
        return agent;
    }
}