<script lang="ts">
	import { tick, onMount } from 'svelte';
	import { run } from '@openai/agents';
	import type { AgentManager } from '../../agent/agent-manager';
	import type { ProviderManager } from '../../providers/provider-manager';
	import type { WorkspaceLeaf } from 'obsidian';
	import type { Agent } from '@openai/agents';
	import type { AgentConfig } from '../../types';
	import ChatPanel from '../component/layout/ChatPanel.svelte';
	import PromptBar from '../component/input/PromptBar.svelte';

	// Props
	let { 
		agentManager,
		providerManager,
		workspaceLeaf
	}: {
		agentManager: AgentManager;
		providerManager: ProviderManager;
		workspaceLeaf: WorkspaceLeaf;
	} = $props();

	// State
	let messages = $state<Array<{ id: string; role: 'user' | 'assistant'; content: string; timestamp: number }>>([]);
	let selectedAgent = $state<AgentConfig | null>(null);
	let selectedProvider = $state<string>('');
	let isLoading = $state(false);
	let currentAgentInstance = $state<Agent | null>(null);
	let chatContainer = $state<HTMLElement>();
	let initialized = $state(false);

	// Derived state
	const availableAgents = $derived(agentManager.listAgents());
	const availableProviders = $derived(providerManager.getEnabledProviders().map(p => ({
		id: p.getId(),
		name: p.getName()
	})));
	const canSend = $derived(selectedAgent !== null && selectedProvider !== '' && !isLoading);

	// Initialize component
	onMount(() => {
		initializeComponent();
		return () => {
			// Cleanup if needed
		};
	});

	function initializeComponent() {
		const agents = availableAgents;
		const providers = availableProviders;
		
		console.log('Initializing component:', { agents, providers });
		
		if (agents.length > 0 && !selectedAgent) {
			selectedAgent = agents[0];
			console.log('Selected default agent:', selectedAgent);
		}
		
		if (providers.length > 0 && !selectedProvider) {
			selectedProvider = providers[0].id;
			console.log('Selected default provider:', selectedProvider);
		}

		initialized = true;
	}

	// Create agent instance when selection changes
	$effect(() => {
		if (initialized && selectedAgent) {
			createAgentInstance();
		}
	});

	// Auto-scroll when new messages are added
	$effect(() => {
		if (!chatContainer) return;
		
		// Reference messages length to trigger on new messages
		const messageCount = messages.length;
		
		// Use requestAnimationFrame for smooth scrolling
		requestAnimationFrame(() => {
			if (chatContainer && chatContainer.scrollTop + chatContainer.clientHeight >= chatContainer.scrollHeight - 100) {
				chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
			}
		});
	});

	async function createAgentInstance() {
		if (!selectedAgent) return;
		
		try {
			isLoading = true;
			currentAgentInstance = await agentManager.createAgentInstance(selectedAgent.id);
		} catch (error) {
			console.error('Failed to create agent instance:', error);
			// Could emit error event or show notification here
		} finally {
			isLoading = false;
		}
	}

	async function handleSendMessage(text: string) {
		if (!canSend || !currentAgentInstance || !selectedAgent) return;

		const userMessage = {
			id: crypto.randomUUID(),
			role: 'user' as const,
			content: text,
			timestamp: Date.now()
		};

		messages.push(userMessage);
		isLoading = true;

		try {
			// Create assistant message placeholder
			const assistantMessage = {
				id: crypto.randomUUID(),
				role: 'assistant' as const,
				content: '',
				timestamp: Date.now()
			};
			messages.push(assistantMessage);

			// Run agent using the global run function
			const result = await run(currentAgentInstance, text);

			// Update assistant message with result
			const lastMessage = messages[messages.length - 1];
			if (lastMessage && lastMessage.role === 'assistant') {
				// Extract text content from result
				const textContent = extractTextFromResult(result);
				lastMessage.content = textContent;
			}

		} catch (error) {
			console.error('Agent run failed:', error);
			// Remove the placeholder assistant message on error
			if (messages[messages.length - 1]?.role === 'assistant' && messages[messages.length - 1]?.content === '') {
				messages.pop();
			}
			
			// Add error message
			messages.push({
				id: crypto.randomUUID(),
				role: 'assistant',
				content: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
				timestamp: Date.now()
			});
		} finally {
			isLoading = false;
		}
	}

	function extractTextFromResult(result: any): string {
		// Handle different result formats from OpenAI Agents SDK
		if (typeof result === 'string') {
			return result;
		}
		
		if (result && typeof result === 'object') {
			// Try to extract text from common result structures
			if (result.finalOutput) {
				return result.finalOutput;
			}
			
			if (result.content) {
				if (typeof result.content === 'string') {
					return result.content;
				}
				if (Array.isArray(result.content)) {
					return result.content
						.filter((item: any) => item.type === 'text' || item.type === 'output_text')
						.map((item: any) => item.text)
						.join('');
				}
			}
			
			if (result.text) {
				return result.text;
			}
			
			if (result.message) {
				return result.message;
			}
		}
		
		return 'No response content available';
	}

	function handleAgentChange(agent: AgentConfig) {
		selectedAgent = agent;
		// Clear messages when changing agents (optional)
		// messages = [];
	}

	function handleProviderChange(providerId: string) {
		selectedProvider = providerId;
		// Recreate agent instance with new provider if needed
		if (selectedAgent) {
			createAgentInstance();
		}
	}
</script>

<div class="chat-view">
	<ChatPanel 
		{messages} 
		{isLoading}
		bind:container={chatContainer}
	/>
	
	<PromptBar
		availableAgents={availableAgents}
		availableProviders={availableProviders}
		{selectedAgent}
		{selectedProvider}
		{canSend}
		{isLoading}
		onSendMessage={handleSendMessage}
		onAgentChange={handleAgentChange}
		onProviderChange={handleProviderChange}
	/>
</div>

<style>
	.chat-view {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--background-primary);
	}
</style>
