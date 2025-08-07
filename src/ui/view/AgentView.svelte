<script lang="ts">
    import { onMount } from 'svelte';
    import type { App } from 'obsidian';
    import type { AgentManager } from '../../agent/agent-manager';
    import type { ProviderManager } from '../../providers/provider-manager';
    import type { AgentConfig, CreateAgentInput, UpdateAgentInput } from '../../types';

    // Props
    let { agentManager, providerManager, app }: {
        agentManager: AgentManager;
        providerManager: ProviderManager;
        app: App;
    } = $props();

    // State
    let agents = $state<AgentConfig[]>([]);
    let editingAgent = $state<AgentConfig | null>(null);
    let isCreatingNew = $state(false);
    let formState = $state<Partial<CreateAgentInput>>({
        name: '',
        description: '',
        model: '',
        system_prompt: '',
    });

    // Fetch agents on mount
    onMount(() => {
        loadAgents();
    });

    function loadAgents() {
        agents = agentManager.listAgents();
    }

    function handleCreateNew() {
        editingAgent = null;
        isCreatingNew = true;
        formState = {
            name: '',
            description: '',
            model: 'gpt-4',
            system_prompt: '',
        };
    }

    function handleEdit(agent: AgentConfig) {
        editingAgent = agent;
        isCreatingNew = false;
        formState = {
            name: agent.name,
            description: agent.description,
            model: agent.model,
            system_prompt: agent.system_prompt,
        };
    }

    function handleCancel() {
        editingAgent = null;
        isCreatingNew = false;
    }

    async function handleSave() {
        if (!formState.name || !formState.model) {
            // Basic validation
            console.error("Name and model are required.");
            return;
        }

        try {
            if (isCreatingNew) {
                await agentManager.createAgent({
                    name: formState.name,
                    description: formState.description || '',
                    model: formState.model,
                    system_prompt: formState.system_prompt || '',
                });
            } else if (editingAgent) {
                await agentManager.updateAgent(editingAgent.id, {
                    name: formState.name,
                    description: formState.description,
                    model: formState.model,
                    system_prompt: formState.system_prompt,
                });
            }
            loadAgents();
            handleCancel();
        } catch (error) {
            console.error("Failed to save agent:", error);
        }
    }

    async function handleDelete(agentId: string) {
        if (confirm("Are you sure you want to delete this agent?")) {
            try {
                await agentManager.deleteAgent(agentId);
                loadAgents();
            } catch (error) {
                console.error("Failed to delete agent:", error);
            }
        }
    }
</script>

<div class="agent-view">
    <div class="view-header">
        <h1>Agent Management</h1>
        <button onclick={handleCreateNew}>Create New Agent</button>
    </div>

    {#if isCreatingNew || editingAgent}
        <div class="agent-form">
            <h2>{isCreatingNew ? 'Create New Agent' : 'Edit Agent'}</h2>
            <form onsubmit={handleSave}>
                <label>
                    Name
                    <input type="text" bind:value={formState.name} required />
                </label>
                <label>
                    Description
                    <textarea bind:value={formState.description}></textarea>
                </label>
                <label>
                    Model
                    <input type="text" bind:value={formState.model} required />
                </label>
                <label>
                    System Prompt
                    <textarea rows="5" bind:value={formState.system_prompt}></textarea>
                </label>
                <div class="form-actions">
                    <button type="submit">Save</button>
                    <button type="button" onclick={handleCancel}>Cancel</button>
                </div>
            </form>
        </div>
    {/if}

    <div class="agent-list">
        <h2>Available Agents</h2>
        {#each agents as agent (agent.id)}
            <div class="agent-item">
                <div class="agent-info">
                    <strong>{agent.name}</strong>
                    <p>{agent.description}</p>
                </div>
                <div class="agent-actions">
                    <button onclick={() => handleEdit(agent)}>Edit</button>
                    <button onclick={() => handleDelete(agent.id)}>Delete</button>
                </div>
            </div>
        {/each}
    </div>
</div>

<style>
    .agent-view {
        padding: 16px;
        height: 100%;
        overflow-y: auto;
    }
    .view-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid var(--background-modifier-border);
        padding-bottom: 8px;
        margin-bottom: 16px;
    }
    .view-header h1 {
        font-size: 1.5em;
        margin: 0;
    }
    .agent-form {
        margin-bottom: 24px;
        padding: 16px;
        background: var(--background-secondary);
        border-radius: 8px;
    }
    .agent-form h2 {
        margin-top: 0;
    }
    .agent-form label {
        display: block;
        margin-bottom: 12px;
    }
    .agent-form input, .agent-form textarea {
        width: 100%;
        padding: 8px;
        border-radius: 4px;
        border: 1px solid var(--background-modifier-border);
    }
    .form-actions {
        margin-top: 16px;
        display: flex;
        gap: 8px;
    }
    .agent-list {
        margin-top: 16px;
    }
    .agent-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px;
        border-radius: 8px;
        background: var(--background-secondary);
        margin-bottom: 8px;
    }
    .agent-info p {
        font-size: 0.9em;
        color: var(--text-muted);
        margin: 4px 0 0;
    }
    .agent-actions button {
        margin-left: 8px;
    }
</style>
