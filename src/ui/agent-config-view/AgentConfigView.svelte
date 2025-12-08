<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import { Textarea } from '$lib/components/ui/textarea';
    import { cn } from '$lib/utils';
    import { SvelteSet } from 'svelte/reactivity';
    import { DEFAULT_SETTINGS } from '../../settings/settings';
    import type { AgentConfig } from '../../types/agent';
    import type CortexPlugin from '../../../main';
    import { Bot, Plus, Wrench, GitBranch, User, Check } from '@lucide/svelte';

    interface Props {
        plugin: CortexPlugin;
    }

    const DEFAULT_MODEL = 'openai:gpt-4.1-mini';

    let { plugin }: Props = $props();
    let newToolId = $state('');
    let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

    function withDefaults(config: AgentConfig): AgentConfig {
        const description = config.description || config.handoffDescription || '';
        return {
            ...config,
            kind: config.kind || 'custom',
            modelId: config.modelId || DEFAULT_MODEL,
            description,
            handoffDescription: config.handoffDescription ?? description,
            handoffIds: config.handoffIds ?? [],
            toolIds: config.toolIds ?? [],
            enabled: config.enabled ?? true,
        };
    }

    function fromLegacy(): AgentConfig[] | null {
        const legacy = (plugin.settings as unknown as Record<string, unknown>).agentConfigData as
            | {
                  configs?: Record<
                      string,
                      {
                          id?: string;
                          name?: string;
                          instructions?: string;
                          enabled?: boolean;
                          description?: string;
                      }
                  >;
              }
            | undefined;

        if (!legacy?.configs) return null;

        return Object.values(legacy.configs).map((config) =>
            withDefaults({
                id: config.id || crypto.randomUUID(),
                name: config.name || 'Unnamed Agent',
                kind: 'custom',
                instructions: config.instructions || '',
                modelId: DEFAULT_MODEL,
                description: config.description || '',
                handoffDescription: config.description || '',
                handoffIds: [],
                toolIds: [],
                enabled: config.enabled ?? true,
            })
        );
    }

    function cloneDefaults(configs: AgentConfig[]): AgentConfig[] {
        return configs.map((config) => withDefaults({ ...config }));
    }

    function loadAgents(): AgentConfig[] {
        if (
            Array.isArray(plugin.settings.agentConfigs) &&
            plugin.settings.agentConfigs.length > 0
        ) {
            return cloneDefaults(plugin.settings.agentConfigs);
        }

        const legacy = fromLegacy();
        if (legacy?.length) return legacy;

        return cloneDefaults(DEFAULT_SETTINGS.agentConfigs);
    }

    let agents = $state<AgentConfig[]>(loadAgents());
    let selectedAgentId = $state('');

    let selectedAgent = $derived(agents.find((agent) => agent.id === selectedAgentId));
    let otherAgents = $derived(agents.filter((agent) => agent.id !== selectedAgentId));

    $effect(() => {
        if (!selectedAgent && agents[0]) {
            selectedAgentId = agents[0].id;
        }
    });

    function selectAgent(agentId: string) {
        if (selectedAgentId && selectedAgentId !== agentId) {
            saveAgents();
        }
        selectedAgentId = agentId;
    }

    function scheduleAutoSave() {
        if (autoSaveTimer) {
            clearTimeout(autoSaveTimer);
        }
        autoSaveTimer = setTimeout(() => {
            saveAgents();
        }, 1500);
    }

    function updateSelectedAgent(patch: Partial<AgentConfig>) {
        if (!selectedAgentId) return;
        agents = agents.map((agent) =>
            agent.id === selectedAgentId ? { ...agent, ...patch } : agent
        );
        scheduleAutoSave();
    }

    function addAgent() {
        if (selectedAgentId) {
            saveAgents();
        }
        
        const id = crypto.randomUUID();
        const newAgent: AgentConfig = {
            id,
            name: `Agent ${agents.length + 1}`,
            kind: 'custom',
            instructions: 'Describe what this agent is good at...',
            modelId: DEFAULT_MODEL,
            description: '',
            handoffDescription: '',
            handoffIds: [],
            toolIds: [],
            enabled: true,
        };

        agents = [...agents, newAgent];
        selectedAgentId = id;
        scheduleAutoSave();
    }

    function deleteAgent(agentId: string) {
        const target = agents.find((a) => a.id === agentId);
        if (target?.kind === 'builtin') return;
        if (agents.length <= 1) return;
        const idx = agents.findIndex((a) => a.id === agentId);
        agents = agents.filter((a) => a.id !== agentId);
        agents = agents.map((a) => ({
            ...a,
            handoffIds: (a.handoffIds || []).filter((id) => id !== agentId),
        }));
        if (selectedAgentId === agentId) {
            selectedAgentId = agents[Math.max(0, idx - 1)]?.id ?? '';
        }
        scheduleAutoSave();
    }

    function addTool() {
        if (!selectedAgent || !newToolId.trim()) return;
        const toolId = newToolId.trim();
        updateSelectedAgent({
            toolIds: Array.from(new SvelteSet([...(selectedAgent.toolIds ?? []), toolId])),
        });
        newToolId = '';
    }

    function removeTool(toolId: string) {
        if (!selectedAgent) return;
        updateSelectedAgent({
            toolIds: (selectedAgent.toolIds || []).filter((id) => id !== toolId),
        });
    }

    function toggleSubAgent(agentId: string) {
        if (!selectedAgent || agentId === selectedAgent.id) return;
        const current = new SvelteSet(selectedAgent.handoffIds || []);
        if (current.has(agentId)) {
            current.delete(agentId);
        } else {
            current.add(agentId);
        }
        updateSelectedAgent({ handoffIds: Array.from(current) });
    }

    let isSaving = false;

    async function saveAgents() {
        if (isSaving) return;
        
        isSaving = true;
        plugin.settings.agentConfigs = agents.map((agent) => withDefaults(agent));
        await plugin.saveSettings();
        isSaving = false;
    }
