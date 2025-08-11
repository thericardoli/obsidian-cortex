import { Agent } from "@openai/agents";
import type { Tool } from "@openai/agents";

import type { AgentConfig, AgentConfigInput, UpdateAgentConfigInput } from '../types/agent';
import { AgentConfigInputSchema, UpdateAgentConfigInputSchema } from '../types/agent';
import type { ToolConfig, AgentAsToolConfig } from '../types/tool';
import { ProviderManager } from '../providers';
import type { PersistenceManager } from '../persistence/persistence-manager';
import { functionToolRegistry, type ToolExecutor } from "../tool/function-registry";
import { createHostedTool } from "../tool/hosted-registry";
import { buildAgentAsTool } from "../tool/agent-as-tool";
import { createLogger, type Logger } from "../utils/logger";

export class AgentManager {
    private _providerManager: ProviderManager;
    private _persistenceManager: PersistenceManager | null = null;
    private _agentCache: Map<string, AgentConfig> = new Map();
    // Subscribers to agent list/config changes
    private _agentChangeListeners: Set<() => void> = new Set();
    private logger: Logger;

    constructor(providerManager: ProviderManager, persistenceManager?: PersistenceManager | null) {
        this._providerManager = providerManager;
        this._persistenceManager = persistenceManager || null;
        this.logger = createLogger('agent');
    }

    /**
     * 设置持久化管理器
     */
    setPersistenceManager(persistenceManager: PersistenceManager): void {
        this._persistenceManager = persistenceManager;
    }

    /**
     * Subscribe to agent list/config changes. Returns an unsubscribe function.
     */
    subscribeAgentsChange(listener: () => void): () => void {
        this._agentChangeListeners.add(listener);
        return () => {
            this._agentChangeListeners.delete(listener);
        };
    }

    private _notifyAgentsChanged(): void {
        for (const l of this._agentChangeListeners) {
            try { l(); } catch (e) { console.warn('Agent change listener error:', e); }
        }
    }

    /**
     * 从数据库加载所有 agents 到缓存
     */
    async loadAgentsFromDatabase(): Promise<void> {
        if (!this._persistenceManager) {
            console.warn('PersistenceManager not available, skipping agent loading');
            return;
        }

        try {
            const agentRepository = this._persistenceManager.getAgentRepository();
            const agents = await agentRepository.list();
            
            // 清空缓存并重新加载
            this._agentCache.clear();
            for (const agent of agents) {
                this._agentCache.set(agent.id, agent);
            }
            
            this.logger.info(`Loaded ${agents.length} agents from database`);
            this._notifyAgentsChanged();
        } catch (error) {
            this.logger.error('Failed to load agents from database:', error);
        }
    }

