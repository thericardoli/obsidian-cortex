<script lang="ts">
    import { cn } from '$lib/utils';
    import type { AgentConfig } from '../../types/agent';
    import { GitBranch, Check } from '@lucide/svelte';

    interface Props {
        otherAgents: AgentConfig[];
        selectedHandoffIds: string[];
        onToggle: (agentId: string) => void;
    }

    let { otherAgents, selectedHandoffIds, onToggle }: Props = $props();
</script>

<div class="border-border/60 bg-background/60 rounded-xl border p-4">
    <div class="text-foreground flex items-center gap-1.5 text-sm font-medium">
        <GitBranch class="h-4 w-4" />
        Sub-agents (handoff targets)
    </div>
    <p class="text-muted-foreground ml-5.5 text-xs">
        Choose agents this agent can hand off tasks to
    </p>

    <div class="mt-3 space-y-1.5">
        {#if otherAgents.length === 0}
            <div
                class="border-border/60 text-muted-foreground rounded-lg border border-dashed py-6 text-center text-sm"
            >
                No other agents available for handoff
            </div>
        {:else}
            {#each otherAgents as agent (agent.id)}
                {@const isSelected = selectedHandoffIds.includes(agent.id)}
                <label
                    class={cn(
                        'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-all',
                        isSelected
                            ? 'border-primary/40 bg-primary/5'
                            : 'border-border/50 bg-card/80 hover:border-border'
                    )}
                >
                    <input
                        type="checkbox"
                        class="sr-only"
                        checked={isSelected}
                        onchange={() => onToggle(agent.id)}
                    />
                    <span
                        class={cn(
                            'flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors',
                            isSelected
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-border bg-background'
                        )}
                    >
                        {#if isSelected}
                            <Check class="h-3 w-3" strokeWidth={3} />
                        {/if}
                    </span>
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2">
                            <span class="text-sm font-medium">{agent.name}</span>
                            <span
                                class={cn(
                                    'h-1.5 w-1.5 rounded-full',
                                    agent.enabled ? 'bg-emerald-500' : 'bg-muted-foreground/40'
                                )}
                            ></span>
                        </div>
                        <div class="text-muted-foreground line-clamp-1 text-xs">
                            {agent.description ||
                                agent.handoffDescription ||
                                agent.instructions?.slice(0, 60) ||
                                'No description yet'}
                        </div>
                    </div>
                </label>
            {/each}
        {/if}
    </div>
</div>
