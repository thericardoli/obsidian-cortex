<script lang="ts">
    import { Agent } from '@openai/agents';
    import { onMount } from 'svelte';

    import { cn } from '$lib/utils';

    import { AgentRegistry } from '../../core/agent-registry';
    import { createModel, parseModelSelection } from '../../core/model-registry';
    import { loadAgentConfigs } from '../../core/persistence/agent-store';
    import { RunnerService } from '../../core/runner-service';
    import { type Session, sessionManager } from '../../core/session-manager';
    import { ToolRegistry } from '../../core/tool-registry';
    import {
        BUILTIN_PROVIDERS,
        DEFAULT_AGENT_CONFIGS,
        DEFAULT_SETTINGS,
    } from '../../settings/settings';
    import { createSettingsStore } from '../../settings/settings-store';

    import ChatHeader from './ChatHeader.svelte';
    import ChatInputBar from './ChatInputBar.svelte';
    import HistoryPanel from './HistoryPanel.svelte';
    import MessageList from './MessageList.svelte';

    import type CortexPlugin from '../../../main';
    import type { ChatSessionRecord } from '../../core/persistence/database';
    import type { CortexSettings } from '../../settings/settings';
    import type { AgentConfig } from '../../types/agent';
    import type { AgentInputItem } from '@openai/agents-core';
    import type { ChatStatus, PromptInputMessage } from '$lib/components/ai-elements/prompt-input';

    interface Props {
        plugin: CortexPlugin;
        isDarkMode?: boolean;
    }

    const runnerService = new RunnerService();

    interface ChatMessage {
        id: string;
        role: 'user' | 'assistant';
        content: string;
        timestamp: Date;
    }

    let { plugin, isDarkMode = false }: Props = $props();
    let toolRegistry: ToolRegistry;
    let messages = $state<ChatMessage[]>([]);
    let chatStatus = $state<ChatStatus>('idle');
    let streamingText = $state('');
    let messagesContainer = $state<HTMLDivElement | null>(null);
    let settings = $state<CortexSettings>(DEFAULT_SETTINGS);
    let selectedAgentId = $state('');
    let selectedModel = $state('');
    let availableAgents = $state<AgentConfig[]>([]);
    let availableSessions = $state<ChatSessionRecord[]>([]);
    let activeSessionId = $state('');
    let session = $state<Session | null>(null);
    let isHistoryOpen = $state(false);
    let isLoadingSession = $state(true);
    let sessionPage = $state(1);
    const sessionsPerPage = 6;

    const selectedAgent = $derived.by(() =>
        availableAgents.find((agent) => agent.id === selectedAgentId)
    );

    const selectedAgentName = $derived.by(
        () => selectedAgent?.name || availableAgents[0]?.name || '选择 Agent'
    );

    const sessionTitle = $derived.by(() => {
        const record = availableSessions.find((item) => item.id === activeSessionId);
        return record?.title || 'Session';
    });

    const sessionPageTotal = $derived.by(() =>
        Math.max(1, Math.ceil(availableSessions.length / sessionsPerPage))
    );

    const visibleSessions = $derived.by(() => {
        const start = (sessionPage - 1) * sessionsPerPage;
        return availableSessions.slice(start, start + sessionsPerPage);
    });

    function getAgentPreferredModel(agent?: AgentConfig | null): string | undefined {
        if (!agent) return undefined;
        return agent.defaultModelId || agent.modelId;
    }

    $effect(() => {
        void availableAgents;
        if (!availableAgents.length) {
            selectedAgentId = '';
            return;
        }

        const nextActive =
            availableAgents.find((agent) => agent.id === selectedAgentId && agent.enabled) ??
            availableAgents.find((agent) => agent.enabled) ??
            availableAgents[0];

        if (nextActive && nextActive.id !== selectedAgentId) {
            selectedAgentId = nextActive.id;
        }
    });

    let lastSyncedAgentId = '';
    let lastSyncedAgentModelId = '';

    $effect(() => {
        const agentModelId = getAgentPreferredModel(selectedAgent);
        if (!selectedAgent || !agentModelId) {
            return;
        }

        const agentChanged = selectedAgent.id !== lastSyncedAgentId;
        const modelChanged = agentModelId !== lastSyncedAgentModelId;

        if (agentChanged || modelChanged) {
            if (selectedModel !== agentModelId) {
                selectedModel = agentModelId;
            }
            lastSyncedAgentId = selectedAgent.id;
            lastSyncedAgentModelId = agentModelId;
        }
    });

    $effect(() => {
        void settings;
        const selectionExists = groupedModels.some((group) =>
            group.models.some((model) => model.id === selectedModel)
        );

        if (!selectionExists) {
            const nextModel = resolveDefaultModelSelection();
            if (selectedModel !== nextModel) {
                selectedModel = nextModel;
            }
        }
    });

    function resolveDefaultModelSelection(): string {
        const providers = settings.providers;
        const activeProviderId = settings.activeProviderId;
        const activeProvider = providers?.[activeProviderId];

        if (activeProvider?.apiKey && activeProvider.models?.length > 0) {
            const firstModel = activeProvider.models[0];
            return `${activeProviderId}:${firstModel.modelID}`;
        }

        for (const [providerId, providerSettings] of Object.entries(providers || {})) {
            if (providerSettings.apiKey && providerSettings.models?.length) {
                return `${providerId}:${providerSettings.models[0].modelID}`;
            }
        }

        return '';
    }

    const groupedModels = $derived.by(() => {
        const groups: {
            providerId: string;
            providerLabel: string;
            models: { id: string; name: string }[];
        }[] = [];
        const providers = settings.providers;

        for (const [providerId, providerSettings] of Object.entries(providers)) {
            if (providerSettings.apiKey && providerSettings.models.length > 0) {
                const providerInfo =
                    BUILTIN_PROVIDERS[providerId as keyof typeof BUILTIN_PROVIDERS];
                groups.push({
                    providerId,
                    providerLabel: providerInfo?.label || providerId,
                    models: providerSettings.models.map((model) => ({
                        id: `${providerId}:${model.modelID}`,
                        name: model.name,
                    })),
                });
            }
        }

        return groups;
    });

    const selectedModelName = $derived.by(() => {
        for (const group of groupedModels) {
            const model = group.models.find((m) => m.id === selectedModel);
            if (model) return model.name;
        }
        return selectedModel;
    });

    onMount(() => {
        const settingsStore = createSettingsStore(plugin.app, () => plugin.settings);
        let initialized = false;
        const unsubscribe = settingsStore.subscribe(({ settings: nextSettings }) => {
            settings = { ...nextSettings };
            if (initialized) {
                void refreshAgents();
            } else {
                initialized = true;
            }
        });

        void (async () => {
            await refreshAgents();
            await bootstrapSessions();
        })();

        return () => {
            unsubscribe();
        };
    });

    $effect(() => {
        toolRegistry = new ToolRegistry(plugin.app);
    });

    function generateId(): string {
        return crypto.randomUUID();
    }

    function scrollToBottom(): void {
        if (messagesContainer) {
            setTimeout(() => {
                messagesContainer?.scrollTo({
                    top: messagesContainer.scrollHeight,
                    behavior: 'smooth',
                });
            }, 80);
        }
    }

    async function refreshAgents(): Promise<void> {
        const loaded = await loadAgentConfigs(DEFAULT_AGENT_CONFIGS);
        availableAgents = loaded;

        const nextActive =
            loaded.find((agent) => agent.id === selectedAgentId && agent.enabled) ??
            loaded.find((agent) => agent.enabled) ??
            loaded[0];

        if (nextActive && nextActive.id !== selectedAgentId) {
            selectedAgentId = nextActive.id;
        }
    }

    function handleModelChange(value: string | undefined): void {
        if (value) {
            selectedModel = value;
        }
    }

    function handleAgentChange(value: string | undefined): void {
        if (!value) return;
        selectedAgentId = value;

        const nextAgent = availableAgents.find((agent) => agent.id === value);
        const nextModelId = getAgentPreferredModel(nextAgent);

        if (nextModelId && nextModelId !== selectedModel) {
            selectedModel = nextModelId;
            lastSyncedAgentId = value;
            lastSyncedAgentModelId = nextModelId;
        }
        if (activeSessionId) {
            void sessionManager.getOrCreate(activeSessionId, value);
            void refreshSessions();
        }
    }

    function resolveModelForAgent(agent: AgentConfig, fallbackModelId?: string) {
        const modelId =
            fallbackModelId ||
            agent.defaultModelId ||
            agent.modelId ||
            resolveDefaultModelSelection();

        if (!modelId) {
            throw new Error('请先在设置里添加至少一个模型，并在聊天输入栏选择模型');
        }

        const modelConfig = parseModelSelection(modelId, settings);

        if (!modelConfig) {
            throw new Error(`请先配置 ${modelId.split(':')[0] || 'openai'} 的 API Key`);
        }

        return createModel(modelConfig);
    }

    async function bootstrapSessions(): Promise<void> {
        if (!availableAgents.length) {
            isLoadingSession = false;
            return;
        }
        await refreshSessions();
        if (availableSessions.length > 0) {
            await switchSession(availableSessions[0].id);
        } else {
            await createSession();
        }
        isLoadingSession = false;
    }

    async function refreshSessions(): Promise<void> {
        availableSessions = await sessionManager.list();
        if (sessionPage > sessionPageTotal) {
            sessionPage = sessionPageTotal;
        }
    }

    async function createSession(options: { openHistory?: boolean } = {}): Promise<void> {
        const activeAgent = resolveActiveAgent();
        const title = `Session ${availableSessions.length + 1}`;
        const { sessionId: newId, session: newSession } = await sessionManager.createNew(
            activeAgent.id,
            title
        );
        activeSessionId = newId;
        session = newSession;
        await refreshSessions();
        sessionPage = 1;
        await loadMessagesFromSession(newId);
        isHistoryOpen = options.openHistory ?? false;
    }

    async function ensureActiveSession(): Promise<Session> {
        if (session && activeSessionId) {
            return session;
        }
        const activeAgent = resolveActiveAgent();
        const { session: created, sessionId } = await sessionManager.createNew(activeAgent.id);
        activeSessionId = sessionId;
        session = created;
        await refreshSessions();
        return created;
    }

    async function switchSession(sessionId: string): Promise<void> {
        const nextSession = await sessionManager.getOrCreate(sessionId, selectedAgentId);
        activeSessionId = sessionId;
        session = nextSession;
        const index = availableSessions.findIndex((s) => s.id === sessionId);
        if (index >= 0) {
            sessionPage = Math.floor(index / sessionsPerPage) + 1;
        }
        await loadMessagesFromSession(sessionId);
        isHistoryOpen = false;
    }

    async function loadMessagesFromSession(sessionId: string): Promise<void> {
        const history = await sessionManager.loadHistory(sessionId);
        messages = mapHistoryToMessages(history);
        streamingText = '';
        chatStatus = 'idle';
        scrollToBottom();
    }

    async function removeSession(sessionId: string): Promise<void> {
        await sessionManager.delete(sessionId);
        if (activeSessionId === sessionId) {
            activeSessionId = '';
            session = null;
            messages = [];
            streamingText = '';
        }
        await refreshSessions();
        if (!activeSessionId && availableSessions[0]) {
            await switchSession(availableSessions[0].id);
        }
    }

    function extractText(content: unknown): string {
        if (typeof content === 'string') return content;
        if (Array.isArray(content)) {
            return content
                .map((item) => {
                    if (typeof item === 'string') return item;
                    if (item && typeof item === 'object') {
                        if (
                            'text' in item &&
                            typeof (item as { text?: unknown }).text === 'string'
                        ) {
                            return (item as { text: string }).text;
                        }
                        if (
                            'refusal' in item &&
                            typeof (item as { refusal?: unknown }).refusal === 'string'
                        ) {
                            return (item as { refusal: string }).refusal;
                        }
                        if (
                            'transcript' in item &&
                            typeof (item as { transcript?: unknown }).transcript === 'string'
                        ) {
                            return (item as { transcript: string }).transcript;
                        }
                    }
                    return '';
                })
                .filter(Boolean)
                .join('\n');
        }
        return '';
    }

    function mapHistoryToMessages(items: AgentInputItem[]): ChatMessage[] {
        return items
            .map((item, index) => {
                if (!('role' in item)) return null;
                if (item.role === 'user') {
                    const content = extractText((item as { content: unknown }).content);
                    if (!content) return null;
                    return {
                        id: `${item.role}-${index}-${crypto.randomUUID()}`,
                        role: 'user' as const,
                        content,
                        timestamp: new Date(),
                    };
                }
                if (item.role === 'assistant') {
                    const content = extractText((item as { content: unknown }).content);
                    if (!content) return null;
                    return {
                        id: `${item.role}-${index}-${crypto.randomUUID()}`,
                        role: 'assistant' as const,
                        content,
                        timestamp: new Date(),
                    };
                }
                return null;
            })
            .filter(Boolean) as ChatMessage[];
    }

    function formatUpdatedAt(timestamp: number): string {
        const value = new Date(timestamp);
        return `${value.toLocaleDateString()} ${value.toLocaleTimeString()}`;
    }

    function openHistory(): void {
        if (activeSessionId) {
            const index = availableSessions.findIndex((s) => s.id === activeSessionId);
            if (index >= 0) {
                sessionPage = Math.floor(index / sessionsPerPage) + 1;
            }
        }
        isHistoryOpen = true;
    }

    function goPrevPage(): void {
        if (sessionPage > 1) {
            sessionPage -= 1;
        }
    }

    function goNextPage(): void {
        if (sessionPage < sessionPageTotal) {
            sessionPage += 1;
        }
    }

    async function handleSubmit(message: PromptInputMessage, _event: SubmitEvent): Promise<void> {
        const text = message.text?.trim();
        if (!text) return;

        const activeAgent = resolveActiveAgent();
        const activeSession = await ensureActiveSession();

        const userMessage: ChatMessage = {
            id: generateId(),
            role: 'user',
            content: text,
            timestamp: new Date(),
        };
        messages = [...messages, userMessage];
        scrollToBottom();

        chatStatus = 'submitted';
        streamingText = '';

        try {
            chatStatus = 'streaming';
            const agent = createAgent(activeAgent);

            await runnerService.runStreamed(
                agent,
                text,
                {
                    onTextDelta: (delta) => {
                        streamingText += delta;
                        scrollToBottom();
                    },
                    onAgentSwitch: (newAgent) => {
                        console.log('Agent switched to:', newAgent.name);
                    },
                    onToolCall: (info) => {
                        console.log('Tool call:', info);
                    },
                },
                { session: activeSession }
            );

            const assistantMessage: ChatMessage = {
                id: generateId(),
                role: 'assistant',
                content: runnerService.streamingText,
                timestamp: new Date(),
            };
            messages = [...messages, assistantMessage];
            streamingText = '';
            chatStatus = 'idle';
            scrollToBottom();
        } catch (error) {
            console.error('Chat error:', error);
            chatStatus = 'error';

            const errorMessage: ChatMessage = {
                id: generateId(),
                role: 'assistant',
                content: `抱歉，发生了错误：${error instanceof Error ? error.message : '未知错误'}`,
                timestamp: new Date(),
            };
            messages = [...messages, errorMessage];
            streamingText = '';
            chatStatus = 'idle';
        }
    }

    function resolveActiveAgent(): AgentConfig {
        const agent =
            availableAgents.find((item) => item.id === selectedAgentId && item.enabled) ??
            availableAgents.find((item) => item.enabled) ??
            availableAgents[0];

        if (!agent) {
            throw new Error('请先在 Agent 配置页创建并启用一个 Agent');
        }

        return agent;
    }

    function createAgent(activeAgent?: AgentConfig): Agent {
        const agentConfigs = availableAgents;
        const resolvedAgent = activeAgent ?? resolveActiveAgent();
        const registry = new AgentRegistry(toolRegistry, agentConfigs);

        return registry.buildAgent(resolvedAgent.id, {
            resolveModel: (config) => {
                const modelId =
                    config.id === resolvedAgent.id
                        ? selectedModel || getAgentPreferredModel(config) || undefined
                        : config.defaultModelId || config.modelId || selectedModel || undefined;

                return resolveModelForAgent(config, modelId);
            },
        });
    }
