import type { Tool } from '@openai/agents';
import type { Agent } from '@openai/agents';
import type { AgentAsToolConfig } from '../../types/tool';
import type { AgentManager } from '../agent-manager';

export async function buildAgentAsTool(
	manager: AgentManager,
	cfg: AgentAsToolConfig
): Promise<Tool | null> {
	const targetAgent: Agent | null = await manager.createAgentInstance(cfg.targetAgentId);
	if (!targetAgent) {
		console.warn(`Target agent ${cfg.targetAgentId} not found`);
		return null;
	}
	const extractor =
		cfg.customOutputExtractor ??
		((output: unknown) => {
			if (typeof output === 'string') return output;
			if (output && typeof output === 'object' && 'finalOutput' in output) {
				const maybe = (output as { finalOutput?: unknown }).finalOutput;
				return typeof maybe === 'string' ? maybe : '';
			}
			return '';
		});

	return targetAgent.asTool({
		toolName: cfg.name,
		toolDescription: cfg.description,
		customOutputExtractor: extractor,
	});
}
