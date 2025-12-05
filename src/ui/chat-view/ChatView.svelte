<script lang="ts">
    import type { App } from 'obsidian';
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
    import { BUILTIN_PROVIDERS } from '../../settings/settings';

    interface Props {
        app: App;
        plugin: CortexPlugin;
        isDarkMode?: boolean;
    }

    let { app, plugin, isDarkMode = false }: Props = $props();

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

    // 模型选择状态 - 使用默认值初始化
    let selectedModel = $state('gpt-4.1-mini');

    // 初始化时设置默认模型（取第一个已配置 provider 的第一个模型）
    $effect(() => {
        if (selectedModel === 'gpt-4.1-mini') {
            const activeProvider = plugin.settings.providers[plugin.settings.activeProviderId];
            if (activeProvider?.apiKey && activeProvider.models.length > 0) {
                const firstModel = activeProvider.models[0];
                selectedModel = `${plugin.settings.activeProviderId}:${firstModel.modelName}`;
            }
        }
    });

    // 获取可用的模型列表，按 Provider 分组
    const groupedModels = $derived.by(() => {
        const groups: {
            providerId: string;
            providerLabel: string;
            models: { id: string; name: string }[];
        }[] = [];
        const providers = plugin.settings.providers;

        for (const [providerId, providerSettings] of Object.entries(providers)) {
            if (providerSettings.apiKey && providerSettings.models.length > 0) {
                const providerInfo = BUILTIN_PROVIDERS[providerId as keyof typeof BUILTIN_PROVIDERS];
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

    // Session 管理 - 每个 ChatView 实例有独立的 session
    const sessionId = crypto.randomUUID();
    const session = $derived(sessionManager.getOrCreate(sessionId));

    // 初始化 RunnerService
    const runnerService = new RunnerService();

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

    // 创建 Agent（使用 AI SDK 适配器支持多 provider）
    function createAgent(): Agent {
        // 解析选中的模型配置
        const modelConfig = parseModelSelection(selectedModel, plugin.settings);

        if (!modelConfig) {
            // 如果解析失败，抛出错误
            throw new Error(`请先配置 ${selectedModel.split(':')[0] || 'openai'} 的 API Key`);
        }

        // 使用 AI SDK 适配器创建模型
        const model = createModel(modelConfig);

        return new Agent({
            name: 'Cortex Assistant',
            instructions: '你是一个友好的 AI 助手，名为 Cortex。请用中文回答用户的问题。',
            model,
        });
    }

    // 处理模型选择变更
    function handleModelChange(value: string | undefined): void {
        if (value) {
            selectedModel = value;
        }
    }

    // 处理消息提交
    async function handleSubmit(message: PromptInputMessage, event: SubmitEvent): Promise<void> {
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

    // 清除当前会话
    async function clearSession(): Promise<void> {
        await sessionManager.delete(sessionId);
        messages = [];
        streamingText = '';
        chatStatus = 'idle';
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
