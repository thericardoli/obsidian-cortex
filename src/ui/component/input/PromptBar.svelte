<script lang="ts">
	import { onMount } from 'svelte';
	import type { AgentConfig } from '../../../types';

	type ModelGroup = {
		providerId: string;
		providerName: string;
		items: { key: string; label: string; modelId: string }[];
	};

	let {
		availableAgents = [],
		modelGroups = [],
		selectedAgent = null,
		selectedModelKey = '',
		canSend = false,
		isLoading = false,
		onSendMessage,
		onAgentChange,
		onModelChange,
		onReady,
	}: {
		availableAgents: AgentConfig[];
		modelGroups: ModelGroup[];
		selectedAgent: AgentConfig | null;
		selectedModelKey: string;
		canSend: boolean;
		isLoading: boolean;
		onSendMessage: (text: string) => void;
		onAgentChange: (agent: AgentConfig) => void;
		onModelChange: (key: string) => void;
		onReady?: (api: { focusInput: () => void }) => void;
	} = $props();

	// State
	let inputText = $state('');
	let textareaElement: HTMLTextAreaElement;

	// Expose a tiny API for parent to focus the input
	function focusInput() {
		try {
			textareaElement?.focus();
		} catch {}
	}
	// Notify parent with focus API and focus on first mount
	onMount(() => {
		try {
			onReady?.({ focusInput });
		} catch {}
		queueMicrotask(() => focusInput());
	});
	let rootEl: HTMLDivElement;

	// Derived state
	const isInputEmpty = $derived(inputText.trim() === '');
	const canSendMessage = $derived(canSend && !isInputEmpty && !isLoading);

	// Auto-resize textarea based on content
	$effect(() => {
		if (textareaElement && inputText !== undefined) {
			// Reset height to auto to get accurate scrollHeight
			textareaElement.style.height = 'auto';

			// Calculate new height based on content
			const scrollHeight = textareaElement.scrollHeight;
			const minHeight = 100; // Minimum height in pixels
			const maxHeight = 160; // Maximum height in pixels (about 6-7 lines)

			// Set height within bounds
			const newHeight = Math.max(minHeight, Math.min(scrollHeight, maxHeight));
			textareaElement.style.height = newHeight + 'px';
		}
	});

	function handleSend() {
		console.log('handleSend called:', {
			canSendMessage,
			inputText,
			canSend,
			isInputEmpty,
			isLoading,
		});
		if (!canSendMessage) return;

		const text = inputText.trim();
		if (text) {
			onSendMessage(text);
			inputText = '';
			// Keep focus for quick follow-ups
			queueMicrotask(() => focusInput());
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			handleSend();
		}
	}

	function handleAgentSelect(event: Event) {
		const target = event.target as HTMLSelectElement;
		const agentId = target.value;
		const agent = availableAgents.find((a) => a.id === agentId);
		if (agent) {
			onAgentChange(agent);
		}
	}

	function handleModelSelect(event: Event) {
		const target = event.target as HTMLSelectElement;
		onModelChange(target.value);
	}
</script>

