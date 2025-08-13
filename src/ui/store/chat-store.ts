import { run } from '@openai/agents';
import type { Agent } from '@openai/agents';
import type { RunStreamEvent } from '@openai/agents-core';
import type { Readable } from 'svelte/store';
import type { App, WorkspaceLeaf } from 'obsidian';

import type { AgentManager } from '../../agent/agent-manager';
import type { ProviderManager } from '../../providers/provider-manager';
import type { PluginSettings } from '../../types';
import type { AgentConfig } from '../../types/agent';
import type { SessionServiceApi } from '../../services/session-service';
import type { EventBus } from '../../services/event-bus';
import type {
	AgentInputItem,
	AgentItem,
	AssistantMessageItem,
	ISession,
} from '../../types/session';
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
	let streamRenderInterval: number | null = null; // For smooth streaming

	const subscribers = new Set<(s: ChatState) => void>();
	const notify = () => subscribers.forEach((fn) => fn(state));

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

			// Stop any previous rendering
			if (streamRenderInterval) {
				clearInterval(streamRenderInterval);
				streamRenderInterval = null;
			}

			const userMessage: ChatMessage = {
				id: crypto.randomUUID(),
				role: 'user',
				content: text,
				timestamp: Date.now(),
			};
			state.messages = [...state.messages, userMessage];
			state.isLoading = true;
			recompute();
			notify();

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
				let streamBuffer = '';
				let isStreamFetchingComplete = false;
				let maybeSession: ISession | null = null;

				try {
					maybeSession = await (async () => {
						try {
							return await opts.sessionService.get(state.currentSessionId);
						} catch {
							return null;
						}
					})();

					if (maybeSession) {
						const userItem: AgentItem = {
							role: 'user',
							type: 'message',
							content: [{ type: 'input_text', text }],
						};
						await maybeSession.addItems([userItem]);
					}

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

					// The run(stream:true) returns an async iterable of RunStreamEvent (augmented with a finalOutput maybe)
					type RunStream = AsyncIterable<RunStreamEvent> & { finalOutput?: string };
					const agentRef = currentAgentInstance; // local copy for type narrowing
					if (!agentRef) throw new Error('Agent instance disposed');
					const stream = (await run(agentRef, inputForRun, { stream: true })) as RunStream;

					const streamReader = async () => {
						for await (const ev of stream) {
							const delta = extractDelta(ev);
							if (delta) streamBuffer += delta;
						}
						isStreamFetchingComplete = true;
					};
					streamReader().catch((e) => {
						console.error('Stream reading failed:', e);
						isStreamFetchingComplete = true;
					});

					streamRenderInterval = window.setInterval(() => {
						const isRenderingFinished =
							isStreamFetchingComplete && streamBuffer.length === 0;

						if (streamBuffer.length > 0) {
							const chunkSize = 2; // Render 2 chars per interval for smooth typing
							const chunk = streamBuffer.slice(0, chunkSize);
							streamBuffer = streamBuffer.slice(chunkSize);

							state.messages[lastIndex].content += chunk;
							notify();
						}

						if (isRenderingFinished) {
							if (streamRenderInterval !== null) {
								clearInterval(streamRenderInterval);
							}
							streamRenderInterval = null;

							const lastMsg = state.messages[lastIndex];

							if (!lastMsg.content || lastMsg.content.length === 0) {
								try {
									const fallbackOutput = stream.finalOutput;
									if (typeof fallbackOutput === 'string' && fallbackOutput.length > 0) {
										lastMsg.content = fallbackOutput;
									} else {
										lastMsg.content = extractTextFromResult(stream);
									}
								} catch {
									lastMsg.content = 'No response content available';
								}
							}

							lastMsg.isStreaming = false;

							if (maybeSession) {
								const finalText = lastMsg.content ?? '';
								const assistantItem: AssistantMessageItem = {
									role: 'assistant',
									type: 'message',
									status: 'completed',
									content: [{ type: 'output_text', text: finalText }],
								};
								maybeSession.addItems([assistantItem]);
							}

							state.isLoading = false;
							recompute();
							notify();
						}
					}, 15); // 15ms interval
				} catch (error) {
					if (streamRenderInterval) clearInterval(streamRenderInterval);

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

					state.isLoading = false;
					recompute();
					notify();
				}
			};

			executeStreaming();
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
