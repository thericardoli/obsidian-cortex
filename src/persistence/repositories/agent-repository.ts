import type { DatabaseManager } from "../database-manager";
import type { AgentConfig } from "../../types/agent";

export class AgentRepository {
	constructor(private dbm: DatabaseManager) {}

	async upsert(agent: AgentConfig): Promise<void> {
		const db = this.dbm.getDatabase();

		await db.sql`
			INSERT INTO agents (
				id, name, instructions,
				model_provider, model, model_settings, tools,
				input_guardrails, output_guardrails, mcp_servers,
				metadata, created_at, updated_at
			) VALUES (
				${agent.id}, ${agent.name}, ${agent.instructions},
				${agent.modelConfig.provider}, ${agent.modelConfig.model},
				${JSON.stringify(agent.modelConfig.settings ?? {})},
				${JSON.stringify(agent.tools ?? [])},
				${JSON.stringify(agent.inputGuardrails ?? [])},
				${JSON.stringify(agent.outputGuardrails ?? [])},
				${JSON.stringify(agent.mcpServers ?? [])},
				${JSON.stringify({})},
				to_timestamp(${agent.createdAt}/1000.0),
				to_timestamp(${agent.updatedAt}/1000.0)
			)
			ON CONFLICT (id) DO UPDATE SET
				name=${agent.name},
				instructions=${agent.instructions},
				model_provider=${agent.modelConfig.provider},
				model=${agent.modelConfig.model},
				model_settings=${JSON.stringify(agent.modelConfig.settings ?? {})},
				tools=${JSON.stringify(agent.tools ?? [])},
				input_guardrails=${JSON.stringify(agent.inputGuardrails ?? [])},
				output_guardrails=${JSON.stringify(agent.outputGuardrails ?? [])},
				mcp_servers=${JSON.stringify(agent.mcpServers ?? [])},
				updated_at=NOW()
		`;
	}

	async get(id: string): Promise<Record<string, unknown> | null> {
		const db = this.dbm.getDatabase();
		const { rows } = await db.sql`SELECT * FROM agents WHERE id=${id}`;
		return (rows[0] as Record<string, unknown>) ?? null;
	}

	async list(): Promise<Record<string, unknown>[]> {
		const db = this.dbm.getDatabase();
		const { rows } =
			await db.sql`SELECT * FROM agents ORDER BY updated_at DESC`;
		return rows as Record<string, unknown>[];
	}

	async remove(id: string): Promise<void> {
		const db = this.dbm.getDatabase();
		await db.sql`DELETE FROM agents WHERE id=${id}`;
	}
}
