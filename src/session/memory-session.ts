import {
	ISession,
	AgentItem,
	SessionOptions,
	UserMessageItem,
	AssistantMessageItem,
	SystemMessageItem,
	FunctionCallItem,
	FunctionCallResultItem,
} from "../types/session";
import { EventEmitter } from "events";

/**
 * 内存中的 Session 实现（对齐 Agents SDK 的 AgentItem）
 */
export class MemorySession extends EventEmitter implements ISession {
	public readonly sessionId: string;
	private items: AgentItem[] = [];

	constructor(options: SessionOptions) {
		super();
		this.sessionId = options.sessionId;
	}

	public get itemCount(): number {
		return this.items.length;
	}

	/**
	 * 获取对话历史项目
	 */
	public async getItems(limit?: number): Promise<AgentItem[]> {
		try {
			let result = [...this.items];
			if (limit && limit > 0) {
				result = result.slice(-limit);
			}
			return result;
		} catch (error) {
			this.emit("error", new Error(`Failed to get items: ${error}`));
			throw error;
		}
	}

	/**
	 * 添加新的对话项目
	 */
	public async addItems(items: AgentItem[]): Promise<void> {
		try {
			if (!Array.isArray(items) || items.length === 0) {
				return;
			}
			const normalized: AgentItem[] = [];
			for (const item of items) {
				this.validateItem(item);
				normalized.push(item);
			}
			this.items.push(...normalized);
			this.emit("itemAdded", normalized);
		} catch (error) {
			this.emit("error", new Error(`Failed to add items: ${error}`));
			throw error;
		}
	}

	/**
	 * 移除并返回最近的一个项目
	 */
	public async popItem(): Promise<AgentItem | null> {
		try {
			const item = this.items.pop() ?? null;
			if (item) {
				this.emit("itemRemoved", item);
			}
			return item;
		} catch (error) {
			this.emit("error", new Error(`Failed to pop item: ${error}`));
			throw error;
		}
	}

	/**
	 * 清空当前 session 的所有项目
	 */
	public async clearSession(): Promise<void> {
		try {
			this.items = [];
			this.emit("sessionCleared");
		} catch (error) {
			this.emit("error", new Error(`Failed to clear session: ${error}`));
			throw error;
		}
	}

	/**
	 * 释放资源
	 */
	public async dispose(): Promise<void> {
		try {
			this.items = [];
			this.removeAllListeners();
		} catch (error) {
			this.emit(
				"error",
				new Error(`Failed to dispose session: ${error}`)
			);
			throw error;
		}
	}

	/**
	 * 验证对话项目的格式（最小必要校验）
	 */
	private validateItem(item: AgentItem): void {
		if (isMessageItem(item)) {
			if (isSystemMessage(item)) {
				if (typeof item.content !== "string") {
					throw new Error("System message content must be a string");
				}
			}
			return;
		}
		if (isFunctionCall(item)) {
			if (
				!item.callId ||
				!item.name ||
				typeof item.arguments !== "string"
			) {
				throw new Error(
					"Function call must include callId, name and arguments(string)"
				);
			}
			return;
		}
		if (isFunctionResult(item)) {
			if (!item.callId || !item.name || !item.output) {
				throw new Error(
					"Function call result must include callId, name and output"
				);
			}
			return;
		}
		// 其它类型不做强校验
	}

	/**
	 * 便捷方法：添加单个项目
	 */
	public async addItem(item: AgentItem): Promise<void> {
		await this.addItems([item]);
	}

	/**
	 * 根据角色筛选项目（仅针对 message 项）
	 */
	public async getItemsByRole(
		role: "user" | "assistant" | "system",
		limit?: number
	): Promise<AgentItem[]> {
		try {
			let filtered = this.items.filter(
				(
					item
				): item is
					| UserMessageItem
					| AssistantMessageItem
					| SystemMessageItem =>
					isMessageItem(item) && item.role === role
			);
			if (limit && limit > 0) {
				filtered = filtered.slice(-limit);
			}
			return filtered as AgentItem[];
		} catch (error) {
			this.emit(
				"error",
				new Error(`Failed to get items by role: ${error}`)
			);
			throw error;
		}
	}

