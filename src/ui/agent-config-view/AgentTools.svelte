<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import { Wrench } from '@lucide/svelte';

    interface Props {
        toolIds: string[];
        onAdd: (toolId: string) => void;
        onRemove: (toolId: string) => void;
    }

    let { toolIds, onAdd, onRemove }: Props = $props();
    let newToolId = $state('');

    function handleAdd() {
        if (!newToolId.trim()) return;
        onAdd(newToolId.trim());
        newToolId = '';
    }
</script>

<div class="border-border/60 bg-background/60 rounded-xl border p-4">
    <div class="flex items-center justify-between gap-3">
        <div>
            <div class="text-foreground flex items-center gap-1.5 text-sm font-medium">
                <Wrench class="h-4 w-4" />
                Tools
            </div>
            <p class="text-muted-foreground ml-5.5 text-xs">Configure tools this agent can call</p>
        </div>
        <div class="flex items-center gap-2">
            <input
                class="border-input focus:border-primary focus:ring-primary/20 h-8 w-36 rounded-lg border bg-transparent px-2.5 font-[inherit] text-sm shadow-xs transition-colors outline-none focus:ring-2"
                placeholder="Enter tool ID"
                bind:value={newToolId}
                onkeydown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <Button size="sm" variant="secondary" class="h-8" onclick={handleAdd}>Add</Button>
        </div>
    </div>

    <div class="mt-3 space-y-1.5">
        {#if toolIds.length > 0}
            {#each toolIds as toolId (toolId)}
                <div
                    class="border-border/50 bg-card/80 hover:border-border flex items-center justify-between rounded-lg border px-3 py-2 transition-colors"
                >
                    <div class="flex items-center gap-2">
                        <span
                            class="bg-primary/10 text-primary flex h-6 w-6 items-center justify-center rounded text-xs"
                        >
                            T
                        </span>
                        <span class="text-sm font-medium">{toolId}</span>
                    </div>
                    <Button
                        size="sm"
                        variant="ghost"
                        class="text-muted-foreground hover:text-destructive h-7 px-2 text-xs"
                        onclick={() => onRemove(toolId)}
                    >
                        Remove
                    </Button>
                </div>
            {/each}
        {:else}
            <div
                class="border-border/60 text-muted-foreground rounded-lg border border-dashed py-6 text-center text-sm"
            >
                No tools added yet
            </div>
        {/if}
    </div>
</div>
