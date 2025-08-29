<script lang="ts">
	let {
		sessions = [] as Array<{ id: string; name?: string }>,
		currentSessionId = '',
		onSelectSession,
		onDeleteSession,
		isLoading = false,
		setIcon,
	}: {
		sessions?: Array<{ id: string; name?: string }>;
		currentSessionId?: string;
		onSelectSession: (id: string) => void | Promise<void>;
		onDeleteSession: (id: string) => void | Promise<void>;
		isLoading?: boolean;
		setIcon: (el: HTMLElement, name: string) => void;
	} = $props();

	function displayName(s: { id: string; name?: string }) {
		return s.name && s.name.trim() ? s.name : s.id;
	}

	function iconAction(node: HTMLElement, name: string) {
		try {
			setIcon?.(node, name);
		} catch {
			/* ignore */
		}
		return {
			update(n: string) {
				try {
					setIcon?.(node, n);
				} catch {
					/* ignore */
				}
			},
		};
	}
</script>

<div class="history-view" role="list">
	{#if sessions.length === 0}
		<div class="history-empty">Empty History</div>
	{:else}
		{#each sessions as s (s.id)}
			<div
				class="history-row {currentSessionId === s.id ? 'active' : ''}"
				title={s.id}
				role="listitem"
			>
				<button
					class="history-item"
					onclick={async () => {
						await onSelectSession?.(s.id);
					}}
					disabled={isLoading}
				>
					<span class="dot {currentSessionId === s.id ? 'dot-active' : ''}"></span>
					{displayName(s)}
				</button>
				<button
					class="delete-btn"
					aria-label="Delete Session"
					onclick={async (e) => {
						e.stopPropagation();
						await onDeleteSession?.(s.id);
					}}
					disabled={isLoading}
				>
					<span class="icon" use:iconAction={'trash-2'} aria-hidden="true"></span>
				</button>
			</div>
		{/each}
	{/if}
</div>

<style>
	.history-view {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.5rem;
		overflow: auto;
		height: 100%;
	}
	.history-empty {
		padding: 0.5rem;
		opacity: 0.7;
	}
	.history-row {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}
	.history-row.active .history-item {
		font-weight: 600;
		background: var(--background-modifier-hover);
	}
	.history-item {
		width: 100%;
		text-align: left;
		padding: 0.9rem 0.9rem;
		min-height: 48px;
		border-radius: 0.375rem;
		border: none;
		background: transparent;
		color: var(--text-normal);
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		cursor: pointer;
	}
	.history-item:hover {
		background: var(--background-modifier-hover);
	}
	.delete-btn {
		border: none;
		background: transparent;
		color: var(--text-faint);
		cursor: pointer;
		padding: 0.35rem;
		border-radius: 0.375rem;
		font-size: 0.7rem;
		line-height: 1;
	}
	.delete-btn:hover {
		background: var(--background-modifier-hover);
		color: var(--text-normal);
	}
	.delete-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--background-modifier-border);
	}
	.dot-active {
		background: var(--interactive-accent);
	}
	.icon {
		width: 16px;
		height: 16px;
		display: inline-block;
	}
</style>
