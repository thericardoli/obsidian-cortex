import type { Tool } from '@openai/agents';
import type { AgentConfig } from '../../types/agent';
import type { ToolConfig, AgentAsToolConfig } from '../../types/tool';
import { functionToolRegistry } from './function-registry';
import { createHostedTool } from './hosted-registry';
import { buildAgentAsTool } from './agent-as-tool';
import type { AgentManager } from '../agent-manager';
import { createLogger } from '../../utils/logger';

export interface ToolDiagnostic {
	level: 'warn' | 'error';
	message: string;
	toolName?: string;
}

export async function buildTools(
	agentConfig: AgentConfig,
	ctx: { agentManager: AgentManager }
): Promise<{ tools: Tool[]; diagnostics: ToolDiagnostic[] }> {
	const diagnostics: ToolDiagnostic[] = [];
	const tools: Tool[] = [];
	const logger = createLogger('agent');

	for (const toolConfig of agentConfig.tools) {
		if (!toolConfig.enabled) continue;
		try {
			const built = await buildSingle(toolConfig, ctx.agentManager);
			if (built) tools.push(built);
		} catch (e) {
			diagnostics.push({
				level: 'warn',
				message: e instanceof Error ? e.message : 'Unknown tool error',
				toolName: toolConfig.name,
			});
		}
	}

	if (diagnostics.length) {
		for (const d of diagnostics) {
			if (d.level === 'warn')
				logger.warn(`Tool diagnostic: ${d.toolName ?? ''} ${d.message}`);
			else logger.error(`Tool diagnostic: ${d.toolName ?? ''} ${d.message}`);
		}
	}

	return { tools, diagnostics };
}

async function buildSingle(
	toolConfig: ToolConfig,
	agentManager: AgentManager
): Promise<Tool | null> {
	switch (toolConfig.type) {
		case 'function': {
			const executorName = toolConfig.executor;
			const executor = executorName ? functionToolRegistry.get(executorName) : undefined;
			if (!executor)
				throw new Error(`No executor found for function tool: ${toolConfig.name}`);
			const { tool } = await import('@openai/agents');
			return tool({
				name: toolConfig.name,
				description: toolConfig.description || '',
				parameters: toolConfig.parameters || {},
				strict: toolConfig.strict ?? true,
				needsApproval: toolConfig.needsApproval ?? false,
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				execute: async (args: unknown, runContext?: unknown) => executor(args, runContext),
			});
		}
		case 'hosted': {
			const hosted = createHostedTool(
				toolConfig.name as unknown as import('./hosted-registry').HostedToolName,
				toolConfig.providerData ?? {}
			);
			return hosted ?? null;
		}
		case 'agent': {
			const agentTool = await buildAgentAsTool(agentManager, toolConfig as AgentAsToolConfig);
			return agentTool ?? null;
		}
	}
	return null;
}
