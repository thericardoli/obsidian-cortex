import type { ISession, SessionOptions } from '../types/session';
import { EventEmitter } from 'events';
import type { ISessionRepository } from '../persistence/repositories/contracts';
import { createLogger } from '../utils/logger';

/**
 * Session 管理器
 *
 * 负责创建、管理和销毁 Session 实例
 */
export class SessionManager extends EventEmitter {
	private sessions: Map<string, ISession> = new Map();
	private defaultOptions: Partial<SessionOptions> = {};
	private repository?: ISessionRepository; // 延迟注入以兼容初始化顺序
	private logger = createLogger('session');

	constructor(defaultOptions?: Partial<SessionOptions>, repository?: ISessionRepository) {
		super();
		if (defaultOptions) {
			this.defaultOptions = { ...this.defaultOptions, ...defaultOptions };
		}
		this.repository = repository;
	}

	/**
	 * 设置 PersistenceManager（用于后续设置）
	 */
	public setRepository(repository: ISessionRepository): void {
		this.repository = repository;
	}

	/**
	 * 创建 Session
	 */
	public async createChatSession(sessionId: string): Promise<ISession> {
		if (this.sessions.has(sessionId)) {
			throw new Error(`Session with id ${sessionId} already exists`);
		}

		const { chatSession } = await import('./chat-session');

		const sessionRepo = this.repository;

		const session = new chatSession({
			sessionId,
			repo: sessionRepo,
		});

		this.sessions.set(sessionId, session);
		this.emit('sessionCreated', { sessionId });

		return session;
	}

	/**
	 * 创建 Session
	 */
	public async createSession(sessionId: string): Promise<ISession> {
		return this.createChatSession(sessionId);
	}

	/**
	 * 获取现有的 Session（优先从内存，如果不存在则尝试从数据库加载）
	 */
	public async getSession(sessionId: string): Promise<ISession | null> {
		// 首先检查内存缓存
		const cachedSession = this.sessions.get(sessionId);
		if (cachedSession) {
			return cachedSession;
		}

		// 如果内存中没有，尝试从数据库加载
		try {
			const sessionRepo = this.repository;
			if (sessionRepo && (await sessionRepo.exists(sessionId))) {
				const sessionInfo = await sessionRepo.getSessionInfo(sessionId);
				if (sessionInfo) {
					return await this.loadExistingSession(sessionId);
				}
			}
		} catch (error) {
			this.emit('sessionError', { sessionId, error });
			this.logger.error(`Failed to load session ${sessionId} from repository`, error);
		}

		return null;
	}

	/**
	 * 同步获取内存中的 Session
	 */
	public getSessionFromMemory(sessionId: string): ISession | null {
		return this.sessions.get(sessionId) || null;
	}

	/**
	 * 从数据库加载已存在的 Session
	 */
	private async loadExistingSession(sessionId: string): Promise<ISession> {
		const { chatSession } = await import('./chat-session');

		const sessionRepo = this.repository;

		const session = new chatSession({
			sessionId,
			repo: sessionRepo,
		});

		// 将session添加到内存缓存
		this.sessions.set(sessionId, session);
		this.emit('sessionLoaded', { sessionId });

		return session;
	}

	/**
	 * 获取所有Session列表（包括数据库中的）
	 */
	public async getAllSessions(
		limit: number
	): Promise<Array<{ id: string; name?: string; createdAt?: string; updatedAt?: string }>> {
		const sessionRepo = this.repository;
		if (!sessionRepo) {
			return Array.from(this.sessions.entries())
				.map(([id]) => ({ id }))
				.slice(0, limit);
		}
		try {
			const sessions = await sessionRepo.list(limit);
			return sessions.map((row: Record<string, unknown>) => ({
				id: row.id as string,
				name: row.name as string | undefined,
				createdAt: row.created_at as string | undefined,
				updatedAt: row.updated_at as string | undefined,
			}));
		} catch (error) {
			this.emit('sessionError', { error });
			this.logger.error('Failed to list sessions', error);
			return [];
		}
	}

	/**
	 * 创建一个新的Session（确保不与现有session冲突）
	 */
	public async createNewSession(sessionId?: string): Promise<ISession> {
		const newSessionId = sessionId || this.generateSessionId();

		// 检查内存中是否已存在
		if (this.sessions.has(newSessionId)) {
			throw new Error(`Session with id ${newSessionId} already exists in memory`);
		}

		// 检查数据库中是否已存在
		const sessionRepo = this.repository;
		if (sessionRepo && (await sessionRepo.exists(newSessionId))) {
			throw new Error(`Session with id ${newSessionId} already exists in repository`);
		}

		return this.createChatSession(newSessionId);
	}

	/**
	 * 删除 Session
	 */
	public async deleteSession(sessionId: string): Promise<boolean> {
		const session = this.sessions.get(sessionId);
		if (!session && !this.repository) return false; // 兼容行为保持

		try {
			// Dispose (saves & clears) only if in memory
			if (session) {
				await session.dispose();
				this.sessions.delete(sessionId);
			}
			// Remove persistent record
			try {
				await this.repository?.remove(sessionId);
			} catch (e) {
				this.emit('sessionError', { sessionId, error: e });
				throw e;
			}
			this.emit('sessionDeleted', { sessionId });
			return true;
		} catch (error) {
			this.emit('sessionError', { sessionId, error });
			throw error;
		}
	}

	/**
	 * 获取所有 Session ID
	 */
	public getAllSessionIds(): string[] {
		return Array.from(this.sessions.keys());
	}

	/**
	 * 获取 Session 数量
	 */
	public getSessionCount(): number {
		return this.sessions.size;
	}

	/**
	 * 清空所有 Sessions
	 */
	public async clearAllSessions(): Promise<void> {
		const sessionIds = this.getAllSessionIds();

		for (const sessionId of sessionIds) {
			try {
				await this.deleteSession(sessionId);
			} catch (error) {
				this.logger.error(`Failed to delete session ${sessionId}`, error);
			}
		}
	}

	/**
	 * 生成唯一的 Session ID
	 */
	public generateSessionId(): string {
		// Use standard RFC4122 UUID to satisfy database UUID column type
		try {
			// Browser / modern Node (incl. Electron) path
			if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
				return (crypto as unknown as { randomUUID: () => string }).randomUUID();
			}
		} catch {
			/* fall through to manual */
		}
		// Fallback UUID v4 generator
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
			const r = (Math.random() * 16) | 0;
			const v = c === 'x' ? r : (r & 0x3) | 0x8;
			return v.toString(16);
		});
	}

	/**
	 * 释放所有资源
	 */
	public async dispose(): Promise<void> {
		await this.clearAllSessions();
		this.removeAllListeners();
	}
}
