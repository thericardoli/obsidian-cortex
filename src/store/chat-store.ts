import { run } from '@openai/agents';
import type { Agent } from '@openai/agents';
import type { AgentInputItem } from '@openai/agents';
import type { RunStreamEvent } from '@openai/agents-core';
import type { Readable } from 'svelte/store';
import { writable } from 'svelte/store';
// Removed App / WorkspaceLeaf dependencies (milestone 1.3)

import type { AgentManager } from '../agent/agent-manager';
import type { AgentService } from '../agent/agent-service';
import type { ProviderManager } from '../providers/provider-manager';
import type { PluginSettings } from '../types';
import type { AgentConfig } from '../types/agent';
import type { SessionServiceApi } from '../session/session-service';
import type { EventBus } from '../utils/event-bus';
import type { AssistantMessageItem, ISession } from '../types/session';
import { buildModelKey, parseModelKey } from '../utils/model-key';
import { composeRunInput } from './chat/input-builder';
import { extractDelta } from './chat/stream-parser';
import { recomputeDerived } from './chat/state-derivations';
import { mapAgentInputItemsToChatMessages } from './chat/session-adapter';
import { extractTextFromResult } from './chat/result-extractor';
import { createLogger } from '../utils/logger';

const logger = createLogger('ui');

export interface ChatMessage {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	timestamp: number;
	isStreaming?: boolean;
}

export interface ModelGroupItem {
	key: string;
	label: string;
	modelId: string;
}
export interface ModelGroup {
	providerId: string;
	providerName: string;
	items: ModelGroupItem[];
}

export interface ChatState {
	messages: ChatMessage[];
	selectedAgent: AgentConfig | null;
	selectedModelKey: string;
	isLoading: boolean;
	currentSessionId: string;
	sessionList: Array<{ id: string; name?: string }>;
	availableAgents: AgentConfig[];
	modelGroups: ModelGroup[];
	canSend: boolean;
}

export interface ChatActions {
	sendMessage(text: string): Promise<void>;
	changeAgent(agentId: string): void;
	changeModel(key: string): void;
	createSession(): Promise<void>;
	selectSession(id: string): Promise<void>;
	deleteSession(id: string): Promise<void>;
	dispose(): Promise<void>;
}

export interface ChatStore extends Readable<ChatState> {
	actions: ChatActions;
}

// buildGroupedModels & extractTextFromResult 已移动至独立模块

