import type { DatabaseManager } from "../database-manager";
import type { AgentConfig } from "../../types/agent";
import { 
	rowToAgentConfig,
	serializeModelSettings,
	serializeTools,
	serializeGuardrails,
	serializeMcpServers
} from "../mappers/agent-mapper";

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
				${serializeModelSettings(agent.modelConfig.settings)},
				${serializeTools(agent.tools ?? [])},
				${serializeGuardrails(agent.inputGuardrails ?? [])},
				${serializeGuardrails(agent.outputGuardrails ?? [])},
				${serializeMcpServers(agent.mcpServers ?? [])},
				${JSON.stringify({})},
				to_timestamp(${agent.createdAt}/1000.0),
				to_timestamp(${agent.updatedAt}/1000.0)
			)
			ON CONFLICT (id) DO UPDATE SET
				name=${agent.name},
				instructions=${agent.instructions},
				model_provider=${agent.modelConfig.provider},
				model=${agent.modelConfig.model},
				model_settings=${serializeModelSettings(agent.modelConfig.settings)},
				tools=${serializeTools(agent.tools ?? [])},
				input_guardrails=${serializeGuardrails(agent.inputGuardrails ?? [])},
				output_guardrails=${serializeGuardrails(agent.outputGuardrails ?? [])},
				mcp_servers=${serializeMcpServers(agent.mcpServers ?? [])},
				updated_at=NOW()
		`;
	}

	async get(id: string): Promise<AgentConfig | null> {
		const db = this.dbm.getDatabase();
		const { rows } = await db.sql`SELECT * FROM agents WHERE id=${id}`;
		const row = rows[0] as Record<string, unknown>;
		return row ? rowToAgentConfig(row) : null;
	}

	async list(): Promise<AgentConfig[]> {
		const db = this.dbm.getDatabase();
		const { rows } =
			await db.sql`SELECT * FROM agents ORDER BY updated_at DESC`;
		return (rows as Record<string, unknown>[]).map(rowToAgentConfig);
	}

	async remove(id: string): Promise<void> {
		const db = this.dbm.getDatabase();
		await db.sql`DELETE FROM agents WHERE id=${id}`;
	}

	async exists(id: string): Promise<boolean> {
		const db = this.dbm.getDatabase();
		const { rows } = await db.sql`SELECT 1 FROM agents WHERE id=${id} LIMIT 1`;
		return rows.length > 0;
	}
}
