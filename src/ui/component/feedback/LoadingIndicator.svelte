<script lang="ts">
	// Simple loading component for general loading states (like agent initialization)
</script>

<div class="simple-loading">
	<div class="dots">
		<div class="dot"></div>
		<div class="dot"></div>
		<div class="dot"></div>
	</div>
	<span class="loading-text">Loading...</span>
</div>

<style>
	.simple-loading {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		justify-content: center;
		padding: 1rem;
		color: var(--text-muted);
		font-size: 0.875rem;
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
		0%,
		80%,
		100% {
			opacity: 0.3;
			transform: scale(0.8);
		}
		40% {
			opacity: 1;
			transform: scale(1);
		}
	}

	.loading-text {
		font-style: italic;
	}
</style>
