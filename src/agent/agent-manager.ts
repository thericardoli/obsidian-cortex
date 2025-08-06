import { Agent } from "@openai/agents";
import { webSearchTool, fileSearchTool, codeInterpreterTool, imageGenerationTool } from '@openai/agents-openai';
import type { Tool } from "@openai/agents";

import type { AgentConfig, AgentConfigInput, UpdateAgentConfigInput } from '../types/agent';
import { AgentConfigInputSchema, UpdateAgentConfigInputSchema } from '../types/agent';
import type { ToolConfig, AgentAsToolConfig } from '../types/tool';
import { ProviderManager } from '../providers';
import type { PersistenceManager } from '../persistence/persistence-manager';

type ToolExecutor = (args: unknown, context?: unknown) => Promise<unknown> | unknown;

export class AgentManager {
    private _providerManager: ProviderManager;
    private _persistenceManager: PersistenceManager | null = null;
    private _functionToolExecutors: Map<string, ToolExecutor> = new Map();
    private _agentCache: Map<string, AgentConfig> = new Map();

    constructor(providerManager: ProviderManager, persistenceManager?: PersistenceManager | null) {
        this._providerManager = providerManager;
        this._persistenceManager = persistenceManager || null;
    }

    /**
     * 设置持久化管理器
     */
    setPersistenceManager(persistenceManager: PersistenceManager): void {
        this._persistenceManager = persistenceManager;
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
            
            console.log(`Loaded ${agents.length} agents from database`);
        } catch (error) {
            console.error('Failed to load agents from database:', error);
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
            } catch (error) {
                // 如果数据库保存失败，从缓存中移除
                this._agentCache.delete(agent.id);
                console.error('Failed to save agent to database:', error);
                throw error;
            }
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

    // Function tool executor registry
    registerFunctionToolExecutor(name: string, executor: ToolExecutor): void {
        this._functionToolExecutors.set(name, executor);
    }

    unregisterFunctionToolExecutor(name: string): void {
        this._functionToolExecutors.delete(name);
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

        // 保存到数据库
        if (this._persistenceManager) {
            try {
                const agentRepository = this._persistenceManager.getAgentRepository();
                await agentRepository.upsert(agentConfig);
            } catch (error) {
                // 如果数据库保存失败，回滚内存中的更改
                Object.assign(agentConfig, originalConfig);
                console.error('Failed to update agent in database:', error);
                throw error;
            }
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
            } catch (error) {
                // 如果数据库删除失败，恢复内存中的数据
                this._agentCache.set(id, agentToDelete);
                console.error('Failed to delete agent from database:', error);
                throw error;
            }
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
     * 将 ToolConfig[] 转换为 SDK 可用的 Tool[]
     */
    private async convertToolsToSDKTools(agentConfig: AgentConfig): Promise<Tool[]> {
        const { tool } = await import("@openai/agents");
        const tools: Tool[] = [];

        // 处理配置的工具
        for (const toolConfig of agentConfig.tools) {
            if (!toolConfig.enabled) {
                continue;
            }

            switch (toolConfig.type) {
                case 'function': {
                    // 构建 FunctionTool
                    const executor = toolConfig.executor ? 
                        this._functionToolExecutors.get(toolConfig.executor) : 
                        undefined;
                    
                    if (!executor) {
                        console.warn(`No executor found for function tool: ${toolConfig.name}`);
                        continue;
                    }

                    const functionTool = tool({
                        name: toolConfig.name,
                        description: toolConfig.description || '',
                        parameters: toolConfig.parameters || {},
                        strict: toolConfig.strict ?? true,
                        needsApproval: toolConfig.needsApproval ?? false,
                        execute: async (args: unknown, runContext?: unknown) => executor(args, runContext),
                    });
                    tools.push(functionTool);
                    break;
                }
                case 'hosted': {
                    const hosted = (() => {
                        switch (toolConfig.name) {
                            case 'web_search': 
                                return webSearchTool(toolConfig.providerData || {});
                            case 'file_search': {
                                const vectorStoreIds = toolConfig.providerData?.vectorStoreIds;
                                if (!vectorStoreIds) {
                                    console.warn(`file_search tool requires vectorStoreIds in providerData`);
                                    return null;
                                }
                                return fileSearchTool(vectorStoreIds, toolConfig.providerData || {});
                            }
                            case 'code_interpreter': 
                                return codeInterpreterTool(toolConfig.providerData || {});
                            case 'image_generation': 
                                return imageGenerationTool(toolConfig.providerData || {});
                            default:
                                console.warn(`Unknown hosted tool: ${toolConfig.name}`); 
                                return null;
                        }
                    })();
                    if (hosted) tools.push(hosted);
                    break;
                }
                case 'agent': {
                    // Agent-as-Tool: 使用 asTool() 方法
                    const targetAgent = await this.createAgentInstance(toolConfig.targetAgentId);
                    if (!targetAgent) {
                        console.warn(`Target agent ${toolConfig.targetAgentId} not found`);
                        continue;
                    }
                    
                    // 类型断言以访问扩展属性
                    const agentToolConfig = toolConfig as AgentAsToolConfig;
                    
                    const agentAsTool = targetAgent.asTool({
                        toolName: agentToolConfig.name,
                        toolDescription: agentToolConfig.description,
                        customOutputExtractor: agentToolConfig.customOutputExtractor || ((output) => {
                            // 默认的输出提取器：提取最终输出文本
                            return typeof output === 'string' ? output : 
                                   (output as { finalOutput?: string })?.finalOutput || 
                                   'No response from agent';
                        })
                    });
                    tools.push(agentAsTool);
                    break;
                }
            }
        }

        return tools;
    }
}