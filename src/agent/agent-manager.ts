import { Agent } from '@openai/agents';

import type { AgentConfig, AgentConfigInput, UpdateAgentConfigInput } from '../types/agent';
import { AgentConfigInputSchema, UpdateAgentConfigInputSchema } from '../types/agent';
import type { ToolConfig } from '../types/tool';
import { ProviderManager } from '../providers';
import type { PersistenceManager } from '../persistence/persistence-manager';
import { functionToolRegistry, type ToolExecutor } from '../tool/function-registry';
import { buildTools } from '../tool/tool-conversion';
import { createLogger, type Logger } from '../utils/logger';
import type { EventBus } from '../services/event-bus';

export class AgentManager {
	private _providerManager: ProviderManager;
	private _persistenceManager: PersistenceManager; // 必需依赖（内存或持久化模式）
	private _agentCache: Map<string, AgentConfig> = new Map();
	private logger: Logger;
	private eventBus?: EventBus;

	constructor(
		providerManager: ProviderManager,
		persistenceManager: PersistenceManager,
		eventBus?: EventBus
	) {
		this._providerManager = providerManager;
		this._persistenceManager = persistenceManager;
		this.logger = createLogger('agent');
		this.eventBus = eventBus;
	}

	/**
	 * 设置持久化管理器
	 */
	setPersistenceManager(persistenceManager: PersistenceManager): void {
		this._persistenceManager = persistenceManager;
	}

	// Emit via EventBus (unified event system)
	private _notifyAgentsChanged(): void {
		this.eventBus?.emit('agentsChanged');
	}

	/**
	 * 从数据库加载所有 agents 到缓存
	 */
	async loadAgentsFromDatabase(): Promise<void> {
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
		try {
			const agentRepository = this._persistenceManager.getAgentRepository();
			await agentRepository.upsert(agent);
		} catch (error) {
			this._agentCache.delete(agent.id);
			this.logger.error('Failed to save agent to repository', error);
			throw error;
		}
		this._notifyAgentsChanged();

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
				// 轻量校验：名称与 providerData 允许为空，具体构建阶段在 buildTools 中处理
				break;
			}
			case 'agent': {
				const exists = this._agentCache.has(toolConfig.targetAgentId);
				if (!exists) {
					throw new Error(
						`Target agent '${toolConfig.targetAgentId}' not found for agent-as-tool`
					);
				}
				break;
			}
		}

		agentConfig.tools.push(toolConfig);
		agentConfig.updatedAt = Date.now();

		// 保存到数据库
		try {
			await this._persistenceManager.getAgentRepository().upsert(agentConfig);
		} catch (error) {
			agentConfig.tools.pop();
			this.logger.error('Failed to save agent to repository', error);
			throw error;
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
		try {
			await this._persistenceManager.getAgentRepository().upsert(agentConfig);
		} catch (error) {
			agentConfig.tools.splice(toolIndex, 0, removedTool);
			this.logger.error('Failed to save agent to repository', error);
			throw error;
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
		try {
			await this._persistenceManager.getAgentRepository().upsert(agentConfig);
		} catch (error) {
			this._agentCache.set(id, originalConfig);
			this.logger.error('Failed to update agent in repository', error);
			throw error;
		}
		this._notifyAgentsChanged();
	}

	async deleteAgent(id: string): Promise<void> {
		const agentToDelete = this._agentCache.get(id);
		if (!agentToDelete) {
			throw new Error(`Agent with id ${id} not found`);
		}

		// 从缓存中删除
		this._agentCache.delete(id);

		// 从数据库删除
		try {
			await this._persistenceManager.getAgentRepository().remove(id);
		} catch (error) {
			this._agentCache.set(id, agentToDelete);
			this.logger.error('Failed to delete agent from repository', error);
			throw error;
		}
		this._notifyAgentsChanged();
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
		const { tools } = await buildTools(agentConfig, { agentManager: this });

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
	async createAgentInstanceWithModel(
		id: string,
		providerId: string,
		modelId: string
	): Promise<Agent | null> {
		const agentConfig = this._agentCache.get(id);
		if (!agentConfig) return null;

		const model = await this._providerManager.getModel(providerId, modelId);
		const { tools } = await buildTools(agentConfig, { agentManager: this });

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
	// convertToolsToSDKTools 已迁移到 buildTools (tool/tool-conversion.ts)
}
