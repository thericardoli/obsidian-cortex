import { run } from '@openai/agents';
import type { Agent } from '@openai/agents';
import type { Readable } from 'svelte/store';
import type { App, WorkspaceLeaf } from 'obsidian';

import type { AgentManager } from '../../agent/agent-manager';
import type { ProviderManager } from '../../providers/provider-manager';
import type { PluginSettings } from '../../types';
import type { AgentConfig } from '../../types/agent';
import type { SessionServiceApi } from '../../services/session-service';
import type { EventBus } from '../../services/event-bus';
import type { AgentInputItem } from '../../types/session';
import type { AgentItem, AssistantMessageItem } from '../../types/session';
import { parseModelKey } from '../../utils/model-key';
import { composeRunInput, buildAgentInputFromState } from './chat/input-builder';
import { extractDelta } from './chat/stream-parser';
import { recomputeDerived } from './chat/state-derivations';
import { mapSessionItemsToChatMessages } from './chat/session-adapter';
import { extractTextFromResult } from './chat/result-extractor';

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
	providerManager: ProviderManager;
	getSettings: () => PluginSettings;
	app: App;
	sessionService: SessionServiceApi;
	eventBus: EventBus;
	workspaceLeaf: WorkspaceLeaf;
}): ChatStore {
	const { agentManager, providerManager, getSettings, sessionService, eventBus } = opts;

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

	const subscribers = new Set<(s: ChatState) => void>();
	const notify = () => subscribers.forEach((fn) => fn(state));

	// --- Throttling mechanism ---
	let throttleTimeout: ReturnType<typeof setTimeout> | null = null;
	const THROTTLE_MS = 50; // Update UI at most every 50ms

	const throttledNotify = () => {
		if (!throttleTimeout) {
			throttleTimeout = setTimeout(() => {
				throttleTimeout = null;
				notify();
			}, THROTTLE_MS);
		}
	};

	const flushThrottledNotify = () => {
		if (throttleTimeout) {
			clearTimeout(throttleTimeout);
			throttleTimeout = null;
		}
		notify();
	};
	// --- End Throttling ---

	function recompute() {
		recomputeDerived({
			state,
			agents: agentManager.listAgents(),
			settings: getSettings(),
			providerManager,
		});
	}

	async function createAgentInstance(): Promise<void> {
		if (!state.selectedAgent) {
			currentAgentInstance = null;
			return;
		}
		try {
			state.isLoading = true;
			notify();
			const parsed = parseModelKey(state.selectedModelKey);
			if (parsed) {
				currentAgentInstance = await agentManager.createAgentInstanceWithModel(
					state.selectedAgent.id,
					parsed.providerId,
					parsed.modelId
				);
			} else {
				currentAgentInstance = await agentManager.createAgentInstance(
					state.selectedAgent.id
				);
			}
		} finally {
			state.isLoading = false;
			recompute();
			notify();
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
			console.warn('Failed to load sessions:', e);
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
	const offAgents = eventBus.on('agentsChanged', () => {
		recompute();
		notify();
	});
	const offProv = eventBus.on('providersUpdated', () => {
		recompute();
		notify();
	});
	const offModels = eventBus.on('modelsUpdated', () => {
		recompute();
		notify();
	});

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
			state.messages = [...state.messages, userMessage];
			state.isLoading = true;
			recompute();
			flushThrottledNotify();

			try {
				// Write user message to session if available
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const maybeSession = await (async () => {
					try {
						return await opts.sessionService.get(state.currentSessionId);
					} catch {
						return null;
					}
				})();
				if (maybeSession) {
					// 标准化：用户消息始终为 input_text 片段数组
					await maybeSession.addItems([
						{
							role: 'user',
							type: 'message',
							content: [{ type: 'input_text', text }],
						} as unknown as AgentItem,
					]);
				}

				const assistant: ChatMessage = {
					id: crypto.randomUUID(),
					role: 'assistant',
					content: '',
					timestamp: Date.now(),
					isStreaming: true,
				};
				state.messages = [...state.messages, assistant];
				flushThrottledNotify();

				// 构建运行输入：优先 session 历史，其次本地 messages 回退
				let inputForRun: AgentInputItem[];
				try {
					const history = maybeSession ? await maybeSession.toAgentInputHistory() : null;
					inputForRun = composeRunInput({
						sessionHistory: history,
						fallbackState: state.messages,
					});
				} catch {
					inputForRun = buildAgentInputFromState(state.messages);
				}

				const stream = await run(currentAgentInstance, inputForRun, { stream: true });
				let accumulated = '';
				const lastIndex = state.messages.length - 1;
				for await (const ev of stream as AsyncIterable<unknown>) {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const delta = extractDelta(ev as any);
					if (delta) {
						accumulated += delta;
						state.messages[lastIndex] = {
							...state.messages[lastIndex],
							content: accumulated,
						};
						throttledNotify();
					}
				}

				// Fallback: if no chunks produced any content, try final output field
				const lastMsg = state.messages[lastIndex];
				if (lastMsg && lastMsg.isStreaming) {
					if (!lastMsg.content || lastMsg.content.length === 0) {
						try {
							// eslint-disable-next-line @typescript-eslint/no-explicit-any
							const fallbackAny = (stream as any)?.finalOutput;
							if (typeof fallbackAny === 'string' && fallbackAny.length > 0) {
								state.messages[lastIndex] = {
									...lastMsg,
									content: fallbackAny,
									isStreaming: false,
								};
							} else {
								state.messages[lastIndex] = {
									...lastMsg,
									content: extractTextFromResult(stream),
									isStreaming: false,
								};
							}
						} catch {
							state.messages[lastIndex] = {
								...lastMsg,
								content: 'No response content available',
								isStreaming: false,
							};
						}
					} else {
						state.messages[lastIndex] = { ...lastMsg, isStreaming: false };
					}
					flushThrottledNotify();
				}

				// Persist assistant message to session
				if (maybeSession) {
					const finalText = state.messages[lastIndex]?.content ?? '';
					const assistantItem: AssistantMessageItem = {
						role: 'assistant',
						type: 'message',
						status: 'completed',
						content: [
							{ type: 'output_text', text: finalText },
						] as unknown as AssistantMessageItem['content'],
					};
					await maybeSession.addItems([assistantItem]);
				}
			} catch (error) {
				// Remove placeholder if present
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
				flushThrottledNotify();
			} finally {
				state.isLoading = false;
				recompute();
				flushThrottledNotify();
			}
		},
		changeAgent(agentId: string) {
			const next = agentManager.listAgents().find((a) => a.id === agentId) ?? null;
			state.selectedAgent = next;
			recompute();
			notify();
			// Recreate agent instance on next tick
			void createAgentInstance();
		},
		changeModel(key: string) {
			state.selectedModelKey = key;
			recompute();
			notify();
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
			recompute();
			notify();
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
					state.messages = mapSessionItemsToChatMessages(items);
				} else {
					await createSessionInternal();
					state.messages = [];
				}
			} catch (e) {
				console.warn('Failed to switch session:', e);
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
				console.warn('Failed to delete session:', e);
			}
			await refreshSessionList();
			recompute();
			notify();
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

	// Initialize async without blocking subscribe
	void init();

	const store: ChatStore = {
		subscribe(runSub) {
			subscribers.add(runSub);
			// Push current state immediately
			runSub(state);
			return () => {
				subscribers.delete(runSub);
			};
		},
		actions,
	};

	return store;
}