	/**
	 * 获取指定时间范围内的项目（需要调用方在 providerData 中写入 timestamp）
	 */
	public async getItemsInTimeRange(
		startTime: number,
		endTime: number
	): Promise<AgentItem[]> {
		try {
			return this.items.filter((item) => {
				const providerData = (
					item as { providerData?: { timestamp?: unknown } }
				).providerData;
				const ts = providerData?.timestamp;
				return (
					typeof ts === "number" && ts >= startTime && ts <= endTime
				);
			});
		} catch (error) {
			this.emit(
				"error",
				new Error(`Failed to get items in time range: ${error}`)
			);
			throw error;
		}
	}

	/**
	 * 将会话历史转换为 AgentInputItem[]（供 run 使用）
	 */
	public async toAgentInputHistory(options?: {
		includeHostedToolCalls?: boolean;
		includeReasoning?: boolean;
		includeUnknown?: boolean;
	}): Promise<import("@openai/agents").AgentInputItem[]> {
		const opts = {
			includeHostedToolCalls: true,
			includeReasoning: false,
			includeUnknown: false,
			...(options || {}),
		};
		const items = await this.getItems();
		const mapped = items
			.map((item) => {
				if (isMessageItem(item)) {
					if (isUserMessage(item)) {
						return {
							role: "user" as const,
							content: item.content,
							type: "message" as const,
						};
					}
					if (isAssistantMessage(item)) {
						return {
							role: "assistant" as const,
							content: item.content,
							status: item.status,
							type: "message" as const,
						};
					}
					if (isSystemMessage(item)) {
						return {
							role: "system" as const,
							content: item.content,
							type: "message" as const,
						};
					}
					return undefined;
				}
				if (isFunctionCall(item)) {
					return {
						type: "function_call" as const,
						callId: item.callId,
						name: item.name,
						arguments: item.arguments,
						status: item.status ?? "in_progress",
					};
				}
				if (isFunctionResult(item)) {
					return {
						type: "function_call_result" as const,
						callId: item.callId,
						name: item.name,
						output: item.output,
						status: item.status ?? "completed",
					};
				}
				if (
					opts.includeHostedToolCalls &&
					hasType(item) &&
					item.type === "hosted_tool_call"
				) {
					const obj = item as {
						type: "hosted_tool_call";
						name: string;
						arguments?: string;
						output?: string;
						status?: string;
					};
					return {
						type: "hosted_tool_call",
						name: obj.name,
						arguments: obj.arguments,
						output: obj.output,
						status: obj.status,
					};
				}
				if (
					opts.includeReasoning &&
					hasType(item) &&
					item.type === "reasoning"
				)
					return item;
				if (
					opts.includeUnknown &&
					hasType(item) &&
					item.type === "unknown"
				)
					return item;
				return undefined;
			})
			.filter((x): x is Exclude<typeof x, undefined> => x !== undefined);
		return mapped as unknown as import("@openai/agents").AgentInputItem[];
	}
}

/**
 * 类型守卫与类型判断
 */
function hasType(x: AgentItem): x is AgentItem & { type: string } {
	return typeof (x as { type?: unknown }).type === "string";
}
function hasRole(
	x: AgentItem
): x is UserMessageItem | AssistantMessageItem | SystemMessageItem {
	const r = (x as { role?: unknown }).role;
	return r === "user" || r === "assistant" || r === "system";
}
function isMessageItem(
	item: AgentItem
): item is UserMessageItem | AssistantMessageItem | SystemMessageItem {
	return (!hasType(item) || item.type === "message") && hasRole(item);
}
function isSystemMessage(item: AgentItem): item is SystemMessageItem {
	return isMessageItem(item) && item.role === "system";
}
function isUserMessage(item: AgentItem): item is UserMessageItem {
	return isMessageItem(item) && item.role === "user";
}
function isAssistantMessage(item: AgentItem): item is AssistantMessageItem {
	return isMessageItem(item) && item.role === "assistant";
}
function isFunctionCall(item: AgentItem): item is FunctionCallItem {
	return hasType(item) && item.type === "function_call";
}
function isFunctionResult(item: AgentItem): item is FunctionCallResultItem {
	return hasType(item) && item.type === "function_call_result";
}
