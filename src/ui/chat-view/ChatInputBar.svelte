<script lang="ts">
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
    import type { PromptInputMessage, ChatStatus } from '$lib/components/ai-elements/prompt-input';
    import { cn } from '$lib/utils';
    import type { AgentConfig } from '../../types/agent';

    interface ModelGroup {
        providerId: string;
        providerLabel: string;
        models: { id: string; name: string }[];
    }

    interface Props {
        onSubmit: (message: PromptInputMessage, event: SubmitEvent) => void;
        onAgentChange: (value: string | undefined) => void;
        onModelChange: (value: string | undefined) => void;
        chatStatus: ChatStatus;
        selectedAgentId: string;
        selectedAgentName: string;
        selectedModel: string;
        selectedModelName: string;
        availableAgents: AgentConfig[];
        groupedModels: ModelGroup[];
    }

    let {
        onSubmit,
        onAgentChange,
        onModelChange,
        chatStatus,
        selectedAgentId,
        selectedAgentName,
        selectedModel,
        selectedModelName,
        availableAgents,
        groupedModels,
    }: Props = $props();
</script>

<div
    class="border-border sticky bottom-0 z-20 shrink-0 border-t bg-[var(--background-primary)] p-4"
>
    <PromptInput {onSubmit} class="border-input bg-background rounded-xl border shadow-sm">
        <PromptInputBody>
            <PromptInputTextarea placeholder="输入消息..." />
        </PromptInputBody>
        <PromptInputToolbar class="justify-between px-3 py-2">
            <div class="flex items-center gap-2">
                <PromptInputModelSelect
                    value={selectedAgentId}
                    onValueChange={onAgentChange}
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

                <PromptInputModelSelect value={selectedModel} onValueChange={onModelChange}>
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
