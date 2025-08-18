import { Agent } from '@openai/agents';
import type { AgentManager } from './agent-manager';
import type { ProviderManager } from '../providers/provider-manager';
import type { AgentConfig } from '../types/agent';
import { buildTools } from '../tool/tool-conversion';
import { createLogger } from '../utils/logger';

/**
 * AgentService: 运行态 Agent 装配（跨 Agent & Provider）
 */
export class AgentService {
	private logger = createLogger('agent');
	constructor(
		private agentManager: AgentManager,
		private providerManager: ProviderManager
	) {}

	async create(agentId: string): Promise<Agent | null> {
		const cfg = this.agentManager.getAgent(agentId);
		if (!cfg) return null;
		return this.build(cfg, cfg.modelConfig.provider, cfg.modelConfig.model);
	}

	async createWithModelOverride(
		agentId: string,
		providerId: string,
		modelId: string
	): Promise<Agent | null> {
		const cfg = this.agentManager.getAgent(agentId);
		if (!cfg) return null;
		return this.build(cfg, providerId, modelId);
	}

	private adaptModelSettings(settings: AgentConfig['modelConfig']['settings']) {
		if (!settings) return {} as Record<string, unknown>;
		const { parallelToolCalls, toolChoice, ...rest } = settings;
		return {
			...rest,
			toolChoice: toolChoice ?? 'auto',
			parallelToolUse: parallelToolCalls ?? false,
		} as Record<string, unknown>;
	}

	private async build(
		cfg: AgentConfig,
		providerId: string,
		modelId: string
	): Promise<Agent | null> {
		try {
			const model = await this.providerManager.getModel(providerId, modelId);
			const { tools } = await buildTools(cfg, {
				agentManager: this.agentManager,
				agentService: this,
			});
			return new Agent({
				name: cfg.name,
				instructions: cfg.instructions,
				model,
				modelSettings: this.adaptModelSettings(cfg.modelConfig.settings),
				tools,
			});
		} catch (e) {
			this.logger.error('Failed to build agent runtime', e);
			return null;
		}
	}
}
