import { EventEmitter } from 'events';
import type { ISessionRepository } from '../persistence/repositories/contracts';
import type { AgentInputItem, ISession } from '../types/session';
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
	// autosave
	private buffer: AgentInputItem[] = [];
	private autoSaveIntervalMs = 3000;
	private autoSaveMaxBuffer = 20;
	private autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
	private flushing = false;

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
			this.memoryCache.push(...items);
			this.buffer.push(...items);
			this.emit('itemAdded', items);
			this.scheduleAutoSave();
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
		this.buffer = [];
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
			await this.flush();
			this.logger.info(`会话 ${this.sessionId} 已保存（flush 缓存）`);
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

	// 计划自动保存
	private scheduleAutoSave() {
		if (this.buffer.length >= this.autoSaveMaxBuffer) {
			void this.flush();
			return;
		}
		if (this.autoSaveTimer) return;
		this.autoSaveTimer = setTimeout(() => {
			this.autoSaveTimer = null;
			void this.flush();
		}, this.autoSaveIntervalMs);
	}

	// 将缓冲附加到仓储
	public async flush(): Promise<void> {
		if (!this.repo) return;
		if (this.flushing) return;
		if (this.buffer.length === 0) return;
		this.flushing = true;
		const toWrite = this.buffer.splice(0, this.buffer.length);
		try {
			await this.repo.appendItems(this.sessionId, toWrite);
			this.emit('autosaveFlushed', { count: toWrite.length });
		} catch (err) {
			this.buffer.unshift(...toWrite);
			this.emit('autosaveError', err instanceof Error ? err : new Error(String(err)));
			setTimeout(() => this.scheduleAutoSave(), Math.min(this.autoSaveIntervalMs * 2, 15000));
		} finally {
			this.flushing = false;
		}
	}
}
