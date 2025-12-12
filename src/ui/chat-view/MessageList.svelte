<script lang="ts">
    import { Message, MessageContent } from '$lib/components/ai-elements/message';
    import { Response } from '$lib/components/ai-elements/response';

    import type { ChatStatus } from '$lib/components/ai-elements/prompt-input';

    export interface ChatMessage {
        id: string;
        role: 'user' | 'assistant';
        content: string;
        timestamp: Date;
    }

    interface Props {
        messages: ChatMessage[];
        streamingText: string;
        chatStatus: ChatStatus;
        isDarkMode?: boolean;
        isLoading?: boolean;
        container?: HTMLDivElement | null;
    }

    let {
        messages,
        streamingText,
        chatStatus,
        isDarkMode = false,
        isLoading = false,
        container = $bindable<HTMLDivElement | null>(null),
    }: Props = $props();
</script>

<div class="flex-1 overflow-y-auto px-4" bind:this={container}>
    {#if isLoading}
        <div class="flex h-full items-center justify-center">
            <div class="text-muted-foreground text-sm">正在加载会话...</div>
        </div>
    {:else if messages.length === 0}
        <div class="flex h-full items-center justify-center">
            <div class="text-muted-foreground text-center">
                <div class="mb-2 text-lg font-medium">Cortex Chat</div>
                <div class="text-sm">开始与 AI 助手对话吧</div>
            </div>
        </div>
    {:else}
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
