import type { Plugin } from 'obsidian';
import { DatabaseManager, type DatabaseOptions } from './database-manager';
import { AgentRepository } from './repositories/agent-repository';
import { SessionRepository } from './repositories/session-repository';

export interface PersistenceManagerOptions extends DatabaseOptions {
	/** 是否在初始化时立即连接数据库 */
	autoConnect?: boolean;
}

export class PersistenceManager {
	private dbManager: DatabaseManager;
	private agentRepository: AgentRepository | null = null;
	private sessionRepository: SessionRepository | null = null;
	private initialized = false;

	constructor(
		private plugin: Plugin,
		private options: PersistenceManagerOptions = {}
	) {
		this.dbManager = new DatabaseManager(plugin, options);
	}

	async initialize(): Promise<void> {
		if (this.initialized) return;

		await this.dbManager.initialize();
		this.agentRepository = new AgentRepository(this.dbManager);
		this.sessionRepository = new SessionRepository(this.dbManager);
		this.initialized = true;
	}

	getAgentRepository(): AgentRepository {
		if (!this.agentRepository) {
			throw new Error('PersistenceManager not initialized. Call initialize() first.');
		}
		return this.agentRepository;
	}

	getSessionRepository(): SessionRepository {
		if (!this.sessionRepository) {
			throw new Error('PersistenceManager not initialized. Call initialize() first.');
		}
		return this.sessionRepository;
	}

	/**
	 * 创建一个新的 session 记录
	 */
	async createSessionRecord(sessionId: string, name?: string): Promise<void> {
		const repo = this.getSessionRepository();
		await repo.create(sessionId, name);
	}

	isInitialized(): boolean {
		return this.initialized;
	}

	async dispose(): Promise<void> {
		await this.dbManager.close();
		this.agentRepository = null;
		this.sessionRepository = null;
		this.initialized = false;
	}
}
