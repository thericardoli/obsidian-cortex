<script lang="ts">
	// No props needed - pure visual component
</script>

<div class="loading-indicator">
	<div class="loading-header">
		<span class="assistant-label">Assistant</span>
		<span class="thinking-text">is thinking...</span>
	</div>
	<div class="loading-content">
		<div class="dots">
			<div class="dot"></div>
			<div class="dot"></div>
			<div class="dot"></div>
		</div>
	</div>
</div>

<style>
	.loading-indicator {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		max-width: 80%;
		margin-right: auto;
	}

	.loading-header {
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

	.thinking-text {
		font-size: 0.75rem;
		font-style: italic;
	}

	.loading-content {
		background: var(--background-secondary);
		padding: 0.75rem 1rem;
		border-radius: 1rem 1rem 1rem 0.25rem;
		border: 1px solid var(--background-modifier-border);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
	}

	.dots {
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}

	.dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--text-muted);
		animation: pulse 1.4s ease-in-out infinite both;
	}

	.dot:nth-child(1) {
		animation-delay: -0.32s;
	}

	.dot:nth-child(2) {
		animation-delay: -0.16s;
	}

	.dot:nth-child(3) {
		animation-delay: 0s;
	}

	@keyframes pulse {
		0%, 80%, 100% {
			opacity: 0.3;
			transform: scale(0.8);
		}
		40% {
			opacity: 1;
			transform: scale(1);
		}
	}
</style>
