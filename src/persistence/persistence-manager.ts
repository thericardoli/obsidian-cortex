import { createLogger } from '../utils/logger';
import { DatabaseManager, type DatabaseOptions } from './database-manager';
import { AgentRepository } from './repositories/agent-repository';
import type { IAgentRepository, ISessionRepository } from './repositories/contracts';
import { InMemoryAgentRepository, InMemorySessionRepository } from './repositories/contracts';
import { SessionRepository } from './repositories/session-repository';

export interface PersistenceManagerOptions extends DatabaseOptions {
	/** 是否在初始化时立即连接数据库 */
	autoConnect?: boolean;
}

export class PersistenceManager {
	private logger = createLogger('persistence');
	private dbManager: DatabaseManager;
	private agentRepository: IAgentRepository;
	private sessionRepository: ISessionRepository;
	private persistent = false;

	constructor(private options: PersistenceManagerOptions = {}) {
		this.dbManager = new DatabaseManager(options);
		// 默认使用内存实现，避免调用方判空
		this.agentRepository = new InMemoryAgentRepository();
		this.sessionRepository = new InMemorySessionRepository();
	}

	/**
	 * 初始化数据库；失败则保持内存模式
	 */
	async initialize(): Promise<void> {
		if (this.persistent) return; // 已经是持久化模式

		try {
			await this.dbManager.initialize();
			this.agentRepository = new AgentRepository(this.dbManager);
			this.sessionRepository = new SessionRepository(this.dbManager);
			this.persistent = true;
		} catch (err) {
			// 降级：保持内存实现
			this.logger.warn(
				'Failed to initialize persistence, falling back to in-memory mode',
				err
			);
			this.persistent = false;
		}
	}

	getAgentRepository(): IAgentRepository {
		return this.agentRepository;
	}

	getSessionRepository(): ISessionRepository {
		return this.sessionRepository;
	}

	async createSessionRecord(sessionId: string, name?: string): Promise<void> {
		await this.sessionRepository.create(sessionId, name);
	}

	isPersistent(): boolean {
		return this.persistent;
	}

	async dispose(): Promise<void> {
		try {
			await this.dbManager.close();
		} catch {
			/* ignore */
		}
		// 回退为新的内存仓库，以防后续仍被调用
		this.agentRepository = new InMemoryAgentRepository();
		this.sessionRepository = new InMemorySessionRepository();
		this.persistent = false;
	}
}
