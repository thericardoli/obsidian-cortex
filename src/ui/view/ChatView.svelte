<script lang="ts">
	import { onMount } from "svelte";
	import { run } from "@openai/agents";
	import type { AgentManager } from "../../agent/agent-manager";
	import type { ProviderManager } from "../../providers/provider-manager";
	import {
		MarkdownRenderer,
		Component,
		setIcon as setObsidianIcon,
	} from "obsidian";
	import type { WorkspaceLeaf, App } from "obsidian";
	import type { Agent } from "@openai/agents";
	import type { AgentConfig } from "../../types";
	import ChatPanel from "../component/layout/ChatPanel.svelte";
	import ChatHeader from "../component/layout/ChatHeader.svelte";
	import PromptBar from "../component/input/PromptBar.svelte";
	// Session: 用于将历史作为 Agents SDK 的输入
	import type { ISession } from "../../session";
	import { createNewSession, getAllSessions } from "../../session";

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
			isStreaming?: boolean;
		}>
	>([]);
	let selectedAgent = $state<AgentConfig | null>(null);
	let selectedModelKey = $state<string>(""); // format: `${providerId}::${modelId}`
	let isLoading = $state(false);
	let currentAgentInstance = $state<Agent | null>(null);
	let chatContainer = $state<HTMLElement>();
	let initialized = $state(false);
	let session: ISession | null = null; // 当前聊天 Session（内存优先，结束时统一落库）
	let currentSessionId = $state<string>("");
	let sessionList = $state<Array<{ id: string; name?: string }>>([]);
	// 输入框聚焦API（由 PromptBar 暴露）
	let focusInput: (() => void) | null = null;
	// Obsidian Markdown render component lifetime
	let mdComponent: Component | null = null;

	// bump this to force recomputation of derived agents list
	let agentsVersion = $state(0);
	// bump this to force recomputation of model groups from settings/provider changes
	let modelsVersion = $state(0);

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
			// tie to version to ensure recompute when settings/providers change
			modelsVersion;
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
		// Prepare a Component for MarkdownRenderer
		try {
			mdComponent = new Component();
		} catch (e) {
			console.warn("Failed to init markdown component:", e);
		}
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

		// Listen to provider/model updates from settings and force-sync dropdowns immediately
		const onProvidersUpdated = () => {
			// Touch derived deps to recompute groups
			agentsVersion += 1;
			modelsVersion += 1;
			// Re-run initialization for defaults if needed
			initializeComponent();
		};
		// models-updated may include providerKey; just bump models version
		const onModelsUpdated = (_provId?: string) => {
			modelsVersion += 1;
			initializeComponent();
		};
		(app.workspace as any).on(
			"cortex:providers-updated",
			onProvidersUpdated,
		);
		(app.workspace as any).on("cortex:models-updated", onModelsUpdated);
		// 异步创建会话并拉取历史列表
		void setupSession();
		void refreshSessionList();
		return () => {
			// Cleanup: 释放会话资源（会触发一次落库保存）
			if (session) {
				void session.dispose();
			}
			// cleanup markdown component
			try {
				mdComponent?.unload?.();
			} catch {}
			// unsubscribe listener
			unsubscribe?.();
			(app.workspace as any).off(
				"cortex:providers-updated",
				onProvidersUpdated,
			);
			(app.workspace as any).off(
				"cortex:models-updated",
				onModelsUpdated,
			);
		};
	});
	// Provide Obsidian-style Markdown render for children
	function renderObsidianMarkdown(el: HTMLElement, md: string) {
		if (!el) return;
		el.replaceChildren();
		const sourcePath = app.workspace.getActiveFile()?.path ?? "";
		// Ensure we always pass a Component instance to MarkdownRenderer
		if (!mdComponent) {
			mdComponent = new Component();
		}
		// Prefer the non-deprecated API
		void MarkdownRenderer.render(
			app,
			md ?? "",
			el,
			sourcePath,
			mdComponent,
		).catch((e) => {
			console.warn("MarkdownRenderer failed:", e);
		});
	}

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
			currentSessionId = session.sessionId;
			console.log("Chat session created:", session.sessionId);
		} catch (err) {
			console.warn(
				"Failed to create chat session, fallback to stateless mode:",
				err,
			);
			session = null;
		}
	}

	async function refreshSessionList() {
		try {
			const rows = await getAllSessions(50);
			sessionList = rows.map((r) => ({ id: r.id, name: r.name }));
		} catch (e) {
			console.warn("Failed to load sessions:", e);
			sessionList = [];
		}
	}

	async function handleCreateSession() {
		// 结束当前会话以触发保存
		try {
			await session?.dispose();
		} catch {}
		session = await createNewSession();
		currentSessionId = session.sessionId;
		messages = [];
		await refreshSessionList();
	}

	async function handleSelectSession(id: string) {
		if (!id || id === currentSessionId) return;
		// 保存当前会话
		try {
			await session?.dispose();
		} catch {}
		// 加载目标会话（session-manager 会从DB加载到内存）
		try {
			const { getSession } = await import("../../session");
			const target = await getSession(id);
			if (target) {
				session = target;
				currentSessionId = id;
				// 映射历史到UI消息
				const items = await session.getItems();
				messages = items
					.filter(
						(it: any) =>
							it &&
							it.role &&
							(it.role === "user" || it.role === "assistant"),
					)
					.map((it: any) => ({
						id: crypto.randomUUID(),
						role: it.role,
						content:
							typeof it.content === "string"
								? it.content
								: Array.isArray(it.content)
									? it.content
											.map((p: any) => p.text ?? "")
											.join("")
									: "",
						timestamp: Date.now(),
					})) as any;
			} else {
				console.warn("Target session not found, creating a new one.");
				session = await createNewSession();
				currentSessionId = session.sessionId;
				messages = [];
			}
		} catch (e) {
			console.warn("Failed to switch session:", e);
		}
		await refreshSessionList();
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
				isStreaming: true,
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

			// 启用真正的事件级流式输出
			const stream = await run(currentAgentInstance, inputForRun, { stream: true } as any);
			const lastMessage = messages[messages.length - 1];
			let accumulated = "";
			if (lastMessage && lastMessage.role === "assistant") {
				try {
					// 优先使用异步可迭代事件（官方推荐）
					if (typeof (stream as any)[Symbol.asyncIterator] === "function") {
						for await (const ev of stream as any) {
							// 适配多种 delta 事件结构
							// 1) 直接的文本增量：{ type: 'output_text_delta', delta: '...' }
							if (
								ev?.type === "raw_model_stream_event" &&
								ev.data && typeof ev.data === "object"
							) {
								const d: any = ev.data;
								// 1a) 顶层 output_text_delta
								if (d.type === "output_text_delta" && typeof d.delta === "string") {
									accumulated += d.delta;
									lastMessage.content = accumulated;
									continue;
								}
								// 1b) 包装在 model 事件里的 { type:'model', event:{ type:'response.output_text.delta' | 'output_text.delta' | 'output_text_delta', delta:string } }
								const inner = d.event;
								const t = inner?.type;
								if (
									(inner && typeof inner.delta === "string") &&
									(
										t === "response.output_text.delta" ||
										t === "output_text.delta" ||
										t === "output_text_delta"
									)
								) {
									accumulated += inner.delta as string;
									lastMessage.content = accumulated;
									continue;
								}
							}
						}
					} else {
						// 退回到文本流（部分环境/代理不支持事件分发时可能只在完成后吐出）
						try {
							const textStream: ReadableStream<string> = (stream as any).toTextStream();
							const reader = textStream.getReader();
							for (;;) {
								const { value, done } = await reader.read();
								if (done) break;
								if (typeof value === "string" && value.length > 0) {
									accumulated += value;
									lastMessage.content = accumulated;
								}
							}
						} catch {}
					}

					// 保底：若仍无增量，使用最终输出
					if (!accumulated || accumulated.length === 0) {
						const fallback = (stream as any)?.finalOutput ?? "";
						lastMessage.content =
							typeof fallback === "string"
								? fallback
								: extractTextFromResult(stream);
					}
					// 标记流式完成
					(lastMessage as any).isStreaming = false;
				} catch (e) {
					console.warn("streaming failed, fallback to final output if available", e);
					const fallback = (stream as any)?.finalOutput ?? "";
					lastMessage.content =
						typeof fallback === "string"
							? fallback
							: extractTextFromResult(stream);
					(lastMessage as any).isStreaming = false;
				}

				// 将助手最终回复写入 Session（若可用）
				if (session) {
					const finalText = lastMessage.content ?? accumulated;
					await session.addItems([
						{
							role: "assistant",
							status: "completed",
							content: [{ type: "output_text", text: finalText }],
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
			// 结束后将光标放回输入框
			try {
				focusInput?.();
			} catch {}
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
	<ChatHeader
		{isLoading}
		onOpenAgentManager={handleOpenAgentView}
		onCreateSession={handleCreateSession}
		sessions={sessionList}
		{currentSessionId}
		onSelectSession={handleSelectSession}
		setIcon={(el: HTMLElement, name: string) => setObsidianIcon(el, name)}
	/>
	<ChatPanel
		{messages}
		{isLoading}
		bind:container={chatContainer}
		renderMarkdown={renderObsidianMarkdown}
		setIcon={(el: HTMLElement, name: string) => setObsidianIcon(el, name)}
	/>

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
		onReady={(api: { focusInput: () => void }) => {
			focusInput = api.focusInput;
		}}
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
