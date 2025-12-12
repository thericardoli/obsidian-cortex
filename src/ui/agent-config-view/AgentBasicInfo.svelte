<script lang="ts">
    import { Textarea } from '$lib/components/ui/textarea';

    import type { AgentConfig } from '../../types/agent';

    interface ModelGroup {
        providerId: string;
        providerLabel: string;
        models: { id: string; name: string }[];
    }

    interface Props {
        agent: AgentConfig;
        groupedModels: ModelGroup[];
        onUpdate: (patch: Partial<AgentConfig>) => void;
    }

    let { agent, groupedModels, onUpdate }: Props = $props();

    const preferredModelId = $derived.by(() => agent.defaultModelId || agent.modelId || '');
    const selectableModelIds = $derived.by(() =>
        groupedModels.flatMap((group) => group.models.map((model) => model.id))
    );
    const hasCustomModel = $derived.by(
        () => !!preferredModelId && !selectableModelIds.includes(preferredModelId)
    );

    function handleDefaultModelChange(value: string) {
        onUpdate({
            defaultModelId: value,
            modelId: value,
        });
    }
</script>

<div class="border-border/60 bg-background/60 rounded-xl border p-4">
    <label class="block space-y-1.5">
        <span class="text-foreground text-sm font-medium">Name</span>
        <input
            class="border-input focus:border-primary focus:ring-primary/20 h-10 w-full rounded-lg border bg-transparent px-3 font-[inherit] text-sm shadow-xs transition-colors outline-none focus:ring-2"
            value={agent.name}
            oninput={(e) => onUpdate({ name: (e.currentTarget as HTMLInputElement).value })}
            placeholder="Give this agent a name"
        />
    </label>

    <label class="mt-4 block space-y-1.5">
        <span class="text-foreground text-sm font-medium">Description</span>
        <input
            class="border-input focus:border-primary focus:ring-primary/20 h-10 w-full rounded-lg border bg-transparent px-3 font-[inherit] text-sm shadow-xs transition-colors outline-none focus:ring-2"
            value={agent.description}
            oninput={(e) => {
                const value = (e.currentTarget as HTMLInputElement).value;
                onUpdate({
                    description: value,
                    handoffDescription: value,
                });
            }}
            placeholder="Describe what this agent is best at so other agents know when to hand off"
        />
    </label>

    <label class="mt-4 block space-y-1.5">
        <span class="text-foreground text-sm font-medium">Default model</span>
        <div class="relative">
            <select
                class="border-input focus:border-primary focus:ring-primary/20 h-10 w-full appearance-none rounded-lg border bg-transparent px-3 font-[inherit] text-sm shadow-xs transition-colors outline-none focus:ring-2"
                value={preferredModelId}
                onchange={(e) =>
                    handleDefaultModelChange((e.currentTarget as HTMLSelectElement).value)}
            >
                <option value="">选择模型</option>
                {#if preferredModelId && hasCustomModel}
                    <option value={preferredModelId}>Custom: {preferredModelId}</option>
                {/if}
                {#each groupedModels as group (group.providerId)}
                    <optgroup label={group.providerLabel}>
                        {#each group.models as model (model.id)}
                            <option value={model.id}>{model.name}</option>
                        {/each}
                    </optgroup>
                {/each}
            </select>
        </div>
        <p class="text-muted-foreground text-xs">
            Used when this agent handles a handoff. Chat view still prefers your selected model
            first.
        </p>
    </label>

    <label class="mt-4 block space-y-1.5">
        <span class="text-foreground text-sm font-medium">System instructions</span>
        <Textarea
            class="min-h-28 resize-y"
            value={agent.instructions}
            oninput={(e) =>
                onUpdate({ instructions: (e.currentTarget as HTMLTextAreaElement).value })}
            placeholder="Set system instructions for this agent, such as role, tone, and output format"
        />
    </label>
</div>
