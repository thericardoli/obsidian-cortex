import type {
	ISession,
	AgentItem,
	ToAgentInputHistoryOptions,
	AgentInputItem,
	UserMessageItem,
	AssistantMessageItem,
	FunctionCallItem,
	FunctionCallResultItem,
	SystemMessageItem,
	UserContentPart,
	AssistantContentPart,
} from "../types/session";
import { EventEmitter } from "events";
import type { SessionRepository } from "../persistence/repositories/session-repository";

/**
 * 智能缓存 Session
 * 简化策略：完整对话保存在内存中，会话结束时统一保存到数据库
 */
export class chatSession extends EventEmitter implements ISession {
	readonly sessionId: string;
	private memoryCache: AgentItem[] = [];
	private repo?: SessionRepository;
	private isLoaded = false;

	constructor(options: {
		sessionId: string;
		repo?: SessionRepository;
	}) {
		super();
		this.sessionId = options.sessionId;
		this.repo = options.repo;
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
			this.emit("error", new Error(`Failed to load session: ${error}`));
			throw error;
		}
	}

	/**
	 * 获取对话历史项目（超快速度 - 直接从内存）
	 */
	async getItems(limit?: number): Promise<AgentItem[]> {
		await this.ensureLoaded();

		if (limit && limit > 0) {
			return this.memoryCache.slice(-limit);
		}
		return [...this.memoryCache];
	}

	/**
	 * 添加新的对话项目（简单直接 - 直接加入内存）
	 */
	async addItems(items: AgentItem[]): Promise<void> {
		if (!Array.isArray(items) || items.length === 0) {
			return;
		}

		await this.ensureLoaded();

		try {
			// 简单策略：直接添加到内存，不做复杂的限制和异步保存
			this.memoryCache.push(...items);

			// 立即触发事件
			this.emit("itemAdded", items);
		} catch (error) {
			this.emit("error", new Error(`Failed to add items: ${error}`));
			throw error;
		}
	}

	async popItem(): Promise<AgentItem | null> {
		await this.ensureLoaded();

		const item = this.memoryCache.pop() ?? null;
		if (item) {
			this.emit("itemRemoved", item);
		}
		return item;
	}

	async clearSession(): Promise<void> {
		await this.ensureLoaded();

		this.memoryCache = [];
		this.emit("sessionCleared");
	}

	/**
	 * 会话结束时保存到数据库
	 */
	async saveSessionToDatabase(): Promise<void> {
		if (!this.repo) {
			console.warn(
				"No repository available for saving. Data will only be kept in memory."
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
			console.log(
				`✅ 已保存 ${this.memoryCache.length} 条聊天记录到数据库`
			);
		} catch (error) {
			this.emit(
				"error",
				new Error(`Failed to save session to database: ${error}`)
			);
			throw error;
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

	async toAgentInputHistory(
		options?: ToAgentInputHistoryOptions
	): Promise<AgentInputItem[]> {
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
						// Normalize content to handle multi-turn conversations with some providers
						let content: string | UserContentPart[] = item.content;
						if (
							Array.isArray(content) &&
							content.length === 1 &&
							content[0].type === "input_text"
						) {
							content = content[0].text;
						}

						return {
							role: "user" as const,
							content: content,
							type: "message" as const,
						};
					}
					if (isAssistantMessage(item)) {
						// Normalize content to handle multi-turn conversations with some providers
						let content: string | AssistantContentPart[] =
							item.content;
						if (
							content.length === 1 &&
							content[0].type === "output_text"
						) {
							content = content[0].text;
						}

						return {
							role: "assistant" as const,
							content: content,
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
		return mapped as unknown as AgentInputItem[];
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
