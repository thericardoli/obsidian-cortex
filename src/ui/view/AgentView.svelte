<script lang="ts">
    import { onMount } from 'svelte';
    import type { AgentManager } from '../../agent/agent-manager';
    import type { ProviderManager } from '../../providers/provider-manager';
    import type { AgentConfig, AgentConfigInput, ModelConfig } from '../../types';

    // Props
    let {
        agentManager,
        providerManager
    }: {
        agentManager: AgentManager;
        providerManager: ProviderManager;
    } = $props();

    // State
    let agents = $state<AgentConfig[]>([]);
    let selectedAgent = $state<AgentConfig | null>(null);
    let editingAgent = $state<AgentConfigInput | null>(null);
    let isCreatingNew = $state(false);

    // Derived state
    const availableProviders = $derived(providerManager.getEnabledProviders().map(p => ({
        id: p.getId(),
        name: p.getName()
    })));

    onMount(() => {
        loadAgents();
    });

    function loadAgents() {
        agents = agentManager.listAgents();
    }

    function handleSelectAgent(agent: AgentConfig) {
        selectedAgent = agent;
        editingAgent = { ...agent };
        isCreatingNew = false;
    }

    function handleCreateNewAgent() {
        selectedAgent = null;
        editingAgent = {
            name: '',
            instructions: '',
            modelConfig: {
                provider: availableProviders[0]?.id || '',
                model: '',
            },
            tools: [],
            inputGuardrails: [],
            outputGuardrails: [],
            mcpServers: [],
        };
        isCreatingNew = true;
    }

    async function handleSaveChanges(event: SubmitEvent) {
        event.preventDefault();
        if (!editingAgent) return;

        try {
            if (isCreatingNew) {
                await agentManager.createAgent(editingAgent);
            } else if (selectedAgent) {
                await agentManager.updateAgent(selectedAgent.id, editingAgent);
            }

            loadAgents();
            handleCancel();
        } catch (error) {
            console.error('Failed to save agent:', error);
            // You could show a notification to the user here
        }
    }

    async function handleDeleteAgent() {
        if (!selectedAgent) return;

        if (confirm(`Are you sure you want to delete the agent "${selectedAgent.name}"?`)) {
            try {
                await agentManager.deleteAgent(selectedAgent.id);
                loadAgents();
                handleCancel();
            } catch (error) {
                console.error('Failed to delete agent:', error);
            }
        }
    }

    function handleCancel() {
        selectedAgent = null;
        editingAgent = null;
        isCreatingNew = false;
    }

</script>

<div class="agent-view">
    <div class="agent-list-pane">
        <div class="pane-header">
            <h2>Agents</h2>
            <button onclick={handleCreateNewAgent}>+ New</button>
        </div>
        <div class="agent-list">
            {#each agents as agent}
                <button type="button" class="agent-list-item" onclick={() => handleSelectAgent(agent)} class:selected={selectedAgent?.id === agent.id}>
                    {agent.name}
                </button>
            {/each}
        </div>
    </div>

    <div class="agent-detail-pane">
        {#if editingAgent}
            <form onsubmit={handleSaveChanges}>
                <div class="form-group">
                    <label for="agent-name">Name</label>
                    <input id="agent-name" type="text" bind:value={editingAgent.name} required />
                </div>

                <div class="form-group">
                    <label for="agent-instructions">Instructions</label>
                    <textarea id="agent-instructions" bind:value={editingAgent.instructions} rows="10" required></textarea>
                </div>

                <div class="form-group">
                    <label for="agent-provider">Provider</label>
                    <select id="agent-provider" bind:value={editingAgent.modelConfig.provider}>
                        {#each availableProviders as provider}
                            <option value={provider.id}>{provider.name}</option>
                        {/each}
                    </select>
                </div>

                <div class="form-group">
                    <label for="agent-model">Model</label>
                    <input id="agent-model" type="text" bind:value={editingAgent.modelConfig.model} placeholder="e.g., gpt-4-turbo" required />
                </div>

                <div class="form-group">
                    <h3>Tools</h3>
                    <p><i>Tool management UI coming soon...</i></p>
                </div>

                <div class="form-actions">
                    <button type="submit">{isCreatingNew ? 'Create Agent' : 'Save Changes'}</button>
                    {#if !isCreatingNew && selectedAgent}
                        <button type="button" class="delete" onclick={handleDeleteAgent}>Delete</button>
                    {/if}
                    <button type="button" class="cancel" onclick={handleCancel}>Cancel</button>
                </div>
            </form>
        {:else}
            <div class="placeholder">
                Select an agent to edit, or create a new one.
            </div>
        {/if}
    </div>
</div>

<style>
    .agent-view {
        display: flex;
        height: 100%;
    }
    .agent-list-pane {
        width: 250px;
        border-right: 1px solid var(--background-modifier-border);
        display: flex;
        flex-direction: column;
    }
    .pane-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px;
        border-bottom: 1px solid var(--background-modifier-border);
    }
    .agent-list {
        flex-grow: 1;
        overflow-y: auto;
    }
    .agent-list-item {
        padding: 8px 12px;
        cursor: pointer;
    }
    .agent-list-item:hover {
        background-color: var(--background-modifier-hover);
    }
    .agent-list-item.selected {
        background-color: var(--background-modifier-active);
    }
    .agent-detail-pane {
        flex-grow: 1;
        padding: 16px;
        overflow-y: auto;
    }
    .placeholder {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100%;
        color: var(--text-muted);
    }
    .form-group {
        margin-bottom: 16px;
    }
    label {
        display: block;
        margin-bottom: 4px;
        font-weight: bold;
    }
    input, textarea, select {
        width: 100%;
        padding: 8px;
    }
    .form-actions {
        display: flex;
        gap: 8px;
        margin-top: 24px;
    }
    .delete {
        background-color: var(--color-red);
        color: white;
    }
    .cancel {
        background-color: transparent;
        border: 1px solid var(--background-modifier-border);
    }
</style>