<div class="prompt-bar" bind:this={rootEl}>
	<div class="controls-row">
		<div class="selector-group">
			<label for="agent-select">Agent:</label>
			<select
				id="agent-select"
				value={selectedAgent?.id || ''}
				onchange={handleAgentSelect}
				disabled={isLoading}
			>
				<option value="" disabled>Select an agent</option>
				{#each availableAgents as agent (agent.id)}
					<option value={agent.id}>{agent.name}</option>
				{/each}
			</select>
		</div>

		<div class="selector-group">
			<label for="model-select">Model:</label>
			<select
				id="model-select"
				value={selectedModelKey}
				onchange={handleModelSelect}
				disabled={isLoading}
			>
				<option value="" disabled>Select a model</option>
				{#each modelGroups as group (group.providerId)}
					<optgroup label={group.providerName}>
						{#each group.items as item (item.key)}
							<option value={item.key}>{item.label}</option>
						{/each}
					</optgroup>
				{/each}
			</select>
		</div>
	</div>

	<div class="input-row">
		<div class="input-container">
			<textarea
				bind:this={textareaElement}
				bind:value={inputText}
				onkeydown={handleKeydown}
				placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
				class="message-input"
				rows="1"
			></textarea>

			<button
				onclick={handleSend}
				disabled={!canSendMessage}
				class="send-button"
				title="Send message"
			>
				{#if isLoading}
					<svg class="loading-icon" viewBox="0 0 24 24" width="16" height="16">
						<circle
							cx="12"
							cy="12"
							r="10"
							stroke="currentColor"
							stroke-width="2"
							fill="none"
							opacity="0.3"
						/>
						<path
							d="M12 2 A 10 10 0 0 1 22 12"
							stroke="currentColor"
							stroke-width="2"
							fill="none"
						>
							<animateTransform
								attributeName="transform"
								type="rotate"
								values="0 12 12;360 12 12"
								dur="1s"
								repeatCount="indefinite"
							/>
						</path>
					</svg>
				{:else}
					<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
						<path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
					</svg>
				{/if}
			</button>
		</div>
	</div>
</div>

<style>
	.prompt-bar {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1rem;
		background: var(--background-primary);
		border-top: 1px solid var(--background-modifier-border);
	}

	.controls-row {
		display: flex;
		gap: 1rem;
		align-items: center;
		flex-wrap: wrap;
	}

	.selector-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex: 1;
		min-width: 200px;
	}

	.selector-group label {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-normal);
		white-space: nowrap;
	}

	.selector-group select {
		flex: 1;
		padding: 0.375rem 0.75rem;
		border: 1px solid var(--background-modifier-border);
		border-radius: 0.375rem;
		background: var(--background-primary);
		color: var(--text-normal);
		font-size: 0.875rem;
		cursor: pointer;
	}

	/* removed search input */

	.selector-group select:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.selector-group select:focus {
		outline: none;
		border-color: var(--interactive-accent);
		box-shadow:
			0 0 0 2px var(--interactive-accent-rgb),
			0.2;
	}

	.input-row {
		display: flex;
		gap: 0.5rem;
		align-items: flex-end;
	}

	.input-container {
		flex: 1;
		position: relative;
	}

	.message-input {
		width: 100%;
		min-height: 40px;
		max-height: 160px;
		padding: 0.75rem 3rem 0.75rem 0.75rem; /* Added right padding for button */
		border: 1px solid var(--background-modifier-border);
		border-radius: 0.75rem;
		background: var(--background-primary);
		color: var(--text-normal);
		font-size: 0.9rem;
		line-height: 1.4;
		resize: none;
		overflow-y: auto;
		font-family: inherit;
		box-sizing: border-box;
		transition: height 0.1s ease-out;
	}

	.message-input:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.message-input:focus {
		outline: none;
		border-color: var(--interactive-accent);
		box-shadow: 0 0 0 2px rgba(var(--interactive-accent-rgb), 0.2);
	}

	.message-input::placeholder {
		color: var(--text-muted);
	}

	.send-button {
		position: absolute;
		right: 0.5rem;
		bottom: 0.5rem;
		width: 32px;
		height: 32px;
		padding: 0;
		border: none;
		border-radius: 50%;
		background: var(--interactive-accent);
		color: var(--text-on-accent);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
		flex-shrink: 0;
		z-index: 1;
	}

	.send-button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.send-button:not(:disabled):hover {
		background: var(--interactive-accent-hover);
		transform: scale(1.05);
	}

	.send-button:not(:disabled):active {
		transform: scale(0.95);
	}

	.loading-icon {
		color: currentColor;
	}

	/* Responsive adjustments */
	@media (max-width: 600px) {
		.controls-row {
			flex-direction: column;
			gap: 0.5rem;
		}

		.selector-group {
			width: 100%;
			min-width: unset;
		}
	}
</style>
