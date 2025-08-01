import { AgentManager } from './agent/agent-manager';
import { ProviderManager } from './providers/provider-manager';
import type { ProviderConfig, AgentConfigInput, AgentConfig } from './types';
import type { Agent } from "@openai/agents";

export class CortexManager {
    private agentManager: AgentManager;
    private providerManager: ProviderManager;

    constructor() {
        this.providerManager = new ProviderManager();
        this.agentManager = new AgentManager(this.providerManager);
    }

    // Provider management
    async addProvider(config: ProviderConfig): Promise<void> {
        return this.providerManager.addProvider(config);
    }

    removeProvider(providerId: string): Promise<void> {
        return this.providerManager.removeProvider(providerId);
    }

    getAvailableProviders() {
        return this.providerManager.getEnabledProviders().map(p => ({
            id: p.getId(),
            name: p.getName()
        }));
    }

    // Agent management
    async createAgent(config: AgentConfigInput): Promise<AgentConfig> {
        // 验证 provider 是否存在
        const provider = this.providerManager.getProvider(config.modelConfig.provider);
        if (!provider) {
            throw new Error(`Provider '${config.modelConfig.provider}' not found`);
        }

        return this.agentManager.createAgent(config);
    }

    async createAgentInstance(agentId: string): Promise<Agent | null> {
        return this.agentManager.createAgentInstance(agentId);
    }

    // 便利方法：创建 Agent 并立即实例化
    async createAndInstantiateAgent(config: AgentConfigInput): Promise<{ config: AgentConfig; instance: Agent }> {
        const agentConfig = await this.createAgent(config);
        const agentInstance = await this.createAgentInstance(agentConfig.id);
        
        if (!agentInstance) {
            throw new Error("Failed to create agent instance");
        }

        return {
            config: agentConfig,
            instance: agentInstance
        };
    }
}
