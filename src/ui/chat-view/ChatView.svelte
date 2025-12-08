<script lang="ts">
    import type { EventRef } from 'obsidian';
    import { onMount } from 'svelte';
    import type CortexPlugin from '../../../main';
    import { cn } from '$lib/utils';
    import {
        PromptInput,
        PromptInputBody,
        PromptInputTextarea,
        PromptInputToolbar,
        PromptInputSubmit,
        PromptInputModelSelect,
        PromptInputModelSelectTrigger,
        PromptInputModelSelectContent,
        PromptInputModelSelectItem,
        PromptInputModelSelectValue,
        PromptInputModelSelectGroup,
        PromptInputModelSelectGroupHeading,
    } from '$lib/components/ai-elements/prompt-input';
    import { Message, MessageContent } from '$lib/components/ai-elements/message';
    import { Response } from '$lib/components/ai-elements/response';
    import type { PromptInputMessage, ChatStatus } from '$lib/components/ai-elements/prompt-input';
    import { sessionManager } from '../../core/session-manager';
    import { RunnerService } from '../../core/runner-service';
    import { parseModelSelection, createModel } from '../../core/model-registry';
    import { Agent } from '@openai/agents';
    import { BUILTIN_PROVIDERS, SETTINGS_UPDATED_EVENT } from '../../settings/settings';
    import { AgentRegistry } from '../../core/agent-registry';
    import { ToolRegistry } from '../../core/tool-registry';
    import type { AgentConfig } from '../../types/agent';

    interface Props {
        plugin: CortexPlugin;
        isDarkMode?: boolean;
    }

    let { plugin, isDarkMode = false }: Props = $props();
    let toolRegistry: ToolRegistry;

    // 消息列表状态
    interface ChatMessage {
        id: string;
        role: 'user' | 'assistant';
        content: string;
        timestamp: Date;
    }

    let messages = $state<ChatMessage[]>([]);
    let chatStatus = $state<ChatStatus>('idle');
    let streamingText = $state('');
    let messagesContainer = $state<HTMLDivElement | null>(null);
    let settingsVersion = $state(0);
    let settingsEventRef: EventRef | null = null;
    let selectedAgentId = $state('');

    // 模型选择状态 - 使用默认值初始化
    let selectedModel = $state('gpt-4.1-mini');

    const availableAgents = $derived.by(() => {
        void settingsVersion;
        return plugin.settings.agentConfigs ?? [];
    });

    const selectedAgent = $derived.by(() =>
        availableAgents.find((agent) => agent.id === selectedAgentId)
    );

    const selectedAgentName = $derived.by(
        () => selectedAgent?.name || availableAgents[0]?.name || '选择 Agent'
    );

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
        const agentModelId = selectedAgent?.modelId;
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

    function resolveDefaultModelSelection(): string {
        const providers = plugin.settings.providers;
        const activeProviderId = plugin.settings.activeProviderId;
        const activeProvider = providers?.[activeProviderId];

        if (activeProvider?.apiKey && activeProvider.models?.length > 0) {
            const firstModel = activeProvider.models[0];
            return `${activeProviderId}:${firstModel.modelName}`;
        }

        for (const [providerId, providerSettings] of Object.entries(providers || {})) {
            if (providerSettings.apiKey && providerSettings.models?.length) {
                return `${providerId}:${providerSettings.models[0].modelName}`;
            }
        }

        return 'gpt-4.1-mini';
    }

    // 获取可用的模型列表，按 Provider 分组
    const groupedModels = $derived.by(() => {
        void settingsVersion;
        const groups: {
            providerId: string;
            providerLabel: string;
            models: { id: string; name: string }[];
        }[] = [];
        const providers = plugin.settings.providers;

        for (const [providerId, providerSettings] of Object.entries(providers)) {
            if (providerSettings.apiKey && providerSettings.models.length > 0) {
                const providerInfo =
                    BUILTIN_PROVIDERS[providerId as keyof typeof BUILTIN_PROVIDERS];
                groups.push({
                    providerId,
                    providerLabel: providerInfo?.label || providerId,
                    models: providerSettings.models.map((model) => ({
                        id: `${providerId}:${model.modelName}`,
                        name: model.name,
                    })),
                });
            }
        }

        // 如果没有配置任何模型，返回默认组
        if (groups.length === 0) {
            groups.push({
                providerId: 'openai',
                providerLabel: 'OpenAI',
                models: [
                    {
                        id: 'gpt-4.1-mini',
                        name: 'GPT-4.1 Mini',
                    },
                ],
            });
        }

        return groups;
    });

    // 获取当前选中模型的显示名称
    const selectedModelName = $derived.by(() => {
        for (const group of groupedModels) {
            const model = group.models.find((m) => m.id === selectedModel);
            if (model) return model.name;
        }
        return selectedModel;
    });

    // 当设置更新时，如果当前选择的模型已不存在，则重置为默认可用模型
    $effect(() => {
        void settingsVersion;
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

    // Session 管理 - 每个 ChatView 实例有独立的 session
    const sessionId = crypto.randomUUID();
    const session = $derived(sessionManager.getOrCreate(sessionId));

    // 初始化 RunnerService
    const runnerService = new RunnerService();

    onMount(() => {
        // @ts-expect-error - Custom event type not in Obsidian's type definitions
        settingsEventRef = plugin.app.workspace.on(SETTINGS_UPDATED_EVENT, () => {
            settingsVersion += 1;
        });

        return () => {
            if (settingsEventRef) {
                plugin.app.workspace.offref(settingsEventRef);
                settingsEventRef = null;
            }
        };
    });

    $effect(() => {
        toolRegistry = new ToolRegistry(plugin.app);
    });

    // 生成唯一 ID
    function generateId(): string {
        return crypto.randomUUID();
    }

    // 滚动到底部
    function scrollToBottom(): void {
        if (messagesContainer) {
            setTimeout(() => {
                messagesContainer?.scrollTo({
                    top: messagesContainer.scrollHeight,
                    behavior: 'smooth',
                });
            }, 100);
        }
    }

    // 处理模型选择变更
    function handleModelChange(value: string | undefined): void {
        if (value) {
            selectedModel = value;
        }
    }

    function handleAgentChange(value: string | undefined): void {
        if (!value) return;
        selectedAgentId = value;

        const nextAgent = availableAgents.find((agent) => agent.id === value);
        if (nextAgent?.modelId && nextAgent.modelId !== selectedModel) {
            selectedModel = nextAgent.modelId;
            lastSyncedAgentId = value;
            lastSyncedAgentModelId = nextAgent.modelId;
        }
    }

    function resolveModelForAgent(agent: AgentConfig, fallbackModelId?: string) {
        const modelId = fallbackModelId || agent.modelId || resolveDefaultModelSelection();
        const modelConfig = parseModelSelection(modelId, plugin.settings);

        if (!modelConfig) {
            throw new Error(`请先配置 ${modelId.split(':')[0] || 'openai'} 的 API Key`);
        }

        return createModel(modelConfig);
    }

    // 处理消息提交
    async function handleSubmit(message: PromptInputMessage, _event: SubmitEvent): Promise<void> {
        const text = message.text?.trim();
        if (!text) return;

        // 添加用户消息
        const userMessage: ChatMessage = {
            id: generateId(),
            role: 'user',
            content: text,
            timestamp: new Date(),
        };
        messages = [...messages, userMessage];
        scrollToBottom();

        // 设置为提交状态
        chatStatus = 'submitted';
        streamingText = '';

        try {
            chatStatus = 'streaming';

            // 创建 Agent（会在内部检查 API Key）
            const agent = createAgent();

            // 使用 RunnerService 进行流式调用，传入 session 自动管理会话历史
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
                { session }
            );

            // 添加助手消息
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

            // 添加错误消息
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

    // 清除当前会话（保留供未来使用）
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async function clearSession(): Promise<void> {
        await sessionManager.delete(sessionId);
        messages = [];
        streamingText = '';
        chatStatus = 'idle';
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

    // 创建 Agent（使用 AI SDK 适配器支持多 provider）
    function createAgent(): Agent {
        const agentConfigs = availableAgents;
        const activeAgent = resolveActiveAgent();
        const registry = new AgentRegistry(toolRegistry, agentConfigs);

        return registry.buildAgent(activeAgent.id, {
            resolveModel: (config) => {
                const modelId =
                    config.id === activeAgent.id
                        ? selectedModel || config.modelId
                        : config.modelId || selectedModel;
                return resolveModelForAgent(config, modelId);
            },
        });
    }
</script>

<div class={cn('cortex-chat-view flex h-full flex-col', isDarkMode ? 'dark' : '')}>
    <!-- 消息列表区域 -->
    <div class="flex-1 overflow-y-auto px-4" bind:this={messagesContainer}>
        {#if messages.length === 0}
            <!-- 空状态 -->
            <div class="flex h-full items-center justify-center">
                <div class="text-muted-foreground text-center">
                    <div class="mb-2 text-lg font-medium">Cortex Chat</div>
                    <div class="text-sm">开始与 AI 助手对话吧</div>
                </div>
            </div>
        {:else}
            <!-- 消息列表 -->
            <div class="space-y-4 py-4">
                {#each messages as msg (msg.id)}
                    <Message from={msg.role}>
                        <MessageContent variant="flat">
                            {#if msg.role === 'assistant'}
                                <Response content={msg.content} {isDarkMode} />
                            {:else}
                                <span class="whitespace-pre-wrap">{msg.content}</span>
                            {/if}
                        </MessageContent>
                    </Message>
                {/each}

                <!-- 流式输出 -->
                {#if chatStatus === 'streaming' && streamingText}
                    <Message from="assistant">
                        <MessageContent variant="flat">
                            <Response content={streamingText} {isDarkMode} />
                        </MessageContent>
                    </Message>
                {/if}
            </div>
        {/if}
    </div>

    <!-- 输入区域 -->
    <div class="border-border shrink-0 border-t p-4">
        <PromptInput
            onSubmit={handleSubmit}
            class="border-input bg-background rounded-xl border shadow-sm"
        >
            <PromptInputBody>
                <PromptInputTextarea placeholder="输入消息..." />
            </PromptInputBody>
            <PromptInputToolbar class="justify-between px-3 py-2">
                <div class="flex items-center gap-2">
                    <!-- Agent 选择器 -->
                    <PromptInputModelSelect
                        value={selectedAgentId}
                        onValueChange={handleAgentChange}
                        disabled={!availableAgents.length}
                    >
                        <PromptInputModelSelectTrigger class="h-8 text-xs">
                            <PromptInputModelSelectValue
                                placeholder="选择 Agent"
                                value={selectedAgentName}
                            />
                        </PromptInputModelSelectTrigger>
                        <PromptInputModelSelectContent>
                            {#if availableAgents.length === 0}
                                <div class="text-muted-foreground px-3 py-2 text-xs">
                                    请先在 Agent 配置页创建 Agent
                                </div>
                            {:else}
                                {#each availableAgents as agent (agent.id)}
                                    <PromptInputModelSelectItem
                                        value={agent.id}
                                        disabled={!agent.enabled}
                                    >
                                        <span class="flex items-center gap-2">
                                            <span
                                                class={cn(
                                                    'h-1.5 w-1.5 rounded-full',
                                                    agent.enabled
                                                        ? 'bg-emerald-500'
                                                        : 'bg-muted-foreground/40'
                                                )}
                                            ></span>
                                            <span class="truncate">{agent.name}</span>
                                        </span>
                                    </PromptInputModelSelectItem>
                                {/each}
                            {/if}
                        </PromptInputModelSelectContent>
                    </PromptInputModelSelect>

                    <!-- 模型选择器 -->
                    <PromptInputModelSelect value={selectedModel} onValueChange={handleModelChange}>
                        <PromptInputModelSelectTrigger class="h-8 text-xs">
                            <PromptInputModelSelectValue
                                placeholder="选择模型"
                                value={selectedModelName}
                            />
                        </PromptInputModelSelectTrigger>
                        <PromptInputModelSelectContent>
                            {#each groupedModels as group (group.providerId)}
                                <PromptInputModelSelectGroup>
                                    <PromptInputModelSelectGroupHeading>
                                        {group.providerLabel}
                                    </PromptInputModelSelectGroupHeading>
                                    {#each group.models as model (model.id)}
                                        <PromptInputModelSelectItem value={model.id}>
                                            {model.name}
                                        </PromptInputModelSelectItem>
                                    {/each}
                                </PromptInputModelSelectGroup>
                            {/each}
                        </PromptInputModelSelectContent>
                    </PromptInputModelSelect>
                </div>

                <PromptInputSubmit status={chatStatus} />
            </PromptInputToolbar>
        </PromptInput>
    </div>
</div>

<style>
    .cortex-chat-view {
        background-color: var(--background-primary);
        color: var(--text-normal);
    }
</style>
