<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import { cn } from '$lib/utils';
    import type { AgentConfig } from '../../types/agent';
    import { Bot, Plus, User } from '@lucide/svelte';

    interface Props {
        agents: AgentConfig[];
        selectedAgentId: string;
        onSelect: (agentId: string) => void;
        onAdd: () => void;
    }

    let { agents, selectedAgentId, onSelect, onAdd }: Props = $props();
</script>

<aside class="border-border/80 bg-card/60 flex w-64 shrink-0 flex-col rounded-2xl border shadow-sm">
    <div class="border-border/60 flex items-center justify-between gap-2 border-b px-3 py-3">
        <div class="text-muted-foreground flex items-center gap-1.5 text-sm font-semibold">
            <Bot class="h-4 w-4" />
            Agents
        </div>
        <Button size="sm" variant="ghost" class="h-7 px-2 text-xs" onclick={onAdd}>
            <Plus class="mr-1 h-3 w-3" /> New
        </Button>
    </div>

    <div class="flex-1 space-y-1.5 overflow-y-auto p-2">
        {#if agents.length === 0}
            <div
                class="text-muted-foreground flex h-32 items-center justify-center text-center text-sm"
            >
                No agents yet
            </div>
        {:else}
            {#each agents as agent (agent.id)}
                <button
                    class={cn(
                        'group relative w-full rounded-lg border px-3 py-2.5 text-left transition-all duration-150',
                        selectedAgentId === agent.id
                            ? 'border-primary/60 bg-primary/10 shadow-sm'
                            : 'hover:border-border hover:bg-muted/50 border-transparent'
                    )}
                    onclick={() => onSelect(agent.id)}
                >
                    <div class="flex items-center justify-between gap-2">
                        <div class="flex items-center gap-2">
                            <User class="text-muted-foreground h-4 w-4 shrink-0" />
                            <span class="line-clamp-1 text-sm font-medium"
                                >{agent.name || 'Unnamed Agent'}</span
                            >
                        </div>
                        <span
                            class={cn(
                                'h-2 w-2 shrink-0 rounded-full transition-colors',
                                agent.enabled ? 'bg-emerald-500' : 'bg-muted-foreground/40'
                            )}
                            title={agent.enabled ? 'Enabled' : 'Disabled'}
                        ></span>
                    </div>
                </button>
            {/each}
        {/if}
    </div>
</aside>
