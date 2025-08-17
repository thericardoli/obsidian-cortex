import type { DatabaseManager } from '../database-manager';
import type { AgentInputItem } from '../../types/session';
import { serializeItems, deserializeItems } from '../mappers/session-mapper';

export class SessionRepository {
	constructor(private dbm: DatabaseManager) {}

	async create(sessionId: string, name?: string): Promise<void> {
		const db = this.dbm.getDatabase();
		await db.sql`
			INSERT INTO sessions (id, name)
			VALUES (${sessionId}, ${name ?? null})
		`;
	}

	async getItems(sessionId: string, limit?: number): Promise<AgentInputItem[]> {
		const db = this.dbm.getDatabase();
		const { rows } = await db.sql`SELECT items FROM sessions WHERE id=${sessionId}`;
		if (!rows[0]) return [];
		const serializedItems = (rows[0] as Record<string, unknown>).items;
		const all = deserializeItems(serializedItems as string | unknown[]);
		return typeof limit === 'number' ? all.slice(-limit) : all;
	}

	async addItems(sessionId: string, items: AgentInputItem[]): Promise<void> {
		const db = this.dbm.getDatabase();
		const current = await this.getItems(sessionId);
		const next = [...current, ...items];

		await db.sql`
			UPDATE sessions
				SET items=${serializeItems(next)}, updated_at=NOW()
			WHERE id=${sessionId}
		`;
	}

	async popItem(sessionId: string): Promise<AgentInputItem | null> {
		const db = this.dbm.getDatabase();
		const current = await this.getItems(sessionId);
		if (current.length === 0) return null;
		const popped = current[current.length - 1];
		const next = current.slice(0, -1);

		await db.sql`
			UPDATE sessions
				SET items=${serializeItems(next)}, updated_at=NOW()
			WHERE id=${sessionId}
		`;
		return popped;
	}

	async clear(sessionId: string): Promise<void> {
		const db = this.dbm.getDatabase();
		await db.sql`
			UPDATE sessions
				SET items='[]'::jsonb, updated_at=NOW()
			WHERE id=${sessionId}
		`;
	}

	async remove(sessionId: string): Promise<void> {
		const db = this.dbm.getDatabase();
		await db.sql`DELETE FROM sessions WHERE id=${sessionId}`;
	}

	async list(limit = 20): Promise<Record<string, unknown>[]> {
		const db = this.dbm.getDatabase();
		const { rows } = await db.sql`
			SELECT id, name, created_at, updated_at
				FROM sessions
			ORDER BY updated_at DESC
			LIMIT ${limit}
		`;
		return rows as Record<string, unknown>[];
	}

	async exists(sessionId: string): Promise<boolean> {
		const db = this.dbm.getDatabase();
		const { rows } = await db.sql`SELECT 1 FROM sessions WHERE id=${sessionId}`;
		return rows.length > 0;
	}

	async getSessionInfo(sessionId: string): Promise<{ id: string; name?: string } | null> {
		const db = this.dbm.getDatabase();
		const { rows } = await db.sql`
			SELECT id, name 
			FROM sessions 
			WHERE id=${sessionId}
		`;
		if (!rows[0]) return null;
		const row = rows[0] as Record<string, unknown>;
		return {
			id: row.id as string,
			name: row.name as string | undefined,
		};
	}
}
