<script lang="ts">
	let {
		content,
		timestamp,
		renderMarkdown,
	}: {
		content: string;
		timestamp: number;
		renderMarkdown: (el: HTMLElement, md: string) => void;
	} = $props();

	const formattedTime = $derived(
		new Date(timestamp).toLocaleTimeString([], {
			hour: '2-digit',
			minute: '2-digit',
		})
	);

	// no copy button in user message; selection is enabled in CSS
	let markdownHost = $state<HTMLElement | null>(null);

	$effect(() => {
		const md = content;
		const host = markdownHost;
		if (!host) return;
		if (!md || md.trim().length === 0) return;
		renderMarkdown(host, md);
	});
</script>

<div class="user-message">
	<div class="message-header">
		<span class="user-label">You</span>
		<span class="timestamp">{formattedTime}</span>
	</div>
	<div class="message-content">
		<div class="markdown-body" bind:this={markdownHost}></div>
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

	/* no copy button in user message */

	.message-content {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
		padding: 0.75rem 1rem;
		border-radius: 1rem 1rem 0.25rem 1rem;
		user-select: text;
		overflow-x: hidden;
		overflow-wrap: anywhere;
		word-break: break-word;
		font-size: 0.9rem;
		line-height: 1.5;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
	}
	.markdown-body {
		white-space: normal;
	}
	.markdown-body :global(pre) {
		background: rgba(0, 0, 0, 0.2);
		border: 1px solid rgba(255, 255, 255, 0.2);
		padding: 0.5rem 0.75rem;
		border-radius: 0.5rem;
		/* 防止横向滚动：允许折行 */
		overflow: hidden;
		white-space: pre-wrap;
		word-break: break-word;
		overflow-wrap: anywhere;
	}
	.markdown-body :global(code) {
		background: rgba(0, 0, 0, 0.2);
		padding: 0.1rem 0.3rem;
		border-radius: 0.25rem;
		white-space: pre-wrap;
		word-break: break-word;
		overflow-wrap: anywhere;
	}
</style>
