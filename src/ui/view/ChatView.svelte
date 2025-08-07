<script lang="ts">
	import { onMount } from 'svelte';
	import { run } from '@openai/agents';
	import type { AgentManager } from '../../agent/agent-manager';
    import type { ProviderManager } from '../../providers/provider-manager';
    import type { WorkspaceLeaf, App } from 'obsidian';
    import type { Agent } from '@openai/agents';
    import type { AgentConfig } from '../../types';
    import ChatPanel from '../component/layout/ChatPanel.svelte';
    import PromptBar from '../component/input/PromptBar.svelte';

	// Props
    let { 
        agentManager,
        providerManager,
        getSettings,
        workspaceLeaf,
        app
    }: {
        agentManager: AgentManager;
        providerManager: ProviderManager;
        getSettings: () => import('../../types').PluginSettings;
        workspaceLeaf: WorkspaceLeaf;
        app: App;
    } = $props();

	// State
	let messages = $state<Array<{ id: string; role: 'user' | 'assistant'; content: string; timestamp: number }>>([]);
	let selectedAgent = $state<AgentConfig | null>(null);
    let selectedModelKey = $state<string>(''); // format: `${providerId}::${modelId}`
	let isLoading = $state(false);
	let currentAgentInstance = $state<Agent | null>(null);
	let chatContainer = $state<HTMLElement>();
	let initialized = $state(false);

	// Derived state
	const availableAgents = $derived(agentManager.listAgents());
    type GroupedModel = { providerId: string; providerName: string; items: { key: string; label: string; modelId: string }[] };
    const availableModelGroups = $derived((() => {
        const settings = getSettings();
        const groups: GroupedModel[] = [];
        for (const p of settings.providers) {
            const items = (p.models || []).map(m => ({
                key: `${p.id}::${m.modelId}`,
                label: m.displayName,
                modelId: m.modelId,
            }));
            groups.push({ providerId: p.id, providerName: p.name, items });
        }
        return groups;
    })());
    const canSend = $derived(selectedAgent !== null && selectedModelKey !== '' && !isLoading);

	// Initialize component
	onMount(() => {
		initializeComponent();
		return () => {
			// Cleanup if needed
		};
	});

	function initializeComponent() {
		const agents = availableAgents;
        const groups = availableModelGroups;
		
        console.log('Initializing component:', { agents, groups });
		
		if (agents.length > 0 && !selectedAgent) {
			selectedAgent = agents[0];
			console.log('Selected default agent:', selectedAgent);
		}
		
        if (!selectedModelKey) {
            const first = groups.find(g => g.items.length > 0)?.items[0];
            if (first) {
                selectedModelKey = first.key;
                console.log('Selected default model:', selectedModelKey);
            }
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
            // If a model is chosen in the dropdown, use it to override agent's default
            if (selectedModelKey && selectedModelKey.includes('::')) {
                const [providerId, modelId] = selectedModelKey.split('::');
                currentAgentInstance = await agentManager.createAgentInstanceWithModel(selectedAgent.id, providerId, modelId);
            } else {
                currentAgentInstance = await agentManager.createAgentInstance(selectedAgent.id);
            }
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

    function handleModelChange(key: string) {
        selectedModelKey = key;
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

    // Removed provider change handler; provider is implied by selected model

	function handleOpenAgentView() {
		// Get the workspace and open agent view
		const workspace = app.workspace;
		workspace.getLeaf(true).setViewState({
			type: 'cortex-agent-view',
			active: true
		});
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
        modelGroups={availableModelGroups}
        {selectedAgent}
        selectedModelKey={selectedModelKey}
        {canSend}
        {isLoading}
        onSendMessage={handleSendMessage}
        onAgentChange={handleAgentChange}
        onModelChange={handleModelChange}
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