</script>

<div
    class={cn(
        'cortex-chat-view flex h-full min-h-0 flex-col bg-[var(--background-primary)] text-[var(--text-normal)]',
        isDarkMode ? 'dark' : ''
    )}
>
    <ChatHeader
        title={sessionTitle}
        isLoading={isLoadingSession}
        onCreate={() => createSession()}
        onOpenHistory={openHistory}
    />

    <div class="relative min-h-0 flex-1">
        <HistoryPanel
            isOpen={isHistoryOpen}
            sessions={visibleSessions}
            {activeSessionId}
            page={sessionPage}
            totalPages={sessionPageTotal}
            totalCount={availableSessions.length}
            {formatUpdatedAt}
            onClose={() => (isHistoryOpen = false)}
            onSelect={switchSession}
            onDelete={removeSession}
            onPrev={goPrevPage}
            onNext={goNextPage}
        />

        <div class="flex h-full min-h-0 flex-col">
            <MessageList
                bind:container={messagesContainer}
                {messages}
                {streamingText}
                {chatStatus}
                {isDarkMode}
                isLoading={isLoadingSession}
            />

            <ChatInputBar
                onSubmit={handleSubmit}
                onAgentChange={handleAgentChange}
                onModelChange={handleModelChange}
                {chatStatus}
                {selectedAgentId}
                {selectedAgentName}
                {selectedModel}
                {selectedModelName}
                {availableAgents}
                {groupedModels}
            />
        </div>
    </div>
</div>
