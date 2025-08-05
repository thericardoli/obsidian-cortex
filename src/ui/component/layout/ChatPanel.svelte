<script lang="ts">
	import UserMessage from '../message/UserMessage.svelte';
	import AssistantMessage from '../message/AssistantMessage.svelte';
	import LoadingIndicator from '../feedback/LoadingIndicator.svelte';

	type Message = {
		id: string;
		role: 'user' | 'assistant';
		content: string;
		timestamp: number;
	};

	let {
		messages = [],
		isLoading = false,
		container = $bindable()
	}: {
		messages: Message[];
		isLoading: boolean;
		container?: HTMLElement;
	} = $props();
</script>

<div class="chat-panel" bind:this={container}>
	<div class="messages-container">
		{#each messages as message (message.id)}
			{#if message.role === 'user'}
				<UserMessage content={message.content} timestamp={message.timestamp} />
			{:else}
				<AssistantMessage content={message.content} timestamp={message.timestamp} />
			{/if}
		{/each}
		
		{#if isLoading}
			<LoadingIndicator />
		{/if}
	</div>
</div>

<style>
	.chat-panel {
		flex: 1;
		overflow-y: auto;
		padding: 1rem;
		background: var(--background-primary);
	}

	.messages-container {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		max-width: 100%;
	}

	/* Scrollbar styling for consistency with Obsidian */
	.chat-panel::-webkit-scrollbar {
		width: 8px;
	}

	.chat-panel::-webkit-scrollbar-track {
		background: var(--background-secondary);
	}

	.chat-panel::-webkit-scrollbar-thumb {
		background: var(--background-modifier-border);
		border-radius: 4px;
	}

	.chat-panel::-webkit-scrollbar-thumb:hover {
		background: var(--text-muted);
	}
</style>
