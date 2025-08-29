<script lang="ts">
	import type { App } from 'obsidian';
	import { Component, MarkdownRenderer, setIcon as setObsidianIcon } from 'obsidian';
	import { onMount } from 'svelte';
	import type { AgentManager } from '../../agent/agent-manager';
	import type { AgentService } from '../../agent/agent-service';
	import type { ProviderManager } from '../../providers/provider-manager';
	import type { SessionService } from '../../session/session-service';
	import { createChatStore, type ChatState } from '../../store/chat-store';
	import type { AgentConfig } from '../../types';
	import type { EventBus } from '../../utils/event-bus';
	import { createLogger } from '../../utils/logger';
	import PromptBar from '../component/input/PromptBar.svelte';
	import ChatHeader from '../component/layout/ChatHeader.svelte';
	import ChatPanel from '../component/layout/ChatPanel.svelte';
	import HistoryView from './HistoryView.svelte';

	const logger = createLogger('ui');

	// Props
	let {
		agentManager,
		agentService,
		providerManager,
		getSettings,
		app,
		sessionService,
		eventBus,
	}: {
		agentManager: AgentManager;
		agentService: AgentService;
		providerManager: ProviderManager;
		getSettings: () => import('../../types').PluginSettings;
		app: App; // retained for markdown rendering
		sessionService: SessionService;
		eventBus: EventBus;
	} = $props();

	// State (backed by store subscription)
	let messages = $state<ChatState['messages']>([]);
	let selectedAgent = $state<AgentConfig | null>(null);
	let selectedModelKey = $state<string>('');
	let isLoading = $state(false);
	let chatContainer = $state<HTMLElement>();
	let currentSessionId = $state<string>('');
	let sessionList = $state<Array<{ id: string; name?: string }>>([]);
	let focusInput: (() => void) | null = null;
	let mdComponent: Component | null = null;
	let availableAgents = $state<AgentConfig[]>([]);
	type GroupedModel = {
		providerId: string;
		providerName: string;
		items: { key: string; label: string; modelId: string }[];
	};
	let availableModelGroups = $state<GroupedModel[]>([]);
	let canSend = $state(false);
	let chatStore: ReturnType<typeof createChatStore> | null = null;
	let showHistoryView = $state(false);

	onMount(() => {
		try {
			mdComponent = new Component();
		} catch (e) {
			logger.warn('Failed to init markdown component', e);
		}
		chatStore = createChatStore({
			agentManager,
			agentService,
			providerManager,
			getSettings,
			sessionService,
			eventBus,
		});
		const unsubscribe = chatStore.subscribe((s) => {
			messages = s.messages;
			selectedAgent = s.selectedAgent;
			selectedModelKey = s.selectedModelKey;
			isLoading = s.isLoading;
			sessionList = s.sessionList;
			currentSessionId = s.currentSessionId;
			availableAgents = s.availableAgents;
			availableModelGroups = s.modelGroups;
			canSend = s.canSend;
		});
		return () => {
			void chatStore?.actions.dispose();
			unsubscribe();
			mdComponent?.unload?.();
		};
	});

	function renderObsidianMarkdown(el: HTMLElement, md: string) {
		if (!el) return;
		el.replaceChildren();
		const sourcePath = app.workspace.getActiveFile()?.path ?? '';
		if (!mdComponent) mdComponent = new Component();
		void MarkdownRenderer.render(app, md ?? '', el, sourcePath, mdComponent).catch((e) => {
			logger.warn('MarkdownRenderer failed', e);
		});
	}

	async function handleCreateSession() {
		await chatStore?.actions.createSession();
		showHistoryView = false;
	}
	async function handleSelectSession(id: string) {
		await chatStore?.actions.selectSession(id);
		showHistoryView = false;
	}

	async function handleSendMessage(text: string) {
		await chatStore?.actions.sendMessage(text);
		focusInput?.();
	}

	function handleModelChange(key: string) {
		chatStore?.actions.changeModel(key);
	}
	function handleAgentChange(agent: AgentConfig) {
		chatStore?.actions.changeAgent(agent.id);
	}

	function handleOpenAgentView() {
		const workspace = app.workspace;
		void workspace.getLeaf(true).setViewState({ type: 'cortex-agent-view', active: true });
	}

	function toggleHistoryView() {
		showHistoryView = !showHistoryView;
	}
</script>

<div class="chat-view">
	<ChatHeader
		{isLoading}
		onOpenAgentManager={handleOpenAgentView}
		onCreateSession={handleCreateSession}
		onToggleHistoryView={toggleHistoryView}
		isHistoryOpen={showHistoryView}
		setIcon={(el: HTMLElement, name: string) => setObsidianIcon(el, name)}
	/>

	{#if showHistoryView}
		<HistoryView
			{isLoading}
			sessions={sessionList}
			{currentSessionId}
			onSelectSession={handleSelectSession}
			onDeleteSession={(id: string) => chatStore?.actions.deleteSession(id)}
			setIcon={(el: HTMLElement, name: string) => setObsidianIcon(el, name)}
		/>
	{:else}
		<ChatPanel
			{messages}
			{isLoading}
			bind:container={chatContainer}
			renderMarkdown={renderObsidianMarkdown}
			setIcon={(el: HTMLElement, name: string) => setObsidianIcon(el, name)}
		/>

		<PromptBar
			{availableAgents}
			{availableModelGroups}
			{selectedAgent}
			{selectedModelKey}
			{canSend}
			{isLoading}
			onSendMessage={handleSendMessage}
			onAgentChange={handleAgentChange}
			onModelChange={handleModelChange}
			onReady={(api: { focusInput: () => void }) => {
				focusInput = api.focusInput;
			}}
		/>
	{/if}
</div>

<style>
	.chat-view {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--background-primary);
	}
</style>
