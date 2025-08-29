<script lang="ts">
	import { onMount } from 'svelte';
	let {
		isLoading = false,
		onOpenAgentManager,
		onCreateSession,
		onToggleHistoryView,
		isHistoryOpen = false,
		setIcon,
	}: {
		isLoading: boolean;
		onOpenAgentManager: () => void;
		onCreateSession: () => void | Promise<void>;
		onToggleHistoryView: () => void;
		isHistoryOpen?: boolean;
		setIcon: (el: HTMLElement, name: string) => void;
	} = $props();
	let titleIconEl: HTMLElement;
	let createIconEl: HTMLElement;
	let historyIconEl: HTMLElement;
	let agentsIconEl: HTMLElement;
	let historyWrapperEl: HTMLElement;

	$effect(() => {
		// 使用传入的 setIcon 渲染 lucide 图标
		try {
			if (titleIconEl) setIcon?.(titleIconEl, 'message-square');
			if (createIconEl) setIcon?.(createIconEl, 'plus');
			if (historyIconEl) setIcon?.(historyIconEl, 'history');
			if (agentsIconEl) setIcon?.(agentsIconEl, 'user');
		} catch {
			/* ignore */
		}
	});

	onMount(() => {
		return () => {};
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
			await onCreateSession?.();
		}}
		disabled={isLoading}
	>
		<span class="icon" bind:this={createIconEl} aria-hidden="true"></span>
	</button>

	<!-- 历史会话按钮：切换到 HistoryView -->
	<div class="history-wrapper" bind:this={historyWrapperEl}>
		<button
			class="secondary header-icon-button {isHistoryOpen ? 'active' : ''}"
			aria-label="Conversation History"
			onclick={onToggleHistoryView}
			aria-pressed={isHistoryOpen}
			disabled={isLoading}
		>
			<span class="icon" bind:this={historyIconEl} aria-hidden="true"></span>
		</button>
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
	/* 移除下拉相关样式 */

	.header-icon-button.active {
		background: var(--background-modifier-hover);
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
