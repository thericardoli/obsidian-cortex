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
			settings: deserializeModelSettings(
				row.model_settings as string | Record<string, unknown>
			),
		},
		tools: deserializeTools(row.tools as string | unknown[]),
		inputGuardrails: deserializeGuardrails(row.input_guardrails as string | unknown[]),
		outputGuardrails: deserializeGuardrails(row.output_guardrails as string | unknown[]),
		mcpServers: deserializeMcpServers(row.mcp_servers as string | unknown[]),
	} as AgentConfig;
}

export function serializeModelSettings(settings: Record<string, unknown> | undefined): string {
	return JSON.stringify(settings ?? {});
}

export function deserializeModelSettings(
	serialized: string | Record<string, unknown>
): Record<string, unknown> {
	if (typeof serialized === 'object' && serialized !== null) {
		return serialized;
	}
	if (typeof serialized === 'string') {
		try {
			const parsed: unknown = JSON.parse(serialized);
			return typeof parsed === 'object' && parsed !== null
				? (parsed as Record<string, unknown>)
				: ({} as Record<string, unknown>);
		} catch {
			return {} as Record<string, unknown>;
		}
	}
	return {} as Record<string, unknown>;
}

export function serializeTools(tools: unknown[]): string {
	return JSON.stringify(tools ?? []);
}

export function deserializeTools(serialized: string | unknown[]): unknown[] {
	if (Array.isArray(serialized)) {
		return serialized;
	}
	if (typeof serialized === 'string') {
		try {
			const parsed: unknown = JSON.parse(serialized);
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return [];
		}
	}
	return [];
}

export function serializeGuardrails(guardrails: unknown[]): string {
	return JSON.stringify(guardrails ?? []);
}

export function deserializeGuardrails(serialized: string | unknown[]): unknown[] {
	return deserializeTools(serialized); // Same logic
}

export function serializeMcpServers(servers: unknown[]): string {
	return JSON.stringify(servers ?? []);
}

export function deserializeMcpServers(serialized: string | unknown[]): unknown[] {
	return deserializeTools(serialized); // Same logic
}
