/**
 * Session 管理模块核心类型：现在直接复用并 re-export OpenAI Agents SDK 的定义，避免重复维护。
 * 保留原有名称 AgentInputItem以减少改动。
 * SDK 未来新增的成员（例如 computer_call）也会自动纳入。
 */
import type { AgentInputItem } from '@openai/agents';
export type {
	UserMessageItem,
	AssistantMessageItem,
	SystemMessageItem,
	HostedToolCallItem,
	FunctionCallItem,
	FunctionCallResultItem,
	ReasoningItem,
	UnknownItem,
} from '@openai/agents';

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
	 * 获取对话历史项目（按时间顺序）。
	 * 对齐 SDK：推荐以 AgentItem 作为主要存储类型。
	 */
	getItems(limit?: number): Promise<AgentInputItem[]>;

	/** 添加新项目（支持 AgentItem 或旧 ConversationItem 的自动适配） */
	addItems(items: AgentInputItem[]): Promise<void>;

	/**
	 * 移除并返回最近的一个项目（用于撤销操作）
	 * @returns 被移除的项目，如果没有项目则返回 null
	 */
	popItem(): Promise<AgentInputItem | null>;

	/**
	 * 清空当前 session 的所有项目
	 */
	clearSession(): Promise<void>;

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
	itemAdded: (items: AgentInputItem[]) => void;
	/** 当项目被移除时触发 */
	itemRemoved: (item: AgentInputItem) => void;
	/** 当 session 被清空时触发 */
	sessionCleared: () => void;
	/** 当发生错误时触发 */
	error: (error: Error) => void;
}

export type { AgentInputItem } from '@openai/agents';
