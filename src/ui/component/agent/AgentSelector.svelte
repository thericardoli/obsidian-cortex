<script lang="ts">
    import type { AgentConfig } from '../../../types';

    let {
        agents,
        selectedAgent,
        onAgentSelect,
        onCreateAgent
    }: {
        agents: AgentConfig[];
        selectedAgent: AgentConfig | null;
        onAgentSelect: (agent: AgentConfig) => void;
        onCreateAgent: () => void;
    } = $props();

    function handleSelectChange(event: Event) {
        const target = event.target as HTMLSelectElement;
        const agentId = target.value;
        const agent = agents.find(a => a.id === agentId);
        if (agent) {
            onAgentSelect(agent);
        }
    }
</script>

<div class="agent-selector">
    <select onchange={handleSelectChange}>
        {#if agents.length === 0}
            <option disabled selected>No agents available</option>
        {:else}
            <option value="" disabled selected={!selectedAgent}>Select an agent</option>
            {#each agents as agent (agent.id)}
                <option value={agent.id} selected={selectedAgent?.id === agent.id}>
                    {agent.name}
                </option>
            {/each}
        {/if}
    </select>
    <button class="create-agent-btn" onclick={onCreateAgent}>+</button>
</div>

<style>
    .agent-selector {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    select {
        flex-grow: 1;
        padding: 8px;
        border-radius: 4px;
        border: 1px solid var(--background-modifier-border);
        background-color: var(--background-secondary);
        color: var(--text-normal);
    }

    .create-agent-btn {
        padding: 8px 12px;
        font-size: 1.2em;
        line-height: 1;
        border-radius: 4px;
        border: 1px solid var(--background-modifier-border);
        background-color: var(--background-secondary);
        cursor: pointer;
    }

    .create-agent-btn:hover {
        background-color: var(--background-modifier-hover);
    }
</style>
