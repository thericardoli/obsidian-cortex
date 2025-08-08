<script lang="ts">
	import { copyToClipboard } from "../../utils/clipboard";

	let {
		content,
		timestamp,
		renderMarkdown,
		setIcon,
	}: {
		content: string;
		timestamp: number;
		renderMarkdown: (el: HTMLElement, md: string) => void;
		setIcon?: (el: HTMLElement, name: string) => void;
	} = $props();

	const formattedTime = $derived(
		new Date(timestamp).toLocaleTimeString([], {
			hour: "2-digit",
			minute: "2-digit",
		}),
	);

	let copied = $state(false);
	let markdownHost = $state<HTMLElement | null>(null);
	let copyIconEl = $state<HTMLElement | null>(null);
	let copyIconSuccessEl = $state<HTMLElement | null>(null);

	async function handleCopy() {
		const ok = await copyToClipboard(content);
		if (ok) {
			copied = true;
			setTimeout(() => (copied = false), 1500);
		}
	}

	$effect(() => {
		const md = content;
		const host = markdownHost;
		if (!host) return;
		if (!md || md.trim().length === 0) return;
		renderMarkdown(host, md);

		// After markdown renders, normalize any code-block copy buttons' icons
		// to use Obsidian's setIcon for consistent appearance (incl. Lucide).
		queueMicrotask(() => {
			if (!host) return;
			const selector = [
				".copy-code-button",
				".codeblock-copy",
				".code-block-copy",
				".copy-code",
			].join(",");
			const buttons = host.querySelectorAll(selector);
			buttons.forEach((btn) => {
				const el = btn as HTMLElement;
				if (el.dataset.iconInited === "1") return;
				el.dataset.iconInited = "1";
				try {
					// Clear existing children to avoid duplicate icons/text
					el.replaceChildren();
					if (setIcon) {
						setIcon(el, "copy");
					}
					el.setAttribute("title", "复制代码");
					el.setAttribute("aria-label", "复制代码");
				} catch (e) {
					console.warn("Failed to set icon for code copy button", e);
				}
			});
		});
	});

	// Render icons via Obsidian setIcon for unified style
	$effect(() => {
		if (setIcon && copyIconEl) {
			setIcon(copyIconEl, "copy");
		}
		if (setIcon && copyIconSuccessEl) {
			setIcon(copyIconSuccessEl, "check");
		}
	});
</script>

<div class="assistant-message">
	<div class="message-header">
		<span class="assistant-label">Assistant</span>
		<span class="timestamp">{formattedTime}</span>
	</div>
	<div class="message-content">
		{#if content && content.trim().length > 0}
			<div class="markdown-body" bind:this={markdownHost}></div>
			<button
				class="copy-icon-btn copy-code-button"
				title="复制"
				onclick={handleCopy}
				aria-label="复制AI回复"
				class:copied
			>
				<span
					class="am-icon am-icon-copy"
					aria-hidden="true"
					bind:this={copyIconEl}
				></span>
				<span
					class="am-icon am-icon-success"
					aria-hidden="true"
					bind:this={copyIconSuccessEl}
				></span>
			</button>
		{:else}
			<div class="thinking-placeholder">Thinking...</div>
		{/if}
	</div>
</div>

<style>
	.assistant-message {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		max-width: 80%;
		margin-right: auto;
	}

	.message-header {
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

	.timestamp {
		font-size: 0.75rem;
	}

	.copy-icon-btn {
		position: absolute;
		top: 6px;
		right: 6px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		border: 1px solid var(--background-modifier-border);
		background: var(--background-primary);
		color: var(--text-muted);
		border-radius: 6px;
		cursor: pointer;
		opacity: 0.9;
	}
	.copy-icon-btn:hover {
		color: var(--text-normal);
		border-color: var(--interactive-accent);
		opacity: 1;
	}
	/* icon toggling for main copy button, icons rendered via setIcon() */
	.am-icon {
		display: none;
		width: 16px;
		height: 16px;
	}
	.copy-icon-btn .am-icon-copy {
		display: inline-block;
	}
	.copy-icon-btn.copied .am-icon-copy {
		display: none;
	}
	.copy-icon-btn.copied .am-icon-success {
		display: inline-block;
	}

	.message-content {
		background: var(--background-secondary);
		color: var(--text-normal);
		padding: 0.75rem 1rem;
		border-radius: 1rem 1rem 1rem 0.25rem;
		position: relative;
		padding-right: 2rem; /* 给右上角的复制按钮留出空间 */
		user-select: text;
		overflow-x: hidden;
		overflow-wrap: anywhere;
		word-break: break-word;
		font-size: 0.9rem;
		line-height: 1.5;
		border: 1px solid var(--background-modifier-border);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
	}

	/* Markdown base within assistant content */
	.markdown-body {
		white-space: normal;
	}

	.markdown-body :global(pre) {
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		padding: 0.5rem 0.75rem;
		border-radius: 0.5rem;
		/* 防止横向滚动：允许折行 */
		overflow: hidden;
		white-space: pre-wrap;
		word-break: break-word;
		overflow-wrap: anywhere;
		position: relative; /* 为右上角复制按钮定位 */
	}
	.markdown-body :global(code) {
		background: var(--background-primary);
		padding: 0.1rem 0.3rem;
		border-radius: 0.25rem;
		white-space: pre-wrap;
		word-break: break-word;
		overflow-wrap: anywhere;
	}
	.markdown-body :global(a) {
		color: var(--text-accent);
		text-decoration: underline;
	}
	.markdown-body :global(ul),
	.markdown-body :global(ol) {
		padding-left: 1.25rem;
	}

	.thinking-placeholder {
		color: var(--text-muted);
		font-style: italic;
	}
</style>
