import type { AgentConfig } from '../../types/agent';
import type { AgentInputItem } from '../../types/session';

export interface IAgentRepository {
	upsert(agent: AgentConfig): Promise<void>;
	get(id: string): Promise<AgentConfig | null>;
	list(): Promise<AgentConfig[]>;
	remove(id: string): Promise<void>;
	exists(id: string): Promise<boolean>;
}

export interface ISessionRepository {
	create(sessionId: string, name?: string): Promise<void>;
	getItems(sessionId: string, limit?: number): Promise<AgentInputItem[]>;
	addItems(sessionId: string, items: AgentInputItem[]): Promise<void>;
	appendItems(sessionId: string, items: AgentInputItem[]): Promise<void>;
	popItem(sessionId: string): Promise<AgentInputItem | null>;
	clear(sessionId: string): Promise<void>;
	remove(sessionId: string): Promise<void>;
	list(limit?: number): Promise<Record<string, unknown>[]>;
	exists(sessionId: string): Promise<boolean>;
	getSessionInfo(sessionId: string): Promise<{ id: string; name?: string } | null>;
}

// 内存实现 - Agent
export class InMemoryAgentRepository implements IAgentRepository {
	private store = new Map<string, AgentConfig>();
	upsert(agent: AgentConfig): Promise<void> {
		this.store.set(agent.id, { ...agent });
		return Promise.resolve();
	}
	get(id: string): Promise<AgentConfig | null> {
		return Promise.resolve(this.store.get(id) ?? null);
	}
	list(): Promise<AgentConfig[]> {
		return Promise.resolve(Array.from(this.store.values()).map((a) => ({ ...a })));
	}
	remove(id: string): Promise<void> {
		this.store.delete(id);
		return Promise.resolve();
	}
	exists(id: string): Promise<boolean> {
		return Promise.resolve(this.store.has(id));
	}
}

// 内存实现 - Session
interface MemorySessionRecord {
	id: string;
	name?: string;
	items: AgentInputItem[];
	created_at: number;
	updated_at: number;
}
export class InMemorySessionRepository implements ISessionRepository {
	private sessions = new Map<string, MemorySessionRecord>();
	create(sessionId: string, name?: string): Promise<void> {
		if (!this.sessions.has(sessionId)) {
			const now = Date.now();
			this.sessions.set(sessionId, {
				id: sessionId,
				name,
				items: [],
				created_at: now,
				updated_at: now,
			});
		}
		return Promise.resolve();
	}
	getItems(sessionId: string, limit?: number): Promise<AgentInputItem[]> {
		const rec = this.sessions.get(sessionId);
		if (!rec) return Promise.resolve([]);
		const all = rec.items;
		return Promise.resolve(typeof limit === 'number' ? all.slice(-limit) : [...all]);
	}
	addItems(sessionId: string, items: AgentInputItem[]): Promise<void> {
		const rec = this.sessions.get(sessionId);
		if (!rec) return Promise.resolve();
		rec.items.push(...items);
		rec.updated_at = Date.now();
		return Promise.resolve();
	}
	appendItems(sessionId: string, items: AgentInputItem[]): Promise<void> {
		return this.addItems(sessionId, items);
	}
	popItem(sessionId: string): Promise<AgentInputItem | null> {
		const rec = this.sessions.get(sessionId);
		if (!rec || rec.items.length === 0) return Promise.resolve(null);
		const it = rec.items.pop() as AgentInputItem;
		rec.updated_at = Date.now();
		return Promise.resolve(it);
	}
	clear(sessionId: string): Promise<void> {
		const rec = this.sessions.get(sessionId);
		if (rec) {
			rec.items = [];
			rec.updated_at = Date.now();
		}
		return Promise.resolve();
	}
	remove(sessionId: string): Promise<void> {
		this.sessions.delete(sessionId);
		return Promise.resolve();
	}
	list(limit = 20): Promise<Record<string, unknown>[]> {
		const rows = Array.from(this.sessions.values())
			.sort((a, b) => b.updated_at - a.updated_at)
			.slice(0, limit)
			.map((r) => ({
				id: r.id,
				name: r.name,
				created_at: new Date(r.created_at).toISOString(),
				updated_at: new Date(r.updated_at).toISOString(),
			})) as Record<string, unknown>[];
		return Promise.resolve(rows);
	}
	exists(sessionId: string): Promise<boolean> {
		return Promise.resolve(this.sessions.has(sessionId));
	}
	getSessionInfo(sessionId: string): Promise<{ id: string; name?: string } | null> {
		const r = this.sessions.get(sessionId);
		return Promise.resolve(r ? { id: r.id, name: r.name } : null);
	}
}
