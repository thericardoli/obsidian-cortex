/**
 * Session 管理模块的类型定义
 *
 * 用于管理对话历史和上下文窗口。
 */

/**
 * 对话项目接口 - 表示对话中的一条记录
 */
export interface ConversationItem {
	id: string;
	/** 角色：user、assistant、system、tool */
	role: "user" | "assistant" | "system" | "tool";
	/** 消息内容 */
	content: string;
	/** 时间戳 */
	timestamp: number;
	/** 工具调用信息（如果是工具相关） */
	toolCall?: {
		id: string;
		name: string;
		arguments: Record<string, unknown>;
	};
	/** 工具结果（如果是工具响应） */
	toolResult?: {
		toolCallId: string;
		result: unknown;
	};
	/** 附加元数据 */
	metadata?: Record<string, unknown>;
}

/**
 * Session 配置选项
 */
export interface SessionOptions {
	/** Session ID */
	sessionId: string;
	/** 持久化选项（仅对持久化实现有效） */
	persistenceOptions?: {
		/** 数据库路径 */
		dbPath?: string;
		/** 自动保存间隔（毫秒） */
		autoSaveInterval?: number;
	};
}

/**
 * Session 接口 
 *
 */
export interface ISession {
	/** Session 唯一标识符 */
	readonly sessionId: string;

	/**
	 * 获取对话历史项目
	 * @param limit 可选的限制数量，用于控制上下文窗口大小
	 * @returns 对话项目列表，按时间顺序排序
	 */
	getItems(limit?: number): Promise<ConversationItem[]>;

	/**
	 * 添加新的对话项目
	 * @param items 要添加的项目列表
	 */
	addItems(items: ConversationItem[]): Promise<void>;

	/**
	 * 移除并返回最近的一个项目（用于撤销操作）
	 * @returns 被移除的项目，如果没有项目则返回 null
	 */
	popItem(): Promise<ConversationItem | null>;

	/**
	 * 清空当前 session 的所有项目
	 */
	clearSession(): Promise<void>;

	/**
	 * 获取 session 的统计信息
	 */
	getStats(): Promise<{
		itemCount: number;
		totalTokens?: number;
		firstItemTimestamp?: number;
		lastItemTimestamp?: number;
	}>;

	/**
	 * 释放资源（关闭数据库连接等）
	 */
	dispose(): Promise<void>;
}

/**
 * Session 事件类型
 */
export interface SessionEvents {
	/** 当添加新项目时触发 */
	itemAdded: (items: ConversationItem[]) => void;
	/** 当项目被移除时触发 */
	itemRemoved: (item: ConversationItem) => void;
	/** 当 session 被清空时触发 */
	sessionCleared: () => void;
	/** 当发生错误时触发 */
	error: (error: Error) => void;
}

/**
 * Session 工厂函数的选项
 */
export interface CreateSessionOptions extends SessionOptions {
	/** Session 类型 */
	type: "memory" | "pglite" | "custom";
	/** 自定义 session 类（当 type 为 'custom' 时使用） */
	customSessionClass?: new (options: SessionOptions) => ISession;
}

/**
 * 用于 Agent 运行的 Session 上下文
 */
export interface SessionContext {
	/** 当前使用的 session */
	session: ISession;
	/** 是否自动保存对话历史 */
	autoSave: boolean;
	/** 上下文窗口配置 */
	contextWindow: {
		/** 最大令牌数 */
		maxTokens?: number;
		/** 最大项目数 */
		maxItems?: number;
		/** 截断策略：'oldest' | 'newest' | 'intelligent' */
		truncationStrategy?: "oldest" | "newest" | "intelligent";
	};
}
