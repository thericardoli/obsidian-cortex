import { Agent } from "@openai/agents";
import type { AgentConfig, AgentConfigInput } from '../types/agent';
import type { ToolConfig, AgentAsToolConfig } from '../types/tool';
import { ProviderManager } from '../providers';

// 工具执行器函数类型
type ToolExecutor = (args: unknown, context?: unknown) => Promise<unknown> | unknown;

export class AgentManager {
    private agents: Map<string, AgentConfig> = new Map();
    private providerManager: ProviderManager;
    // 函数工具执行器注册表
    private functionToolExecutors: Map<string, ToolExecutor> = new Map();

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

    // Tool management methods
    async addTool(agentId: string, toolConfig: ToolConfig): Promise<void> {
        const agentConfig = this.agents.get(agentId);
        if (!agentConfig) {
            throw new Error(`Agent with id ${agentId} not found`);
        }

        // Check if tool with same name already exists
        const existingTool = agentConfig.tools.find(t => t.name === toolConfig.name);
        if (existingTool) {
            throw new Error(`Tool with name ${toolConfig.name} already exists in agent ${agentId}`);
        }

        agentConfig.tools.push(toolConfig);
        agentConfig.updatedAt = Date.now();
    }

    async removeTool(agentId: string, toolName: string): Promise<void> {
        const agentConfig = this.agents.get(agentId);
        if (!agentConfig) {
            throw new Error(`Agent with id ${agentId} not found`);
        }

        const toolIndex = agentConfig.tools.findIndex(t => t.name === toolName);
        if (toolIndex === -1) {
            throw new Error(`Tool with name ${toolName} not found in agent ${agentId}`);
        }

        agentConfig.tools.splice(toolIndex, 1);
        agentConfig.updatedAt = Date.now();
    }

    listTools(agentId: string): ToolConfig[] {
        const agentConfig = this.agents.get(agentId);
        if (!agentConfig) {
            throw new Error(`Agent with id ${agentId} not found`);
        }
        return [...agentConfig.tools];
    }

    // Function tool executor registry
    registerFunctionToolExecutor(name: string, executor: ToolExecutor): void {
        this.functionToolExecutors.set(name, executor);
    }

    unregisterFunctionToolExecutor(name: string): void {
        this.functionToolExecutors.delete(name);
    }

    // Agent retrieval methods
    getAgent(id: string): AgentConfig | undefined {
        return this.agents.get(id);
    }

    listAgents(): AgentConfig[] {
        return Array.from(this.agents.values());
    }

    updateAgent(id: string, updates: Partial<AgentConfigInput>): void {
        const agentConfig = this.agents.get(id);
        if (!agentConfig) {
            throw new Error(`Agent with id ${id} not found`);
        }

        Object.assign(agentConfig, updates, { updatedAt: Date.now() });
    }

    deleteAgent(id: string): void {
        if (!this.agents.has(id)) {
            throw new Error(`Agent with id ${id} not found`);
        }
        this.agents.delete(id);
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
                parallelToolUse: agentConfig.modelConfig.settings?.parallelToolUse ?? false,
            },
            tools: tools as never[], // 类型断言以避免编译错误
        };

        const agent = new Agent(agentConfiguration);
        return agent;
    }

    /**
     * 将 ToolConfig[] 转换为 SDK 可用的 Tool[]
     */
    private async convertToolsToSDKTools(agentConfig: AgentConfig): Promise<unknown[]> {
        const { tool } = await import("@openai/agents");
        const tools: unknown[] = [];

        // 处理配置的工具
        for (const toolConfig of agentConfig.tools) {
            if (!toolConfig.enabled) {
                continue;
            }

            switch (toolConfig.type) {
                case 'function': {
                    // 构建 FunctionTool
                    const executor = toolConfig.executor ? 
                        this.functionToolExecutors.get(toolConfig.executor) : 
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
                        execute: async (args: unknown, context?: unknown) => {
                            return await executor(args, context);
                        }
                    });
                    tools.push(functionTool);
                    break;
                }
                case 'hosted': {
                    // 构建 HostedTool
                    const hostedTool = {
                        type: 'hosted_tool' as const,
                        name: toolConfig.name,
                        providerData: toolConfig.providerData || {}
                    };
                    tools.push(hostedTool);
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
                        toolDescription: agentToolConfig.description || `Call agent ${agentToolConfig.targetAgentId}`,
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