export function createChatStore(opts: {
	agentManager: AgentManager;
	agentService: AgentService;
	providerManager: ProviderManager;
	getSettings: () => PluginSettings;
	sessionService: SessionServiceApi;
	eventBus: EventBus;
}): ChatStore {
	const { agentManager, agentService, providerManager, getSettings, sessionService, eventBus } =
		opts;

	const state: ChatState = {
		messages: [],
		selectedAgent: null,
		selectedModelKey: '',
		isLoading: false,
		currentSessionId: '',
		sessionList: [],
		availableAgents: [],
		modelGroups: [],
		canSend: false,
	};

	let currentAgentInstance: Agent | null = null;
	let disposed = false;

	// Svelte store (replace manual subscriber set)
	const { subscribe, set } = writable<ChatState>(state);
	const flush = () => set({ ...state });
	const notify = flush; // alias for readability

	function recompute() {
		recomputeDerived({
			state,
			agents: agentManager.listAgents(),
			settings: getSettings(),
			providerManager,
		});
	}

	function commit(mutator?: () => void) {
		if (mutator) mutator();
		recompute();
		notify();
	}

	async function createAgentInstance(): Promise<void> {
		if (!state.selectedAgent) {
			currentAgentInstance = null;
			return;
		}
		try {
			commit(() => {
				state.isLoading = true;
			});
			const parsed = parseModelKey(state.selectedModelKey);
			if (parsed) {
				currentAgentInstance = await agentService.createWithModelOverride(
					state.selectedAgent.id,
					parsed.providerId,
					parsed.modelId
				);
			} else {
				currentAgentInstance = await agentService.create(state.selectedAgent.id);
			}
		} finally {
			commit(() => {
				state.isLoading = false;
			});
		}
	}

	async function createSessionInternal(): Promise<void> {
		const sess = await sessionService.createNew();
		state.currentSessionId = sess.sessionId;
	}

	async function refreshSessionList(): Promise<void> {
		try {
			const rows = await sessionService.list(50);
			state.sessionList = rows.map((r) => ({ id: r.id, name: r.name }));
		} catch (e) {
			logger.warn('Failed to load sessions', e);
			state.sessionList = [];
		}
	}

	async function init(): Promise<void> {
		recompute();
		await createSessionInternal();
		await refreshSessionList();
		await createAgentInstance();
		notify();
	}

	// Subscriptions to external events
	const offAgents = eventBus.on('agentsChanged', () => commit());
	const offProv = eventBus.on('providersUpdated', () => commit());
	const offModels = eventBus.on('modelsUpdated', () => commit());

	// Public actions
	const actions: ChatActions = {
		async sendMessage(text: string) {
			if (!state.canSend || !currentAgentInstance || !state.selectedAgent) return;

			const userMessage: ChatMessage = {
				id: crypto.randomUUID(),
				role: 'user',
				content: text,
				timestamp: Date.now(),
			};
			commit(() => {
				state.messages = [...state.messages, userMessage];
				state.isLoading = true;
			});

			const assistant: ChatMessage = {
				id: crypto.randomUUID(),
				role: 'assistant',
				content: '',
				timestamp: Date.now(),
				isStreaming: true,
			};
			state.messages = [...state.messages, assistant];
			const lastIndex = state.messages.length - 1;
			notify();

			const executeStreaming = async () => {
				let maybeSession: ISession | null = null;
				try {
					// 1. 加载会话
					try {
						maybeSession = await opts.sessionService.get(state.currentSessionId);
					} catch {
						maybeSession = null;
					}

					// 2. 先写入用户消息到会话
					if (maybeSession) {
						const userItem: AgentInputItem = {
							role: 'user',
							type: 'message',
							content: [{ type: 'input_text', text }],
						};
						await maybeSession.addItems([userItem]);
					}

					// 3. 构造输入
					let sessionHistory: AgentInputItem[] | null = null;
					if (maybeSession) {
						try {
							sessionHistory = await maybeSession.getItems();
						} catch {
							sessionHistory = null;
						}
					}
					const inputForRun = composeRunInput({
						sessionHistory,
						fallbackState: state.messages,
					});

					// 4. 运行流式请求
					type RunStream = AsyncIterable<RunStreamEvent> & { finalOutput?: string };
					const agentRef = currentAgentInstance;
					if (!agentRef) throw new Error('Agent instance disposed');
					const stream = (await run(agentRef, inputForRun, {
						stream: true,
					})) as RunStream;

					// 5. 逐 delta 直接更新（避免后台标签页定时器被 throttle 导致停滞）
					for await (const ev of stream) {
						const delta = extractDelta(ev);
						if (delta) {
							// 保持不可变更新以触发订阅
							const last = state.messages[lastIndex];
							state.messages = state.messages.map((m, i) =>
								i === lastIndex ? { ...last, content: last.content + delta } : m
							);
							flush();
						}
					}

					// 6. 补全最终内容（若未取到 delta）
					let finalTextComputed = state.messages[lastIndex].content;
					if (!finalTextComputed || finalTextComputed.length === 0) {
						try {
							const fallbackOutput = stream.finalOutput;
							if (typeof fallbackOutput === 'string' && fallbackOutput.length > 0) {
								finalTextComputed = fallbackOutput;
							} else {
								finalTextComputed = extractTextFromResult(stream);
							}
						} catch {
							finalTextComputed = 'No response content available';
						}
					}
					// 更新最后一条消息的最终内容与状态
					state.messages = state.messages.map((m, i) =>
						i === lastIndex
							? { ...m, content: finalTextComputed, isStreaming: false }
							: m
					);

					// 7. 落库 assistant 消息
					if (maybeSession) {
						const finalText = finalTextComputed ?? '';
						const assistantItem: AssistantMessageItem = {
							role: 'assistant',
							type: 'message',
							status: 'completed',
							content: [{ type: 'output_text', text: finalText }],
						};
						maybeSession.addItems([assistantItem]);
					}

					commit(() => {
						state.isLoading = false;
					});
				} catch (error) {
					// 移除空的占位 assistant 消息
					const last = state.messages[state.messages.length - 1];
					if (last?.role === 'assistant' && last?.content === '') {
						state.messages = state.messages.slice(0, -1);
					}
					const msg = error instanceof Error ? error.message : 'Unknown error occurred';
					state.messages = [
						...state.messages,
						{
							id: crypto.randomUUID(),
							role: 'assistant',
							content: `Error: ${msg}`,
							timestamp: Date.now(),
						},
					];

					commit(() => {
						state.isLoading = false;
					});
				}
			};

			executeStreaming();
		},
		changeAgent(agentId: string) {
			const next = agentManager.listAgents().find((a) => a.id === agentId) ?? null;
			commit(() => {
				state.selectedAgent = next;
				if (next) {
					state.selectedModelKey = buildModelKey(
						next.modelConfig.provider,
						next.modelConfig.model
					);
				}
			});
			// Recreate agent instance on next tick
			void createAgentInstance();
		},
		changeModel(key: string) {
			commit(() => {
				state.selectedModelKey = key;
			});
			void createAgentInstance();
		},
		async createSession() {
			// End current to force save
			if (state.currentSessionId) {
				try {
					const s = await opts.sessionService.get(state.currentSessionId);
					await s?.dispose();
				} catch {
					/* ignore dispose errors */
				}
			}
			await createSessionInternal();
			state.messages = [];
			await refreshSessionList();
			// 将新 session 放到列表顶部（如果不在的话）
			if (state.currentSessionId) {
				const rest = state.sessionList.filter((s) => s.id !== state.currentSessionId);
				state.sessionList = [{ id: state.currentSessionId }, ...rest];
			}
			commit();
		},
		async selectSession(id: string) {
			if (!id || id === state.currentSessionId) return;
			try {
				const s = await opts.sessionService.get(state.currentSessionId);
				await s?.dispose();
			} catch {
				/* ignore dispose errors */
			}
			try {
				const target = await opts.sessionService.get(id);
				if (target) {
					state.currentSessionId = id;
					const items = await target.getItems();
					state.messages = mapAgentInputItemsToChatMessages(items);
				} else {
					await createSessionInternal();
					state.messages = [];
				}
			} catch (e) {
				logger.warn('Failed to switch session', e);
			}
			await refreshSessionList();
			notify();
		},
		async deleteSession(id: string) {
			if (!id) return;
			try {
				await opts.sessionService.delete(id);
				// If deleting current, start a fresh one
				if (id === state.currentSessionId) {
					state.messages = [];
					state.currentSessionId = '';
					await createSessionInternal(); // sets currentSessionId
				}
			} catch (e) {
				logger.warn('Failed to delete session', e);
			}
			await refreshSessionList();
			commit();
		},
		async dispose() {
			if (disposed) return;
			disposed = true;
			try {
				const s = await opts.sessionService.get(state.currentSessionId);
				await s?.dispose();
			} catch {
				/* ignore dispose errors */
			}
			offAgents?.();
			offProv?.();
			offModels?.();
		},
	};

	// 初始化
	init();

	return {
		subscribe,
		actions,
	};
}
