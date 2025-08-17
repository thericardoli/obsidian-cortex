import type { ISession, AgentInputItem } from '../types/session';
import { EventEmitter } from 'events';
import type { ISessionRepository } from '../persistence/repositories/contracts';
import { createLogger, type Logger } from '../utils/logger';

/**
 * 智能缓存 Session
 * 简化策略：完整对话保存在内存中，会话结束时统一保存到数据库
 */
export class chatSession extends EventEmitter implements ISession {
	readonly sessionId: string;
	private memoryCache: AgentInputItem[] = [];
	private repo?: ISessionRepository;
	private isLoaded = false;
	private logger: Logger;

	constructor(options: { sessionId: string; repo?: ISessionRepository }) {
		super();
		this.sessionId = options.sessionId;
		this.repo = options.repo;
		this.logger = createLogger('session');
	}

	/**
	 * 确保数据已从数据库加载到内存
	 */
	private async ensureLoaded(): Promise<void> {
		if (this.isLoaded || !this.repo) return;

		try {
			// 检查数据库中的 session 是否存在
			const exists = await this.repo.exists(this.sessionId);
			if (exists) {
				// 从数据库加载所有历史数据
				this.memoryCache = await this.repo.getItems(this.sessionId);
			} else {
				// 创建新的 session 记录
				await this.repo.create(this.sessionId);
				this.memoryCache = [];
			}
			this.isLoaded = true;
		} catch (error) {
			this.emit('error', new Error(`Failed to load session: ${error}`));
			throw error;
		}
	}

	/**
	 * 获取对话历史项目
	 */
	async getItems(limit?: number): Promise<AgentInputItem[]> {
		await this.ensureLoaded();

		if (limit && limit > 0) {
			return this.memoryCache.slice(-limit);
		}
		return [...this.memoryCache];
	}

	/**
	 * 添加新的对话项目
	 */
	async addItems(items: AgentInputItem[]): Promise<void> {
		if (!Array.isArray(items) || items.length === 0) {
			return;
		}

		await this.ensureLoaded();

		try {
			// 简单策略：直接添加到内存，不做复杂的限制和异步保存
			this.memoryCache.push(...items);

			// 立即触发事件
			this.emit('itemAdded', items);
		} catch (error) {
			this.emit('error', new Error(`Failed to add items: ${error}`));
			throw error;
		}
	}

	async popItem(): Promise<AgentInputItem | null> {
		await this.ensureLoaded();

		const item = this.memoryCache.pop() ?? null;
		if (item) {
			this.emit('itemRemoved', item);
		}
		return item;
	}

	async clearSession(): Promise<void> {
		await this.ensureLoaded();

		this.memoryCache = [];
		this.emit('sessionCleared');
	}

	/**
	 * 会话结束时保存到数据库
	 */
	async saveSessionToDatabase(): Promise<void> {
		if (!this.repo) {
			this.logger.warn(
				'No repository available for saving. Data will only be kept in memory.'
			);
			return;
		}

		await this.ensureLoaded();

		try {
			// 清空数据库中的数据并保存当前完整会话
			await this.repo.clear(this.sessionId);
			if (this.memoryCache.length > 0) {
				await this.repo.addItems(this.sessionId, this.memoryCache);
			}
			this.logger.info(`已保存 ${this.memoryCache.length} 条聊天记录到数据库`);
		} catch (error) {
			this.emit('error', new Error(`Failed to save session to database: ${error}`));
			this.logger.error(`Failed to save session to database: ${error}`);
		}
	}

	async dispose(): Promise<void> {
		// 会话结束时自动保存
		await this.saveSessionToDatabase();
		this.removeAllListeners();
	}

	/**
	 * 强制保存所有数据到数据库（聊天结束时调用）
	 */
	async forceFullSave(): Promise<void> {
		await this.saveSessionToDatabase();
	}
}
