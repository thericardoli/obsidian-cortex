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
	async upsert(agent: AgentConfig): Promise<void> {
		this.store.set(agent.id, { ...agent });
	}
	async get(id: string): Promise<AgentConfig | null> {
		return this.store.get(id) ?? null;
	}
	async list(): Promise<AgentConfig[]> {
		return Array.from(this.store.values()).map((a) => ({ ...a }));
	}
	async remove(id: string): Promise<void> {
		this.store.delete(id);
	}
	async exists(id: string): Promise<boolean> {
		return this.store.has(id);
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
	async create(sessionId: string, name?: string): Promise<void> {
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
	}
	async getItems(sessionId: string, limit?: number) {
		const rec = this.sessions.get(sessionId);
		if (!rec) return [];
		const all = rec.items;
		return typeof limit === 'number' ? all.slice(-limit) : [...all];
	}
	async addItems(sessionId: string, items: AgentInputItem[]) {
		const rec = this.sessions.get(sessionId);
		if (!rec) return;
		rec.items.push(...items);
		rec.updated_at = Date.now();
	}
	async popItem(sessionId: string) {
		const rec = this.sessions.get(sessionId);
		if (!rec || rec.items.length === 0) return null;
		const it = rec.items.pop() as AgentInputItem;
		rec.updated_at = Date.now();
		return it;
	}
	async clear(sessionId: string) {
		const rec = this.sessions.get(sessionId);
		if (rec) {
			rec.items = [];
			rec.updated_at = Date.now();
		}
	}
	async remove(sessionId: string) {
		this.sessions.delete(sessionId);
	}
	async list(limit = 20) {
		return Array.from(this.sessions.values())
			.sort((a, b) => b.updated_at - a.updated_at)
			.slice(0, limit)
			.map((r) => ({
				id: r.id,
				name: r.name,
				created_at: new Date(r.created_at).toISOString(),
				updated_at: new Date(r.updated_at).toISOString(),
			}));
	}
	async exists(sessionId: string) {
		return this.sessions.has(sessionId);
	}
	async getSessionInfo(sessionId: string) {
		const r = this.sessions.get(sessionId);
		return r ? { id: r.id, name: r.name } : null;
	}
}
