<script lang="ts">
	import { onMount } from 'svelte';
	let {
		isLoading = false,
		onOpenAgentManager,
		onCreateSession,
		sessions = [] as Array<{ id: string; name?: string }>,
		currentSessionId = '',
		onSelectSession,
		onDeleteSession,
		setIcon,
	}: {
		isLoading: boolean;
		onOpenAgentManager: () => void;
		onCreateSession: () => void | Promise<void>;
		sessions?: Array<{ id: string; name?: string }>;
		currentSessionId?: string;
		onSelectSession: (id: string) => void;
		onDeleteSession: (id: string) => void | Promise<void>;
		setIcon: (el: HTMLElement, name: string) => void;
	} = $props();

	// 本地 UI 状态：是否展示会话历史下拉
	let showHistory = $state(false);

	function toggleHistory() {
		showHistory = !showHistory;
	}

	function handleSelectSession(id: string) {
		showHistory = false;
		onSelectSession?.(id);
	}
	let titleIconEl: HTMLElement;
	let createIconEl: HTMLElement;
	let historyIconEl: HTMLElement;
	let agentsIconEl: HTMLElement;

	$effect(() => {
		// 使用传入的 setIcon 渲染 lucide 图标
		try {
			if (titleIconEl) setIcon?.(titleIconEl, 'message-square');
			if (createIconEl) setIcon?.(createIconEl, 'plus');
			if (historyIconEl) setIcon?.(historyIconEl, 'history');
			if (agentsIconEl) setIcon?.(agentsIconEl, 'user');
		} catch (e) {
			// 忽略渲染图标失败
		}
	});
</script>

<div class="chat-header">
	<div class="title">
		<span class="icon title-icon" bind:this={titleIconEl} aria-hidden="true"></span>
		Cortex Chat
	</div>
	<div class="spacer"></div>

	<!-- 新建会话按钮 -->
	<button
		class="secondary header-icon-button"
		aria-label="New Conversation"
		onclick={async () => {
			if (isLoading) return;
			showHistory = false;
			try {
				await onCreateSession?.();
			} finally {
				showHistory = false;
			}
		}}
		disabled={isLoading}
	>
		<span class="icon" bind:this={createIconEl} aria-hidden="true"></span>
	</button>

	<!-- 历史会话按钮及下拉 -->
	<div class="history-wrapper">
		<button
			class="secondary header-icon-button"
			aria-label="Conversation History"
			onclick={toggleHistory}
			disabled={isLoading}
		>
			<span class="icon" bind:this={historyIconEl} aria-hidden="true"></span>
		</button>
		{#if showHistory}
			<div class="history-dropdown" role="listbox">
				{#if sessions.length === 0}
					<div class="history-empty">Empty History</div>
				{:else}
					{#each sessions as s}
						<div
							class="history-row {currentSessionId === s.id ? 'active' : ''}"
							title={s.id}
						>
							<button class="history-item" onclick={() => handleSelectSession(s.id)}>
								<span class="dot {currentSessionId === s.id ? 'dot-active' : ''}"
								></span>
								{s.name && s.name.trim() ? s.name : s.id}
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
								✕
							</button>
						</div>
					{/each}
				{/if}
			</div>
		{/if}
	</div>
	<button
		class="secondary agents-button"
		onclick={onOpenAgentManager}
		aria-label="Manage Agents"
		disabled={isLoading}
	>
		<span class="icon" bind:this={agentsIconEl} aria-hidden="true"></span>
		<span>Agents</span>
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
		width: 16px;
		height: 16px;
	}
	.spacer {
		flex: 1;
	}
	.icon {
		width: 16px;
		height: 16px;
		display: inline-block;
	}
	.header-icon-button {
		padding: 0.35rem;
		border: 1px solid var(--background-modifier-border);
		border-radius: 0.5rem;
		background: var(--background-secondary);
		color: var(--text-normal);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}
	.header-icon-button:hover {
		background: var(--background-modifier-hover);
	}
	.header-icon-button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.history-wrapper {
		position: relative;
	}
	.history-dropdown {
		position: absolute;
		right: 0;
		top: calc(100% + 6px);
		min-width: 220px;
		max-height: 280px;
		overflow: auto;
		padding: 0.375rem;
		border: 1px solid var(--background-modifier-border);
		border-radius: 0.5rem;
		background: var(--background-primary);
		box-shadow: 0 6px 18px rgba(0, 0, 0, 0.2);
		z-index: 10;
	}
	.history-empty {
		padding: 0.5rem;
		opacity: 0.7;
	}
	.history-item {
		width: 100%;
		text-align: left;
		padding: 0.4rem 0.5rem;
		border-radius: 0.375rem;
		border: none;
		background: transparent;
		color: var(--text-normal);
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
	}
	.history-item:hover {
		background: var(--background-modifier-hover);
	}
	/* 历史行与激活态 */
	.history-row {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}
	.history-row.active .history-item {
		font-weight: 600;
		background: var(--background-modifier-hover);
	}
	.delete-btn {
		border: none;
		background: transparent;
		color: var(--text-faint);
		cursor: pointer;
		padding: 0.25rem;
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
