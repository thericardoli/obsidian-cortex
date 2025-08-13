/**
 * Session 管理模块的类型定义（对齐 OpenAI Agents SDK 输入/输出项）
 */

/**
 * 多模态内容片段类型（与 Agents SDK 对齐的精简版）
 */
export type InputTextPart = {
	type: 'input_text';
	text: string;
	providerData?: Record<string, unknown>;
};
export type OutputTextPart = {
	type: 'output_text';
	text: string;
	providerData?: Record<string, unknown>;
};
export type RefusalPart = {
	type: 'refusal';
	refusal: string;
	providerData?: Record<string, unknown>;
};
export type ImageInputPart = {
	type: 'input_image';
	image: string | { id: string };
	providerData?: Record<string, unknown>;
};
export type ImageOutputPart = {
	type: 'image';
	image: string;
	providerData?: Record<string, unknown>;
};
export type FileInputPart = {
	type: 'input_file';
	file: string | { id: string };
	providerData?: Record<string, unknown>;
};
export type AudioPart = {
	type: 'audio';
	audio: string | { id: string };
	format?: string | null;
	transcript?: string | null;
	providerData?: Record<string, unknown>;
};

export type UserContentPart = InputTextPart | ImageInputPart | FileInputPart | AudioPart;
export type AssistantContentPart = RefusalPart | OutputTextPart | AudioPart | ImageOutputPart;

export type UserMessageItem = {
	type?: 'message';
	id?: string;
	providerData?: Record<string, unknown>;
	role: 'user';
	content: string | UserContentPart[];
};

export type AssistantMessageItem = {
	type?: 'message';
	id?: string;
	providerData?: Record<string, unknown>;
	role: 'assistant';
	status: 'in_progress' | 'completed' | 'incomplete';
	content: AssistantContentPart[];
};

export type SystemMessageItem = {
	type?: 'message';
	id?: string;
	providerData?: Record<string, unknown>;
	role: 'system';
	content: string;
};

export type HostedToolCallItem = {
	type: 'hosted_tool_call';
	id?: string;
	name: string;
	arguments?: string;
	output?: string;
	providerData?: Record<string, unknown>;
	status?: string;
};

export type FunctionCallItem = {
	type: 'function_call';
	id?: string;
	callId: string;
	name: string;
	arguments: string;
	providerData?: Record<string, unknown>;
	status?: 'in_progress' | 'completed' | 'incomplete';
};

export type FunctionCallResultItem = {
	type: 'function_call_result';
	id?: string;
	callId: string;
	name: string;
	output:
		| { type: 'text'; text: string; providerData?: Record<string, unknown> }
		| {
				type: 'image';
				data: string;
				mediaType: string;
				providerData?: Record<string, unknown>;
		  };
	providerData?: Record<string, unknown>;
	status?: 'in_progress' | 'completed' | 'incomplete';
};

export type ReasoningItem = {
	type: 'reasoning';
	id?: string;
	content: object[];
	providerData?: Record<string, unknown>;
};

export type UnknownItem = {
	type: 'unknown';
	id?: string;
	providerData?: Record<string, unknown>;
};

/**
 * Agent 输入/输出联合类型（用于会话存储）
 */
export type AgentItem =
	| UserMessageItem
	| AssistantMessageItem
	| SystemMessageItem
	| HostedToolCallItem
	| FunctionCallItem
	| FunctionCallResultItem
	| ReasoningItem
	| UnknownItem;

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
	getItems(limit?: number): Promise<AgentItem[]>;

	/** 添加新项目（支持 AgentItem 或旧 ConversationItem 的自动适配） */
	addItems(items: AgentItem[]): Promise<void>;

	/**
	 * 移除并返回最近的一个项目（用于撤销操作）
	 * @returns 被移除的项目，如果没有项目则返回 null
	 */
	popItem(): Promise<AgentItem | null>;

	/**
	 * 清空当前 session 的所有项目
	 */
	clearSession(): Promise<void>;

	/**
	 * 释放资源（关闭数据库连接等）
	 */
	dispose(): Promise<void>;

	/**
	 * 将当前会话历史转换为可直接用于 run 的 AgentInputItem[]
	 */
	toAgentInputHistory(options?: ToAgentInputHistoryOptions): Promise<AgentInputItem[]>; // 运行时来自 OpenAI Agent SDK 的 AgentInputItem 类型
}

/**
 * Session 事件类型
 */
export interface SessionEvents {
	/** 当添加新项目时触发 */
	itemAdded: (items: AgentItem[]) => void;
	/** 当项目被移除时触发 */
	itemRemoved: (item: AgentItem) => void;
	/** 当 session 被清空时触发 */
	sessionCleared: () => void;
	/** 当发生错误时触发 */
	error: (error: Error) => void;
}

/**
 * 将当前会话历史转换为可直接用于 run 的 AgentInputItem[] 的选项
 */
export interface ToAgentInputHistoryOptions {
	/** 是否包含 HostedToolCalls */
	includeHostedToolCalls?: boolean; // 默认包含
	/** 是否包含 Reasoning 项 */
	includeReasoning?: boolean; // 默认不包含
	/** 是否包含 Unknown 项 */
	includeUnknown?: boolean; // 默认不包含
}

// 为了在不强耦合实现的前提下提供强类型，这里仅做类型导入
export type AgentInputItem = import('@openai/agents').AgentInputItem;
