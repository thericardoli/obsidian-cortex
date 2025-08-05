<script lang="ts">
	let {
		content,
		timestamp
	}: {
		content: string;
		timestamp: number;
	} = $props();

	const formattedTime = $derived(
		new Date(timestamp).toLocaleTimeString([], { 
			hour: '2-digit', 
			minute: '2-digit' 
		})
	);
</script>

<div class="assistant-message">
	<div class="message-header">
		<span class="assistant-label">Assistant</span>
		<span class="timestamp">{formattedTime}</span>
	</div>
	<div class="message-content">
		{content}
	</div>
</div>

<style>
	.assistant-message {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		max-width: 80%;
		margin-right: auto;
	}

	.message-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.25rem;
		font-size: 0.875rem;
		color: var(--text-muted);
	}

	.assistant-label {
		font-weight: 500;
		color: var(--text-normal);
	}

	.timestamp {
		font-size: 0.75rem;
	}

	.message-content {
		background: var(--background-secondary);
		color: var(--text-normal);
		padding: 0.75rem 1rem;
		border-radius: 1rem 1rem 1rem 0.25rem;
		word-wrap: break-word;
		white-space: pre-wrap;
		font-size: 0.9rem;
		line-height: 1.4;
		border: 1px solid var(--background-modifier-border);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
	}

	/* Handle empty content (loading state) */
	.message-content:empty::before {
		content: "Thinking...";
		color: var(--text-muted);
		font-style: italic;
	}
</style>
