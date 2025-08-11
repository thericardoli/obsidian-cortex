import { run } from "@openai/agents";
import type { Agent } from "@openai/agents";
import type { RunStreamEvent } from "@openai/agents-core";
import type { Readable } from "svelte/store";
import type { App, WorkspaceLeaf } from "obsidian";

import type { AgentManager } from "../../agent/agent-manager";
import type { ProviderManager } from "../../providers/provider-manager";
import type { PluginSettings } from "../../types";
import type { AgentConfig } from "../../types/agent";
import type { SessionServiceApi } from "../../services/session-service";
import type { EventBus } from "../../services/event-bus";
import type { AgentInputItem } from "../../types/session";
import type { AgentItem, UserMessageItem, AssistantMessageItem } from "../../types/session";
import { toProviderDescriptor, isRuntimeEnabled } from "../../utils/provider-runtime";

export interface ChatMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: number;
    isStreaming?: boolean;
}

export interface ModelGroupItem { key: string; label: string; modelId: string }
export interface ModelGroup { providerId: string; providerName: string; items: ModelGroupItem[] }

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

function buildGroupedModels(settings: PluginSettings, providerManager: ProviderManager): ModelGroup[] {
    const presentProviderIds = new Set(providerManager.getAllProviders().map((p) => p.getId()));
    const groups: ModelGroup[] = [];
    for (const p of settings.providers) {
        if (!presentProviderIds.has(p.id) || !isRuntimeEnabled(p)) continue;
        const descriptor = toProviderDescriptor(p);
        const items: ModelGroupItem[] = descriptor.models.map((m) => ({
            key: `${p.id}::${m.modelId}`,
            label: m.displayName,
            modelId: m.modelId,
        }));
        groups.push({ providerId: p.id, providerName: p.name, items });
    }
    return groups;
}

