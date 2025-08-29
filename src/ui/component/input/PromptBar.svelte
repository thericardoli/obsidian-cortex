<script lang="ts">
	import { setIcon } from 'obsidian';
	import { onMount } from 'svelte';
	import type { AgentConfig } from '../../../types';
	import { createLogger } from '../../../utils/logger';

	const logger = createLogger('ui');

	type ModelGroup = {
		providerId: string;
		providerName: string;
		items: { key: string; label: string; modelId: string }[];
	};

	let {
		availableAgents = [],
		availableModelGroups: modelGroups = [],
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
		availableModelGroups: ModelGroup[];
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
	let rootEl: HTMLDivElement;
	let sendIconEl: HTMLElement;

	function focusInput() {
		textareaElement?.focus();
	}

	onMount(() => {
		onReady?.({ focusInput });
		queueMicrotask(() => focusInput());
	});

	// Derived state
	const isInputEmpty = $derived(inputText.trim() === '');
	const canSendMessage = $derived(canSend && !isInputEmpty && !isLoading);

	// Auto-resize textarea
	$effect(() => {
		if (textareaElement && inputText !== undefined) {
			textareaElement.style.height = 'auto';
			const scrollHeight = textareaElement.scrollHeight;
			const minHeight = 100;
			const maxHeight = 160;
			const newHeight = Math.max(minHeight, Math.min(scrollHeight, maxHeight));
			textareaElement.style.height = newHeight + 'px';
		}
	});

	// Update send icon (lucide) via Obsidian setIcon
	$effect(() => {
		if (!sendIconEl) return;
		setIcon(sendIconEl, isLoading ? 'loader-2' : 'send');
		if (isLoading) sendIconEl.classList.add('spinning');
		else sendIconEl.classList.remove('spinning');
	});

	function handleSend() {
		logger.debug('handleSend called', {
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
		if (agent) onAgentChange(agent);
	}

	function handleModelSelect(event: Event) {
		const target = event.target as HTMLSelectElement;
		onModelChange(target.value);
	}
</script>

<div class="prompt-bar" bind:this={rootEl}>
	<div class="input-row">
		<div class="input-container">
			<div class="input-box">
				<textarea
					bind:this={textareaElement}
					bind:value={inputText}
					onkeydown={handleKeydown}
					placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
					class="message-input"
					rows="1"
				></textarea>

				<div class="input-tools">
					<div class="tools-left">
						<div class="selector-group compact">
							<select
								id="agent-select"
								aria-label="Agent"
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
						<div class="selector-group compact">
							<select
								id="model-select"
								aria-label="Model"
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
					<button
						onclick={handleSend}
						disabled={!canSendMessage}
						class="send-button"
						title="Send message"
						aria-label="Send message"
					>
						<span bind:this={sendIconEl} class="icon-slot" aria-hidden="true"></span>
					</button>
				</div>
			</div>
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

	.selector-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex: 1;
		min-width: 200px;
	}

	.selector-group.compact {
		min-width: unset;
		flex: unset;
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

	.selector-group select:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.selector-group select:focus {
		outline: none;
		border-color: var(--interactive-accent);
		box-shadow: 0 0 0 2px rgba(var(--interactive-accent-rgb), 0.2);
	}

	.input-row {
		display: flex;
		gap: 0.5rem;
		align-items: flex-end;
		flex-wrap: wrap;
	}

	.input-container {
		flex: 1 1 400px;
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.input-box {
		border: 1px solid var(--background-modifier-border);
		border-radius: 0.75rem;
		background: var(--background-primary);
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.5rem;
		padding-bottom: 3rem; /* reserve space for bottom-right tools */
		position: relative;
	}
	.input-tools {
		position: absolute;
		left: 0.5rem;
		right: 0.5rem;
		bottom: 0.5rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		flex-wrap: nowrap;
	}

	.input-tools .tools-left {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}

	.message-input {
		width: 100%;
		min-height: 40px;
		max-height: 160px;
		padding: 0.5rem;
		border: none;
		border-radius: 0.5rem;
		background: transparent;
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
		outline: none !important;
		box-shadow: none !important;
		border-color: transparent !important;
	}

	/* Also ensure no focus ring/highlight from browsers using :focus-visible */
	.message-input:focus-visible {
		outline: none !important;
		box-shadow: none !important;
		border-color: transparent !important;
	}

	/* Prevent the container from highlighting when textarea is focused */
	.input-box:focus-within {
		border-color: var(--background-modifier-border) !important;
		box-shadow: none !important;
	}

	.message-input::placeholder {
		color: var(--text-muted);
	}

	.send-button {
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

	.send-button .icon-slot {
		display: inline-flex;
		width: 16px;
		height: 16px;
		color: currentColor;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
	.send-button .icon-slot:global(.spinning) {
		animation: spin 1s linear infinite;
	}

	@media (max-width: 600px) {
		.input-row {
			align-items: stretch;
		}
		.selector-group {
			flex: 1;
		}
	}
</style>
