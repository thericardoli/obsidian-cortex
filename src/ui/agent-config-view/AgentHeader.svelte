<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import { cn } from '$lib/utils';
    import type { AgentConfig } from '../../types/agent';

    interface Props {
        agent: AgentConfig;
        canDelete: boolean;
        onToggleEnabled: (enabled: boolean) => void;
        onDelete: () => void;
    }

    let { agent, canDelete, onToggleEnabled, onDelete }: Props = $props();
</script>

<header class="border-border/60 shrink-0 border-b p-5">
    <div class="flex items-start justify-between gap-4">
        <div class="min-w-0 flex-1">
            <div class="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                Agent Configuration
            </div>
            <h2 class="text-foreground mt-1 truncate text-xl font-semibold">
                {agent.name || 'Unnamed Agent'}
            </h2>
            <p class="text-muted-foreground mt-0.5 text-sm">
                Manage agent instructions, tools, and handoff strategy.
            </p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
            <label class="flex cursor-pointer items-center gap-2 text-sm transition-colors">
                <input
                    type="checkbox"
                    class="sr-only"
                    checked={agent.enabled}
                    onchange={(e) => onToggleEnabled((e.currentTarget as HTMLInputElement).checked)}
                />
                <span
                    class={cn(
                        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200',
                        agent.enabled ? 'bg-interactive-accent' : 'bg-background-modifier-border'
                    )}
                >
                    <span
                        class={cn(
                            'bg-background-primary inline-block h-4 w-4 rounded-full shadow-sm transition-transform duration-200',
                            agent.enabled ? 'translate-x-[18px]' : 'translate-x-0.5'
                        )}
                    ></span>
                </span>
                <span
                    class={cn(
                        'font-medium',
                        agent.enabled ? 'text-text-normal' : 'text-muted-foreground'
                    )}
                >
                    {agent.enabled ? 'Enabled' : 'Disabled'}
                </span>
            </label>
            <Button
                size="sm"
                variant="ghost"
                class="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onclick={onDelete}
                disabled={!canDelete}
                title={agent.kind === 'builtin'
                    ? 'Built-in agents cannot be deleted'
                    : !canDelete
                      ? 'At least one agent must be kept'
                      : 'Delete this agent'}
            >
                Delete
            </Button>
        </div>
    </div>
</header>
