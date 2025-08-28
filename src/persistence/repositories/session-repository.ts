import type { AgentInputItem } from '../../types/session';
import type { DatabaseManager } from '../database-manager';

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
		// 优先从规范化表读取
		const lim = typeof limit === 'number' && limit > 0 ? limit : undefined;
		if (lim) {
			const { rows } = await db.sql`
				SELECT item FROM session_items
				WHERE session_id=${sessionId}
				ORDER BY idx DESC
				LIMIT ${lim}
			`;
			return (rows as Array<{ item: unknown }>)
				.map((r) => r.item as AgentInputItem)
				.reverse();
		}
		const { rows } = await db.sql`
			SELECT item FROM session_items
			WHERE session_id=${sessionId}
			ORDER BY idx ASC
		`;
		return (rows as Array<{ item: unknown }>).map((r) => r.item as AgentInputItem);
	}

	async addItems(sessionId: string, items: AgentInputItem[]): Promise<void> {
		return this.appendItems(sessionId, items);
	}

	async appendItems(sessionId: string, items: AgentInputItem[]): Promise<void> {
		if (items.length === 0) return;
		const db = this.dbm.getDatabase();
		const { rows: idxRows } = await db.sql`
			SELECT COALESCE(MAX(idx), 0)::bigint AS max_idx
			FROM session_items
			WHERE session_id=${sessionId}
		`;
		const startIdx = Number((idxRows?.[0] as Record<string, unknown>)?.max_idx ?? 0) + 1;

		// 批量插入（保守：逐条插入，避免构造复杂 VALUES 语法）
		for (let i = 0; i < items.length; i++) {
			await db.sql`
				INSERT INTO session_items (session_id, idx, item)
				VALUES (${sessionId}, ${startIdx + i}, ${items[i]})
			`;
		}

		await db.sql`UPDATE sessions SET updated_at=NOW() WHERE id=${sessionId}`;
	}

	async popItem(sessionId: string): Promise<AgentInputItem | null> {
		const db = this.dbm.getDatabase();
		const { rows } = await db.sql`
			SELECT idx, item FROM session_items
			WHERE session_id=${sessionId}
			ORDER BY idx DESC
			LIMIT 1
		`;
		if (!rows[0]) return null;
		const row = rows[0] as { idx: number; item: unknown };
		await db.sql`
			DELETE FROM session_items
			WHERE session_id=${sessionId} AND idx=${row.idx}
		`;
		await db.sql`UPDATE sessions SET updated_at=NOW() WHERE id=${sessionId}`;
		return row.item as AgentInputItem;
	}

	async clear(sessionId: string): Promise<void> {
		const db = this.dbm.getDatabase();
		await db.sql`DELETE FROM session_items WHERE session_id=${sessionId}`;
		await db.sql`UPDATE sessions SET updated_at=NOW() WHERE id=${sessionId}`;
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

	exists(sessionId: string): Promise<boolean> {
		const db = this.dbm.getDatabase();
		return db.sql`SELECT 1 FROM sessions WHERE id=${sessionId}`.then(
			({ rows }) => rows.length > 0
		);
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