</script>

<div class="bg-background text-foreground flex h-full gap-4 p-4">
    <aside
        class="border-border/80 bg-card/60 flex w-64 shrink-0 flex-col rounded-2xl border shadow-sm"
    >
        <div class="border-border/60 flex items-center justify-between gap-2 border-b px-3 py-3">
            <div class="text-muted-foreground flex items-center gap-1.5 text-sm font-semibold">
                <Bot class="h-4 w-4" />
                Agents
            </div>
            <Button size="sm" variant="ghost" class="h-7 px-2 text-xs" onclick={addAgent}>
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
                        onclick={() => selectAgent(agent.id)}
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

    <section
        class="border-border/80 bg-card/40 flex flex-1 flex-col overflow-hidden rounded-2xl border shadow-sm"
    >
        {#if selectedAgent}
            <header class="border-border/60 shrink-0 border-b p-5">
                <div class="flex items-start justify-between gap-4">
                    <div class="min-w-0 flex-1">
                        <div
                            class="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase"
                        >
                            Agent Configuration
                        </div>
                        <h2 class="text-foreground mt-1 truncate text-xl font-semibold">
                            {selectedAgent.name || 'Unnamed Agent'}
                        </h2>
                        <p class="text-muted-foreground mt-0.5 text-sm">
                            Manage agent instructions, tools, and handoff strategy.
                        </p>
                    </div>
                    <div class="flex shrink-0 items-center gap-2">
                        <label
                            class="flex cursor-pointer items-center gap-2 text-sm transition-colors"
                        >
                            <input
                                type="checkbox"
                                class="sr-only"
                                checked={selectedAgent.enabled}
                                onchange={(e) =>
                                    updateSelectedAgent({
                                        enabled: (e.currentTarget as HTMLInputElement).checked,
                                    })}
                            />
                            <span
                                class={cn(
                                    'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200',
                                    selectedAgent.enabled
                                        ? 'bg-interactive-accent'
                                        : 'bg-background-modifier-border'
                                )}
                            >
                                <span
                                    class={cn(
                                        'inline-block h-4 w-4 rounded-full bg-background-primary shadow-sm transition-transform duration-200',
                                        selectedAgent.enabled
                                            ? 'translate-x-[18px]'
                                            : 'translate-x-0.5'
                                    )}
                                ></span>
                            </span>
                            <span class={cn(
                                'font-medium',
                                selectedAgent.enabled ? 'text-text-normal' : 'text-muted-foreground'
                            )}>
                                {selectedAgent.enabled ? 'Enabled' : 'Disabled'}
                            </span>
                        </label>
                        <Button
                            size="sm"
                            variant="ghost"
                            class="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onclick={() => deleteAgent(selectedAgent.id)}
                            disabled={agents.length <= 1 || selectedAgent.kind === 'builtin'}
                            title={selectedAgent.kind === 'builtin'
                                ? 'Built-in agents cannot be deleted'
                                : agents.length <= 1
                                  ? 'At least one agent must be kept'
                                  : 'Delete this agent'}
                        >
                            Delete
                        </Button>
                    </div>
                </div>
            </header>

            <div class="flex-1 space-y-4 overflow-y-auto p-5">
                <div class="border-border/60 bg-background/60 rounded-xl border p-4">
                    <label class="block space-y-1.5">
                        <span class="text-foreground text-sm font-medium">Name</span>
                        <input
                            class="border-input focus:border-primary focus:ring-primary/20 h-10 w-full rounded-lg border bg-transparent px-3 font-[inherit] text-sm shadow-xs transition-colors outline-none focus:ring-2"
                            value={selectedAgent.name}
                            oninput={(e) =>
                                updateSelectedAgent({
                                    name: (e.currentTarget as HTMLInputElement).value,
                                })}
                            placeholder="Give this agent a name"
                        />
                    </label>

                    <label class="mt-4 block space-y-1.5">
                        <span class="text-foreground text-sm font-medium">Description</span>
                        <input
                            class="border-input focus:border-primary focus:ring-primary/20 h-10 w-full rounded-lg border bg-transparent px-3 font-[inherit] text-sm shadow-xs transition-colors outline-none focus:ring-2"
                            value={selectedAgent.description}
                            oninput={(e) =>
                                updateSelectedAgent({
                                    description: (e.currentTarget as HTMLInputElement).value,
                                    handoffDescription: (e.currentTarget as HTMLInputElement).value,
                                })}
                            placeholder="Describe what this agent is best at so other agents know when to hand off"
                        />
                    </label>

                    <label class="mt-4 block space-y-1.5">
                        <span class="text-foreground text-sm font-medium">System instructions</span>
                        <Textarea
                            class="min-h-28 resize-y"
                            value={selectedAgent.instructions}
                            oninput={(e) =>
                                updateSelectedAgent({
                                    instructions: (e.currentTarget as HTMLTextAreaElement).value,
                                })}
                            placeholder="Set system instructions for this agent, such as role, tone, and output format"
                        />
                    </label>
                </div>

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
                                value={newToolId}
                                oninput={(e) =>
                                    (newToolId = (e.currentTarget as HTMLInputElement).value)}
                                onkeydown={(e) => e.key === 'Enter' && addTool()}
                            />
                            <Button size="sm" variant="secondary" class="h-8" onclick={addTool}
                                >Add</Button
                            >
                        </div>
                    </div>

                    <div class="mt-3 space-y-1.5">
                        {#if selectedAgent.toolIds?.length}
                            {#each selectedAgent.toolIds as toolId (toolId)}
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
                                        onclick={() => removeTool(toolId)}
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
                                {@const isSelected = selectedAgent.handoffIds?.includes(agent.id)}
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
                                        onchange={() => toggleSubAgent(agent.id)}
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
                                                    agent.enabled
                                                        ? 'bg-emerald-500'
                                                        : 'bg-muted-foreground/40'
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
            </div>
        {:else}
            <div
                class="text-muted-foreground flex h-full flex-col items-center justify-center gap-3"
            >
                <div class="bg-muted/50 flex h-16 w-16 items-center justify-center rounded-full">
                    <Bot class="h-8 w-8" strokeWidth={1.5} />
                </div>
                <div class="text-center">
                    <div class="text-lg font-semibold">No agents configured yet</div>
                    <p class="mt-1 text-sm">Click "New" on the left to create your first agent</p>
                </div>
            </div>
        {/if}
    </section>
</div>
