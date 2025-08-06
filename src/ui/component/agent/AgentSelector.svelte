<script lang="ts">
	import type { AgentConfig } from '../../../types';

	// Props
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

	function handleSelect(event: Event) {
		const target = event.target as HTMLSelectElement;
		const agentId = target.value;
		const agent = agents.find(a => a.id === agentId);
		if (agent) {
			onAgentSelect(agent);
		}
	}
</script>

<div class="agent-selector">
	<select onchange={handleSelect} value={selectedAgent?.id || ''}>
		{#if agents.length === 0}
			<option value="" disabled>No agents available</option>
		{:else}
			<option value="" disabled selected>Select an agent</option>
			{#each agents as agent}
				<option value={agent.id}>{agent.name}</option>
			{/each}
		{/if}
	</select>
	<button onclick={onCreateAgent}>+ New Agent</button>
</div>

<style>
	.agent-selector {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	select {
		flex-grow: 1;
		/* Add your select styles here */
	}

	button {
		flex-shrink: 0;
		/* Add your button styles here */
	}
</style>
