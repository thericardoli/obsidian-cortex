<script lang="ts">
    import { onMount } from 'svelte';
    import { SvelteSet } from 'svelte/reactivity';
    import { BUILTIN_PROVIDERS, DEFAULT_AGENT_CONFIGS } from '../../settings/settings';
    import type { AgentConfig } from '../../types/agent';
    import type CortexPlugin from '../../../main';
    import { loadAgentConfigs, persistAgentConfigs } from '../../core/persistence/agent-store';
    import { SETTINGS_UPDATED_EVENT } from '../../settings/settings';
    import AgentSidebar from './AgentSidebar.svelte';
    import AgentHeader from './AgentHeader.svelte';
    import AgentBasicInfo from './AgentBasicInfo.svelte';
    import AgentTools from './AgentTools.svelte';
    import AgentHandoffs from './AgentHandoffs.svelte';
    import AgentEmptyState from './AgentEmptyState.svelte';

    interface ModelGroup {
        providerId: string;
        providerLabel: string;
        models: { id: string; name: string }[];
    }

    interface Props {
        plugin: CortexPlugin;
    }

    let { plugin }: Props = $props();
    let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

    function withDefaults(config: AgentConfig): AgentConfig {
        const description = config.description || config.handoffDescription || '';
        const modelId = config.modelId ?? config.defaultModelId;
        const defaultModelId = config.defaultModelId ?? modelId;
        return {
            ...config,
            kind: config.kind || 'custom',
            modelId,
            defaultModelId,
            description,
            handoffDescription: config.handoffDescription ?? description,
            handoffIds: config.handoffIds ?? [],
            toolIds: config.toolIds ?? [],
            enabled: config.enabled ?? true,
        };
    }

    function cloneDefaults(configs: AgentConfig[]): AgentConfig[] {
        return configs.map((config) => withDefaults({ ...config }));
    }

    function loadAgents(): AgentConfig[] {
        return cloneDefaults(DEFAULT_AGENT_CONFIGS);
    }

    let agents = $state<AgentConfig[]>(loadAgents());
    let selectedAgentId = $state('');

    onMount(async () => {
        const hydrated = await loadAgentConfigs(DEFAULT_AGENT_CONFIGS);
        agents = cloneDefaults(hydrated.length ? hydrated : agents);
        if (!selectedAgentId && agents[0]) {
            selectedAgentId = agents[0].id;
        }
    });

    let selectedAgent = $derived(agents.find((agent) => agent.id === selectedAgentId));
    let otherAgents = $derived(agents.filter((agent) => agent.id !== selectedAgentId));

    const groupedModels = $derived.by<ModelGroup[]>(() => {
        const groups: ModelGroup[] = [];
        const providers = plugin.settings.providers || {};

        for (const [providerId, providerSettings] of Object.entries(providers)) {
            if (providerSettings.apiKey && providerSettings.models?.length) {
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

        return groups;
    });

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
            modelId: undefined,
            defaultModelId: undefined,
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

    async function deleteAgent(agentId: string) {
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
        await saveAgents();
    }

    function addTool(toolId: string) {
        if (!selectedAgent) return;
        updateSelectedAgent({
            toolIds: Array.from(new SvelteSet([...(selectedAgent.toolIds ?? []), toolId])),
        });
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
        const sanitizedAgents = agents.map((agent) => withDefaults(agent));
        await persistAgentConfigs(sanitizedAgents);
        plugin.app.workspace.trigger(SETTINGS_UPDATED_EVENT, plugin.settings);
        isSaving = false;
    }
</script>

<div class="bg-background text-foreground flex h-full gap-4 p-4">
    <AgentSidebar {agents} {selectedAgentId} onSelect={selectAgent} onAdd={addAgent} />

    <section
        class="border-border/80 bg-card/40 flex flex-1 flex-col overflow-hidden rounded-2xl border shadow-sm"
    >
        {#if selectedAgent}
            <AgentHeader
                agent={selectedAgent}
                canDelete={agents.length > 1 && selectedAgent.kind !== 'builtin'}
                onToggleEnabled={(enabled) => updateSelectedAgent({ enabled })}
                onDelete={() => deleteAgent(selectedAgent.id)}
            />

            <div class="flex-1 space-y-4 overflow-y-auto p-5">
                <AgentBasicInfo
                    agent={selectedAgent}
                    {groupedModels}
                    onUpdate={updateSelectedAgent}
                />

                <AgentTools
                    toolIds={selectedAgent.toolIds ?? []}
                    onAdd={addTool}
                    onRemove={removeTool}
                />

                <AgentHandoffs
                    {otherAgents}
                    selectedHandoffIds={selectedAgent.handoffIds ?? []}
                    onToggle={toggleSubAgent}
                />
            </div>
        {:else}
            <AgentEmptyState />
        {/if}
    </section>
</div>
