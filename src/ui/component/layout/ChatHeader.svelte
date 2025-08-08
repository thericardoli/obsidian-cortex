<script lang="ts">
	let {
		isLoading = false,
		onOpenAgentManager,
	}: { isLoading: boolean; onOpenAgentManager: () => void } = $props();
</script>

<div class="chat-header">
	<div class="title">
		<svg
			viewBox="0 0 24 24"
			width="16"
			height="16"
			fill="currentColor"
			class="title-icon"
		>
			<path d="M21 6h-2v9H7l-4 4V6c0-1.1.9-2 2-2h16c1.1 0 2 .9 2 2z" />
		</svg>
		Cortex Chat
	</div>
	<div class="spacer"></div>
	<button
		class="secondary agents-button"
		onclick={onOpenAgentManager}
		title="Manage Agents"
		disabled={isLoading}
	>
		<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
			<path
				d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5zm0 2c-3.866 0-7 2.239-7 5v1h14v-1c0-2.761-3.134-5-7-5z"
			/>
		</svg>
		Agents
	</button>
</div>

<style>
	.chat-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid var(--background-modifier-border);
		background: var(--background-primary);
	}
	.title {
		font-weight: 600;
		display: inline-flex;
		gap: 0.4rem;
		align-items: center;
	}
	.title-icon {
		opacity: 0.8;
	}
	.spacer {
		flex: 1;
	}
	.agents-button {
		padding: 0.4rem 0.75rem;
		border: 1px solid var(--background-modifier-border);
		border-radius: 0.5rem;
		background: var(--background-secondary);
		color: var(--text-normal);
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		cursor: pointer;
	}
	.agents-button:hover {
		background: var(--background-modifier-hover);
	}
	.agents-button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
</style>
