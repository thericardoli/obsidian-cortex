import type { AgentConfig } from '../../types/agent';

export function rowToAgentConfig(row: Record<string, unknown>): AgentConfig {
	return {
		id: row.id as string,
		name: row.name as string,
		instructions: row.instructions as string,
		createdAt: new Date(row.created_at as string).getTime(),
		updatedAt: new Date(row.updated_at as string).getTime(),
		modelConfig: {
			provider: row.provider as string,
			model: row.model as string,
			settings: (row.settings as Record<string, unknown>) ?? {}
		},
		tools: (row.tools as unknown[]) ?? [],
		inputGuardrails: (row.input_guardrails as unknown[]) ?? [],
		outputGuardrails: (row.output_guardrails as unknown[]) ?? [],
		mcpServers: (row.mcp_servers as unknown[]) ?? [],
		// outputType 可选：根据 row.output_type_kind / output_type_schema 还原
		...(row.output_type_kind
			? {
					outputType:
						row.output_type_kind === 'text'
							? 'text'
							: (row.output_type_schema ?? undefined),
				}
			: {}),
	} as AgentConfig;
}
