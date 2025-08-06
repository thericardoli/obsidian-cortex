import type { AgentConfig } from '../../types/agent';

export function rowToAgentConfig(row: Record<string, unknown>): AgentConfig {
	return {
		id: row.id as string,
		name: row.name as string,
		instructions: row.instructions as string,
		createdAt: new Date(row.created_at as string).getTime(),
		updatedAt: new Date(row.updated_at as string).getTime(),
		modelConfig: {
			provider: row.model_provider as string,
			model: row.model as string,
			settings: (row.model_settings as Record<string, unknown>) ?? {}
		},
		tools: (row.tools as unknown[]) ?? [],
		inputGuardrails: (row.input_guardrails as unknown[]) ?? [],
		outputGuardrails: (row.output_guardrails as unknown[]) ?? [],
		mcpServers: (row.mcp_servers as unknown[]) ?? [],
	} as AgentConfig;
}