function extractTextFromResult(result: unknown): string {
    if (typeof result === "string") return result;
    if (result && typeof result === "object") {
        const r = result as Record<string, unknown>;
        if (typeof r["finalOutput"] === "string") return r["finalOutput"] as string;
        const content = r["content"];
        if (typeof content === "string") return content;
        if (Array.isArray(content)) {
            const texts = content
                .filter((item) => !!item && typeof item === "object")
                .map((item) => (item as { type?: unknown; text?: unknown }))
                .filter((it) => it.type === "text" || it.type === "output_text")
                .map((it) => (typeof it.text === "string" ? it.text : ""));
            if (texts.length > 0) return texts.join("");
        }
        if (typeof r["text"] === "string") return r["text"] as string;
        if (typeof r["message"] === "string") return r["message"] as string;
    }
    return "No response content available";
}

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
        selectedModelKey: "",
        isLoading: false,
        currentSessionId: "",
        sessionList: [],
        availableAgents: [],
        modelGroups: [],
        canSend: false,
    };

    let currentAgentInstance: Agent | null = null;
    let disposed = false;

    const subscribers = new Set<(s: ChatState) => void>();
    const notify = () => subscribers.forEach((fn) => fn(state));

    function recomputeDerived() {
        state.availableAgents = agentManager.listAgents();
        // Default selections
        if (!state.selectedAgent && state.availableAgents.length > 0) {
            state.selectedAgent = state.availableAgents[0];
        } else if (state.selectedAgent) {
            const match = state.availableAgents.find((a) => a.id === state.selectedAgent?.id);
            state.selectedAgent = match ?? state.availableAgents[0] ?? null;
        }
        state.modelGroups = buildGroupedModels(getSettings(), providerManager);
        if (!state.selectedModelKey) {
            const first = state.modelGroups.find((g) => g.items.length > 0)?.items[0];
            state.selectedModelKey = first ? first.key : "";
        } else {
            const keys = new Set<string>();
            for (const g of state.modelGroups) for (const it of g.items) keys.add(it.key);
            if (!keys.has(state.selectedModelKey)) {
                const first = state.modelGroups.find((g) => g.items.length > 0)?.items[0];
                state.selectedModelKey = first ? first.key : "";
            }
        }
        state.canSend = state.selectedAgent !== null && state.selectedModelKey !== "" && !state.isLoading;
    }

    async function createAgentInstance(): Promise<void> {
        if (!state.selectedAgent) { currentAgentInstance = null; return; }
        try {
            state.isLoading = true; notify();
            if (state.selectedModelKey.includes("::")) {
                const [providerId, modelId] = state.selectedModelKey.split("::");
                currentAgentInstance = await agentManager.createAgentInstanceWithModel(state.selectedAgent.id, providerId, modelId);
            } else {
                currentAgentInstance = await agentManager.createAgentInstance(state.selectedAgent.id);
            }
        } finally {
            state.isLoading = false; recomputeDerived(); notify();
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
            console.warn("Failed to load sessions:", e);
            state.sessionList = [];
        }
    }

    async function init(): Promise<void> {
        recomputeDerived();
        await createSessionInternal();
        await refreshSessionList();
        await createAgentInstance();
        notify();
    }

    // Subscriptions to external events
    const offAgents = agentManager.subscribeAgentsChange(() => { recomputeDerived(); notify(); });
    const offProv = eventBus.on('providersUpdated', () => { recomputeDerived(); notify(); });
    const offModels = eventBus.on('modelsUpdated', () => { recomputeDerived(); notify(); });

    // Public actions
    const actions: ChatActions = {
        async sendMessage(text: string) {
            if (!state.canSend || !currentAgentInstance || !state.selectedAgent) return;
            const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text, timestamp: Date.now() };
            state.messages = [...state.messages, userMessage];
            state.isLoading = true; recomputeDerived(); notify();

            try {
                // Write user message to session if available
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const maybeSession = await (async () => {
                    try { return await (opts.sessionService.get(state.currentSessionId)); } catch { return null; }
                })();
                if (maybeSession) {
                    // 标准化：用户消息始终为 input_text 片段数组
                    await maybeSession.addItems([
                        { role: 'user', type: 'message', content: [{ type: 'input_text', text }] } as unknown as AgentItem,
                    ]);
                }

                const assistant: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', content: '', timestamp: Date.now(), isStreaming: true };
                state.messages = [...state.messages, assistant]; notify();

                // 构建运行输入：优先 session 历史，其次本地 messages 回退
                let inputForRun: AgentInputItem[];
                const buildFromState = (): AgentInputItem[] => {
                    return state.messages
                        .filter(m => !m.isStreaming) // 排除尚未完成的流式占位
                        .map(m => {
                            if (m.role === 'user') {
                                return { type: 'message', role: 'user', content: [{ type: 'input_text', text: m.content }] } as unknown as AgentInputItem;
                            }
                            return { type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: m.content }] } as unknown as AgentInputItem;
                        });
                };
                try {
                    if (maybeSession) {
                        inputForRun = await maybeSession.toAgentInputHistory();
                        // 如果 session 为空（首次）则追加当前用户消息
                        if (!inputForRun.some(it => (it as { role?: string }).role === 'user' && (it as { content?: unknown }).content)) {
                            inputForRun = buildFromState();
                        }
                    } else {
                        inputForRun = buildFromState();
                    }
                } catch {
                    inputForRun = buildFromState();
                }

                const stream = await run(currentAgentInstance, inputForRun, { stream: true });
                let accumulated = "";

                const lastIndex = state.messages.length - 1;
                // Consume async events
                for await (const ev of stream as AsyncIterable<RunStreamEvent>) {
                    if (ev.type === 'raw_model_stream_event') {
                        const d = ev.data as { type?: unknown; delta?: unknown; event?: { type?: unknown; delta?: unknown } };
                        if (d.type === 'output_text_delta' && typeof d.delta === 'string') {
                            accumulated += d.delta;
                        } else if (d.event && typeof d.event.delta === 'string') {
                            const t = d.event.type;
                            if (t === 'response.output_text.delta' || t === 'output_text.delta' || t === 'output_text_delta') {
                                accumulated += d.event.delta as string;
                            }
                        }
                        state.messages[lastIndex] = { ...state.messages[lastIndex], content: accumulated };
                        notify();
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
                                state.messages[lastIndex] = { ...lastMsg, content: fallbackAny, isStreaming: false };
                            } else {
                                state.messages[lastIndex] = { ...lastMsg, content: extractTextFromResult(stream), isStreaming: false };
                            }
                        } catch {
                            state.messages[lastIndex] = { ...lastMsg, content: 'No response content available', isStreaming: false };
                        }
                    } else {
                        state.messages[lastIndex] = { ...lastMsg, isStreaming: false };
                    }
                    notify();
                }

                // Persist assistant message to session
                if (maybeSession) {
                    const finalText = state.messages[lastIndex]?.content ?? "";
                    const assistantItem: AssistantMessageItem = {
                        role: 'assistant',
                        type: 'message',
                        status: 'completed',
                        content: [ { type: 'output_text', text: finalText } ] as unknown as AssistantMessageItem['content']
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
                state.messages = [...state.messages, { id: crypto.randomUUID(), role: 'assistant', content: `Error: ${msg}`, timestamp: Date.now() }];
                notify();
            } finally {
                state.isLoading = false; recomputeDerived(); notify();
            }
        },
        changeAgent(agentId: string) {
            const next = agentManager.listAgents().find((a) => a.id === agentId) ?? null;
            state.selectedAgent = next; recomputeDerived(); notify();
            // Recreate agent instance on next tick
            void createAgentInstance();
        },
        changeModel(key: string) {
            state.selectedModelKey = key; recomputeDerived(); notify();
            void createAgentInstance();
        },
        async createSession() {
            // End current to force save
            if (state.currentSessionId) {
                try {
                    const s = await opts.sessionService.get(state.currentSessionId);
                    await s?.dispose();
                } catch { /* ignore dispose errors */ }
            }
            await createSessionInternal();
            state.messages = [];
            await refreshSessionList();
            // 将新 session 放到列表顶部（如果不在的话）
            if (state.currentSessionId) {
                const rest = state.sessionList.filter(s => s.id !== state.currentSessionId);
                state.sessionList = [{ id: state.currentSessionId }, ...rest];
            }
            recomputeDerived();
            notify();
        },
        async selectSession(id: string) {
            if (!id || id === state.currentSessionId) return;
            try { const s = await opts.sessionService.get(state.currentSessionId); await s?.dispose(); } catch { /* ignore dispose errors */ }
            try {
                const target = await opts.sessionService.get(id);
                if (target) {
                    state.currentSessionId = id;
                const items = await target.getItems();
                const isUser = (x: AgentItem): x is UserMessageItem => (x as { role?: unknown }).role === 'user';
                const isAssistant = (x: AgentItem): x is AssistantMessageItem => (x as { role?: unknown }).role === 'assistant';
                const mapped: ChatMessage[] = items
                    .filter((it): it is UserMessageItem | AssistantMessageItem => isUser(it) || isAssistant(it))
                    .map((it) => ({
                        id: crypto.randomUUID(),
                        role: it.role,
                        content: typeof it.content === 'string' ? it.content : Array.isArray(it.content) ? (it.content as Array<{ text?: string }>).map((p) => p.text ?? '').join('') : '',
                        timestamp: Date.now(),
                    }));
                state.messages = mapped;
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
            recomputeDerived();
            notify();
        },
        async dispose() {
            if (disposed) return;
            disposed = true;
            try { const s = await opts.sessionService.get(state.currentSessionId); await s?.dispose(); } catch { /* ignore dispose errors */ }
            offAgents?.(); offProv?.(); offModels?.();
        }
    };

    // Initialize async without blocking subscribe
    void init();

    const store: ChatStore = {
        subscribe(runSub) {
            subscribers.add(runSub);
            // Push current state immediately
            runSub(state);
            return () => { subscribers.delete(runSub); };
        },
        actions,
    };

    return store;
}
