<script lang="ts">
	import { onMount } from "svelte";
	import { run } from "@openai/agents";
	import type { AgentManager } from "../../agent/agent-manager";
	import type { ProviderManager } from "../../providers/provider-manager";
	import type { WorkspaceLeaf, App } from "obsidian";
	import type { Agent } from "@openai/agents";
	import type { AgentConfig } from "../../types";
	import ChatPanel from "../component/layout/ChatPanel.svelte";
	import ChatHeader from "../component/layout/ChatHeader.svelte";
	import PromptBar from "../component/input/PromptBar.svelte";
	// Session: 用于将历史作为 Agents SDK 的输入
	import type { ISession } from "../../session";
	import { createNewSession } from "../../session";

	// Props
	let {
		agentManager,
		providerManager,
		getSettings,
		workspaceLeaf,
		app,
	}: {
		agentManager: AgentManager;
		providerManager: ProviderManager;
		getSettings: () => import("../../types").PluginSettings;
		workspaceLeaf: WorkspaceLeaf;
		app: App;
	} = $props();

	// State
	let messages = $state<
		Array<{
			id: string;
			role: "user" | "assistant";
			content: string;
			timestamp: number;
		}>
	>([]);
	let selectedAgent = $state<AgentConfig | null>(null);
	let selectedModelKey = $state<string>(""); // format: `${providerId}::${modelId}`
	let isLoading = $state(false);
	let currentAgentInstance = $state<Agent | null>(null);
	let chatContainer = $state<HTMLElement>();
	let initialized = $state(false);
	let session: ISession | null = null; // 当前聊天 Session（内存优先，结束时统一落库）
	// bump this to force recomputation of derived agents list
	let agentsVersion = $state(0);

	// Derived state
	const availableAgents = $derived(
		(() => {
			agentsVersion;
			return agentManager.listAgents();
		})(),
	);
	type GroupedModel = {
		providerId: string;
		providerName: string;
		items: { key: string; label: string; modelId: string }[];
	};
	const availableModelGroups = $derived(
		(() => {
			const settings = getSettings();
			// Only include providers that are currently registered in ProviderManager
			const presentProviderIds = new Set(
				providerManager.getAllProviders().map((p) => p.getId()),
			);
			const groups: GroupedModel[] = [];
			for (const p of settings.providers) {
				if (!presentProviderIds.has(p.id)) continue;
				const items = (p.models || []).map((m) => ({
					key: `${p.id}::${m.modelId}`,
					label: m.displayName,
					modelId: m.modelId,
				}));
				groups.push({ providerId: p.id, providerName: p.name, items });
			}
			return groups;
		})(),
	);
	const canSend = $derived(
		selectedAgent !== null && selectedModelKey !== "" && !isLoading,
	);

	// Initialize component
	onMount(() => {
		initializeComponent();
		// subscribe to agent changes for immediate sync
		const unsubscribe = agentManager.subscribeAgentsChange(() => {
			// Trigger reactive updates by touching derived values
			agentsVersion += 1;
			// Re-select defaults if needed when list changes
			const agents = agentManager.listAgents();
			if (!selectedAgent && agents.length > 0) {
				selectedAgent = agents[0];
			} else if (selectedAgent) {
				// Refresh selectedAgent reference to latest snapshot
				const found = agents.find((a) => a.id === selectedAgent?.id);
				selectedAgent = found ?? agents[0] ?? null;
			}

			// Sync model selection to agent's default when valid
			if (selectedAgent) {
				const providerId = (selectedAgent as any).modelConfig?.provider;
				const modelId = (selectedAgent as any).modelConfig?.model;
				if (providerId && modelId) {
					const key = `${providerId}::${modelId}`;
					const exists = availableModelGroups.some((g) =>
						g.items.some((it) => it.key === key),
					);
					if (exists) {
						selectedModelKey = key;
					}
				}
			}
		});
		// 异步创建会话（确保每次对话都能携带完整历史进入上下文）
		void setupSession();
		return () => {
			// Cleanup: 释放会话资源（会触发一次落库保存）
			if (session) {
				void session.dispose();
			}
			// unsubscribe listener
			unsubscribe?.();
		};
	});

	// Ensure selectedModelKey stays valid when provider/model groups change
	$effect(() => {
		const validKeys = new Set<string>();
		for (const g of availableModelGroups) {
			for (const it of g.items) validKeys.add(it.key);
		}
		if (selectedModelKey && !validKeys.has(selectedModelKey)) {
			const first = availableModelGroups.find((g) => g.items.length > 0)
				?.items[0];
			selectedModelKey = first ? first.key : "";
		}
	});

	async function setupSession() {
		try {
			session = await createNewSession();
			console.log("Chat session created:", session.sessionId);
		} catch (err) {
			console.warn(
				"Failed to create chat session, fallback to stateless mode:",
				err,
			);
			session = null;
		}
	}

	function initializeComponent() {
		const agents = availableAgents;
		const groups = availableModelGroups;

		console.log("Initializing component:", { agents, groups });

		if (agents.length > 0 && !selectedAgent) {
			selectedAgent = agents[0];
			console.log("Selected default agent:", selectedAgent);
		}

		if (!selectedModelKey) {
			const first = groups.find((g) => g.items.length > 0)?.items[0];
			if (first) {
				selectedModelKey = first.key;
				console.log("Selected default model:", selectedModelKey);
			}
		}

		initialized = true;
	}

	// Create agent instance when selection or model changes
	$effect(() => {
		// Reference model key to retrigger effect on model change
		const mk = selectedModelKey;
		if (initialized && selectedAgent) {
			void createAgentInstance();
		}
	});

	// Auto-scroll when new messages are added
	$effect(() => {
		if (!chatContainer) return;

		// Reference messages length to trigger on new messages
		const messageCount = messages.length;

		// Use requestAnimationFrame for smooth scrolling
		requestAnimationFrame(() => {
			if (
				chatContainer &&
				chatContainer.scrollTop + chatContainer.clientHeight >=
					chatContainer.scrollHeight - 100
			) {
				chatContainer.scrollTo({
					top: chatContainer.scrollHeight,
					behavior: "smooth",
				});
			}
		});
	});

	async function createAgentInstance() {
		if (!selectedAgent) return;

		try {
			isLoading = true;
			// If a model is chosen in the dropdown, use it to override agent's default
			if (selectedModelKey && selectedModelKey.includes("::")) {
				const [providerId, modelId] = selectedModelKey.split("::");
				currentAgentInstance =
					await agentManager.createAgentInstanceWithModel(
						selectedAgent.id,
						providerId,
						modelId,
					);
			} else {
				currentAgentInstance = await agentManager.createAgentInstance(
					selectedAgent.id,
				);
			}
		} catch (error) {
			console.error("Failed to create agent instance:", error);
			// Could emit error event or show notification here
		} finally {
			isLoading = false;
		}
	}

	async function handleSendMessage(text: string) {
		if (!canSend || !currentAgentInstance || !selectedAgent) return;

		const userMessage = {
			id: crypto.randomUUID(),
			role: "user" as const,
			content: text,
			timestamp: Date.now(),
		};

		messages.push(userMessage);
		isLoading = true;

		try {
			// 将用户消息写入 Session（若可用）
			if (session) {
				await session.addItems([
					{ role: "user", content: text } as any,
				]);
			}

			// Create assistant message placeholder
			const assistantMessage = {
				id: crypto.randomUUID(),
				role: "assistant" as const,
				content: "",
				timestamp: Date.now(),
			};
			messages.push(assistantMessage);

			// 准备历史输入：优先从 Session 构造完整历史，否则退回本次纯文本
			let inputForRun: any = text;
			if (session) {
				try {
					inputForRun = await session.toAgentInputHistory();
				} catch (e) {
					console.warn(
						"Failed to build history from session, fallback to string:",
						e,
					);
					inputForRun = text;
				}
			}

			// Run agent with history-aware input
			const result = await run(currentAgentInstance, inputForRun);

			// Update assistant message with result
			const lastMessage = messages[messages.length - 1];
			if (lastMessage && lastMessage.role === "assistant") {
				// Extract text content from result
				const textContent = extractTextFromResult(result);
				lastMessage.content = textContent;

				// 将助手回复写入 Session（若可用）
				if (session) {
					await session.addItems([
						{
							role: "assistant",
							status: "completed",
							content: [
								{ type: "output_text", text: textContent },
							],
						} as any,
					]);
				}
			}
		} catch (error) {
			console.error("Agent run failed:", error);
			// Remove the placeholder assistant message on error
			if (
				messages[messages.length - 1]?.role === "assistant" &&
				messages[messages.length - 1]?.content === ""
			) {
				messages.pop();
			}

			// Add error message
			messages.push({
				id: crypto.randomUUID(),
				role: "assistant",
				content: `Error: ${error instanceof Error ? error.message : "Unknown error occurred"}`,
				timestamp: Date.now(),
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
		if (typeof result === "string") {
			return result;
		}

		if (result && typeof result === "object") {
			// Try to extract text from common result structures
			if (result.finalOutput) {
				return result.finalOutput;
			}

			if (result.content) {
				if (typeof result.content === "string") {
					return result.content;
				}
				if (Array.isArray(result.content)) {
					return result.content
						.filter(
							(item: any) =>
								item.type === "text" ||
								item.type === "output_text",
						)
						.map((item: any) => item.text)
						.join("");
				}
			}

			if (result.text) {
				return result.text;
			}

			if (result.message) {
				return result.message;
			}
		}

		return "No response content available";
	}

	function handleAgentChange(agent: AgentConfig) {
		selectedAgent = agent;
		// Clear messages when changing agents (optional)
		// messages = [];
	}

	// Open the Agent management view
	function handleOpenAgentView() {
		const workspace = app.workspace;
		workspace
			.getLeaf(true)
			.setViewState({ type: "cortex-agent-view", active: true });
	}
</script>

<div class="chat-view">
	<ChatHeader {isLoading} onOpenAgentManager={handleOpenAgentView} />
	<ChatPanel {messages} {isLoading} bind:container={chatContainer} />

	<PromptBar
		{availableAgents}
		modelGroups={availableModelGroups}
		{selectedAgent}
		{selectedModelKey}
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
