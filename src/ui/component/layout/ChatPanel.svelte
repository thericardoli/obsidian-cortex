<script lang="ts">
	import UserMessage from '../message/UserMessage.svelte';
	import AssistantMessage from '../message/AssistantMessage.svelte';
	import LoadingIndicator from '../feedback/LoadingIndicator.svelte';

	type Message = {
		id: string;
		role: 'user' | 'assistant';
		content: string;
		timestamp: number;
		isStreaming?: boolean;
	};

	let {
		messages = [],
		isLoading = false,
		container = $bindable(),
		renderMarkdown,
		setIcon,
	}: {
		messages: Message[];
		isLoading: boolean;
		container?: HTMLElement;
		renderMarkdown: (el: HTMLElement, md: string) => void;
		setIcon?: (el: HTMLElement, name: string) => void;
	} = $props();

	// Auto-scroll management (stick to bottom when user hasn't scrolled up)
	let messagesEl: HTMLElement | null = null;
	let bottomAnchor: HTMLDivElement | null = null;
	let stickToBottom = $state(true);

	// 检查是否有正在流式输出的assistant消息
	const hasStreamingAssistant = $derived(
		messages.some((msg) => msg.role === 'assistant' && msg.isStreaming)
	);

	function isNearBottom(el: HTMLElement) {
		return el.scrollTop + el.clientHeight >= el.scrollHeight - 120;
	}

	function scrollToBottom(behavior: ScrollBehavior = 'auto') {
		if (!container) return;
		container.scrollTo({ top: container.scrollHeight, behavior });
	}

	$effect(() => {
		// Track user scroll to enable/disable sticky mode
		const el = container;
		if (!el) return;
		const onScroll = () => {
			stickToBottom = isNearBottom(el);
		};
		el.addEventListener('scroll', onScroll, { passive: true });
		return () => el.removeEventListener('scroll', onScroll);
	});

	$effect(() => {
		// When messages count changes, try scrolling if sticky
		const _len = messages.length;
		void _len;
		if (!container) return;
		queueMicrotask(() => {
			if (stickToBottom) scrollToBottom('smooth');
		});
	});

	$effect(() => {
		// Also react to loading spinner (often appears while output grows)
		const _loading = isLoading;
		void _loading;
		if (!container) return;
		queueMicrotask(() => {
			if (stickToBottom) scrollToBottom('smooth');
		});
	});

	// Observe content size changes to keep sticky scroll during streaming/delta updates
	$effect(() => {
		const target = messagesEl ?? container;
		if (!target) return;
		let ro: ResizeObserver | null = null;
		try {
			ro = new ResizeObserver(() => {
				if (stickToBottom) scrollToBottom('auto');
			});
			ro.observe(target);
		} catch (e) {
			void e;
		}
		return () => {
			try {
				ro?.disconnect();
			} catch (e) {
				void e;
			}
		};
	});
</script>

<div class="chat-panel" bind:this={container}>
	<div class="messages-container" bind:this={messagesEl}>
		{#each messages as message (message.id)}
			{#if message.role === 'user'}
				<UserMessage
					content={message.content}
					timestamp={message.timestamp}
					{renderMarkdown}
				/>
			{:else}
				<AssistantMessage
					content={message.content}
					timestamp={message.timestamp}
					streaming={!!message.isStreaming}
					{renderMarkdown}
					{setIcon}
				/>
			{/if}
		{/each}

		{#if isLoading && !hasStreamingAssistant}
			<LoadingIndicator />
		{/if}
		<!-- anchor used for scrollIntoView if needed in future -->
		<div bind:this={bottomAnchor} style="height:1px;width:100%"></div>
	</div>
</div>

<style>
	.chat-panel {
		flex: 1;
		overflow-y: auto;
		padding: 1rem;
		padding-right: 0.5rem; /* 减少右侧内边距为滚动条留出空间 */
		background: var(--background-primary);
		box-sizing: border-box;
	}

	.messages-container {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		max-width: 100%;
	}

	/* Scrollbar styling for consistency with Obsidian - positioned inside */
	.chat-panel {
		scrollbar-gutter: stable;
	}

	.chat-panel::-webkit-scrollbar {
		width: 8px;
		background: transparent;
	}

	.chat-panel::-webkit-scrollbar-track {
		background: transparent;
		margin: 4px;
	}

	.chat-panel::-webkit-scrollbar-thumb {
		background: var(--background-modifier-border);
		border-radius: 4px;
		border: 1px solid var(--background-primary);
		background-clip: padding-box;
	}

	.chat-panel::-webkit-scrollbar-thumb:hover {
		background: var(--text-muted);
		border: 1px solid var(--background-primary);
		background-clip: padding-box;
	}

	.chat-panel::-webkit-scrollbar-corner {
		background: transparent;
	}
</style>
