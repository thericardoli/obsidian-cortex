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

<div class="user-message">
	<div class="message-header">
		<span class="user-label">You</span>
		<span class="timestamp">{formattedTime}</span>
	</div>
	<div class="message-content">
		{content}
	</div>
</div>

<style>
	.user-message {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		max-width: 80%;
		margin-left: auto;
	}

	.message-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.25rem;
		font-size: 0.875rem;
		color: var(--text-muted);
	}

	.user-label {
		font-weight: 500;
		color: var(--text-accent);
	}

	.timestamp {
		font-size: 0.75rem;
	}

	.message-content {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
		padding: 0.75rem 1rem;
		border-radius: 1rem 1rem 0.25rem 1rem;
		word-wrap: break-word;
		white-space: pre-wrap;
		font-size: 0.9rem;
		line-height: 1.4;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
	}
</style>