    async createAgent(config: AgentConfigInput): Promise<AgentConfig> {
        const validatedConfig = AgentConfigInputSchema.parse(config);
        
        const agent: AgentConfig = {
            id: crypto.randomUUID(),
            ...validatedConfig,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        // 保存到缓存
        this._agentCache.set(agent.id, agent);

        // 保存到数据库
        if (this._persistenceManager) {
            try {
                const agentRepository = this._persistenceManager.getAgentRepository();
                await agentRepository.upsert(agent);
                // Notify after successful persistence
                this._notifyAgentsChanged();
            } catch (error) {
                // 如果数据库保存失败，从缓存中移除
                this._agentCache.delete(agent.id);
                console.error('Failed to save agent to database:', error);
                throw error;
            }
        } else {
            // In-memory mode still updates UI
            this._notifyAgentsChanged();
        }

        return agent;
    }

    // Tool management methods
    async addTool(agentId: string, toolConfig: ToolConfig): Promise<void> {
        const agentConfig = this._agentCache.get(agentId);
        if (!agentConfig) {
            throw new Error(`Agent with id ${agentId} not found`);
        }

        // Check if tool with same name already exists
        const existingTool = agentConfig.tools.find((t: ToolConfig) => t.name === toolConfig.name);
        if (existingTool) {
            throw new Error(`Tool with name ${toolConfig.name} already exists in agent ${agentId}`);
        }

        // Validate tool before adding
        switch (toolConfig.type) {
            case 'function': {
                const execName = toolConfig.executor;
                if (execName && !functionToolRegistry.get(execName)) {
                    throw new Error(`Function tool executor '${execName}' is not registered`);
                }
                break;
            }
            case 'hosted': {
                const hosted = createHostedTool((toolConfig.name as unknown) as import("../tool/hosted-registry").HostedToolName, toolConfig.providerData ?? {});
                if (!hosted) {
                    throw new Error(`Invalid hosted tool configuration for '${toolConfig.name}'`);
                }
                break;
            }
            case 'agent': {
                const exists = this._agentCache.has(toolConfig.targetAgentId);
                if (!exists) {
                    throw new Error(`Target agent '${toolConfig.targetAgentId}' not found for agent-as-tool`);
                }
                break;
            }
        }

        agentConfig.tools.push(toolConfig);
        agentConfig.updatedAt = Date.now();

        // 保存到数据库
        if (this._persistenceManager) {
            try {
                const agentRepository = this._persistenceManager.getAgentRepository();
                await agentRepository.upsert(agentConfig);
            } catch (error) {
                // 如果数据库保存失败，回滚内存中的更改
                agentConfig.tools.pop();
                console.error('Failed to save agent to database:', error);
                throw error;
            }
        }
    }

    async removeTool(agentId: string, toolName: string): Promise<void> {
        const agentConfig = this._agentCache.get(agentId);
        if (!agentConfig) {
            throw new Error(`Agent with id ${agentId} not found`);
        }

        const toolIndex = agentConfig.tools.findIndex((t: ToolConfig) => t.name === toolName);
        if (toolIndex === -1) {
            throw new Error(`Tool with name ${toolName} not found in agent ${agentId}`);
        }

        // 保存被删除的工具以便回滚
        const removedTool = agentConfig.tools[toolIndex];
        agentConfig.tools.splice(toolIndex, 1);
        agentConfig.updatedAt = Date.now();

        // 保存到数据库
        if (this._persistenceManager) {
            try {
                const agentRepository = this._persistenceManager.getAgentRepository();
                await agentRepository.upsert(agentConfig);
            } catch (error) {
                // 如果数据库保存失败，回滚内存中的更改
                agentConfig.tools.splice(toolIndex, 0, removedTool);
                console.error('Failed to save agent to database:', error);
                throw error;
            }
        }
    }

    listTools(agentId: string): ToolConfig[] {
        const agentConfig = this._agentCache.get(agentId);
        if (!agentConfig) {
            throw new Error(`Agent with id ${agentId} not found`);
        }
        return [...agentConfig.tools];
    }

    // Function tool executor registry (delegates to central registry)
    registerFunctionToolExecutor(name: string, executor: ToolExecutor): void {
        functionToolRegistry.register(name, executor);
    }

    unregisterFunctionToolExecutor(name: string): void {
        functionToolRegistry.unregister(name);
    }

    // Agent retrieval methods
    getAgent(id: string): AgentConfig | undefined {
        return this._agentCache.get(id);
    }

    listAgents(): AgentConfig[] {
        return Array.from(this._agentCache.values());
    }

    async updateAgent(id: string, updates: UpdateAgentConfigInput): Promise<void> {
        const validatedUpdates = UpdateAgentConfigInputSchema.parse(updates);
        
        const agentConfig = this._agentCache.get(id);
        if (!agentConfig) {
            throw new Error(`Agent with id ${id} not found`);
        }

        // 保存原始配置以便回滚
        const originalConfig = { ...agentConfig };
    Object.assign(agentConfig, validatedUpdates, { updatedAt: Date.now() });
    // 使用新的对象引用替换缓存条目，确保下游UI能够识别到变更
    const updatedSnapshot: AgentConfig = { ...agentConfig } as AgentConfig;
    this._agentCache.set(id, updatedSnapshot);

        // 保存到数据库
        if (this._persistenceManager) {
            try {
                const agentRepository = this._persistenceManager.getAgentRepository();
                await agentRepository.upsert(agentConfig);
                this._notifyAgentsChanged();
            } catch (error) {
                // 如果数据库保存失败，回滚内存中的更改
        this._agentCache.set(id, originalConfig);
                console.error('Failed to update agent in database:', error);
                throw error;
            }
        } else {
            this._notifyAgentsChanged();
        }
    }

    async deleteAgent(id: string): Promise<void> {
        const agentToDelete = this._agentCache.get(id);
        if (!agentToDelete) {
            throw new Error(`Agent with id ${id} not found`);
        }

        // 从缓存中删除
        this._agentCache.delete(id);

        // 从数据库删除
        if (this._persistenceManager) {
            try {
                const agentRepository = this._persistenceManager.getAgentRepository();
                await agentRepository.remove(id);
                this._notifyAgentsChanged();
            } catch (error) {
                // 如果数据库删除失败，恢复内存中的数据
                this._agentCache.set(id, agentToDelete);
                console.error('Failed to delete agent from database:', error);
                throw error;
            }
        } else {
            this._notifyAgentsChanged();
        }
    }

    async createAgentInstance(id: string): Promise<Agent | null> {
        const agentConfig = this._agentCache.get(id);
        if (!agentConfig) {
            return null;
        }

        // 通过 ProviderManager 获取 Model 实例
        const model = await this._providerManager.getModel(
            agentConfig.modelConfig.provider,
            agentConfig.modelConfig.model
        );

        // 将 ToolConfig[] 转换为 SDK Tool[]
        const tools = await this.convertToolsToSDKTools(agentConfig);

        const agentConfiguration = {
            name: agentConfig.name,
            instructions: agentConfig.instructions,
            model: model, // 现在是 Model 实例而不是字符串
            modelSettings: {
                ...agentConfig.modelConfig.settings,
                // 透传工具相关设置
                toolChoice: agentConfig.modelConfig.settings?.toolChoice ?? 'auto',
                parallelToolUse: agentConfig.modelConfig.settings?.parallelToolCalls ?? false,
            },
            tools: tools, // 移除 as never[] 类型断言
        };

        const agent = new Agent(agentConfiguration);
        return agent;
    }

    /**
     * Create an Agent instance but override the model by providerId + modelId
     */
    async createAgentInstanceWithModel(id: string, providerId: string, modelId: string): Promise<Agent | null> {
        const agentConfig = this._agentCache.get(id);
        if (!agentConfig) return null;

        const model = await this._providerManager.getModel(providerId, modelId);
        const tools = await this.convertToolsToSDKTools(agentConfig);

        const agentConfiguration = {
            name: agentConfig.name,
            instructions: agentConfig.instructions,
            model: model,
            modelSettings: {
                ...agentConfig.modelConfig.settings,
                toolChoice: agentConfig.modelConfig.settings?.toolChoice ?? 'auto',
                parallelToolUse: agentConfig.modelConfig.settings?.parallelToolCalls ?? false,
            },
            tools: tools,
        };

        return new Agent(agentConfiguration);
    }

    /**
     * 将 ToolConfig[] 转换为 SDK 可用的 Tool[]
     */
    private async convertToolsToSDKTools(agentConfig: AgentConfig): Promise<Tool[]> {
        const tools: Tool[] = [];

        // 处理配置的工具
        for (const toolConfig of agentConfig.tools) {
            if (!toolConfig.enabled) {
                continue;
            }

            switch (toolConfig.type) {
                case 'function': {
                    const executorName = toolConfig.executor;
                    const executor = executorName ? functionToolRegistry.get(executorName) : undefined;
                    if (!executor) {
                        console.warn(`No executor found for function tool: ${toolConfig.name}`);
                        continue;
                    }
                    const { tool } = await import("@openai/agents");
                    tools.push(
                        tool({
                            name: toolConfig.name,
                            description: toolConfig.description || '',
                            parameters: toolConfig.parameters || {},
                            strict: toolConfig.strict ?? true,
                            needsApproval: toolConfig.needsApproval ?? false,
                            execute: async (args: unknown, runContext?: unknown) => executor(args, runContext),
                        })
                    );
                    break;
                }
                case 'hosted': {
                    const hosted = createHostedTool((toolConfig.name as unknown) as import("../tool/hosted-registry").HostedToolName, toolConfig.providerData ?? {});
                    if (hosted) tools.push(hosted);
                    break;
                }
                case 'agent': {
                    const agentTool = await buildAgentAsTool(this, toolConfig as AgentAsToolConfig);
                    if (agentTool) tools.push(agentTool);
                    break;
                }
            }
        }

        return tools;
    }
}
