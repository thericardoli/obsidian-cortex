<script lang="ts">
	import { onMount } from "svelte";
	import type { App, WorkspaceLeaf } from "obsidian";
	import type { AgentManager } from "../../agent/agent-manager";
	import type { ProviderManager } from "../../providers/provider-manager";
	import type {
		AgentConfig,
		AgentConfigInput,
		ModelSettings,
	} from "../../types";

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

	type ProviderModel = { modelId: string; displayName: string };
	type ProviderGroup = { id: string; name: string; models: ProviderModel[] };

	// state
	let isLoading = $state(false);
	let providers = $state<ProviderGroup[]>([]);
	let agents = $state<AgentConfig[]>([]);
	let selectedAgentId = $state<string | null>(null);
	let isCreating = $state(false);

	type EditableAgent = {
		id?: string;
		name: string;
		instructions: string;
		providerId: string;
		modelId: string;
		settings: Partial<ModelSettings>;
	};

	let form = $state<EditableAgent | null>(null);

	const selectedAgent = $derived(
		agents.find((a) => a.id === selectedAgentId) || null,
	);

	const canSave = $derived(() => {
		if (!form) return false;
		return (
			!!form.name?.trim() &&
			!!form.instructions?.trim() &&
			!!form.providerId &&
			!!form.modelId &&
			!isLoading
		);
	});

	const currentProviderModels: ProviderModel[] = $derived(
		(() => {
			const f = form;
			if (!f) return [] as ProviderModel[];
			const p = providers.find((p) => p.id === f.providerId);
			return p?.models ?? [];
		})(),
	);

	onMount(() => {
		refreshProviders();
		refreshAgents();
	});

	function refreshProviders() {
		const settings = getSettings();
		providers = (settings.providers || []).map((p) => ({
			id: p.id,
			name: p.name,
			models: (p.models || []).map((m) => ({
				modelId: m.modelId,
				displayName: m.displayName,
			})),
		}));
	}

	function refreshAgents() {
		agents = agentManager.listAgents();
		if (agents.length > 0 && !selectedAgentId && !isCreating) {
			selectedAgentId = agents[0].id;
			loadAgentIntoForm(agents[0]);
		}
	}

	function loadAgentIntoForm(agent: AgentConfig) {
		isCreating = false;
		form = {
			id: agent.id,
			name: agent.name,
			instructions: agent.instructions,
			providerId: agent.modelConfig.provider,
			modelId: agent.modelConfig.model,
			settings: { ...agent.modelConfig.settings },
		};
	}

	function handleSelectAgent(id: string) {
		selectedAgentId = id;
		const a = agents.find((x) => x.id === id);
		if (a) loadAgentIntoForm(a);
	}

	function handleCreateNew() {
		isCreating = true;
		selectedAgentId = null;
		// choose first provider/model if available
		const firstProvider = providers[0];
		const firstModel = firstProvider?.models?.[0];
		form = {
			name: "",
			instructions: "",
			providerId: firstProvider?.id || "",
			modelId: firstModel?.modelId || "",
			settings: {
				temperature: 0.7,
				toolChoice: "auto",
				parallelToolCalls: false,
			},
		};
	}

	async function handleSave() {
		if (!form) return;
		isLoading = true;
		try {
			if (isCreating) {
				const payload: AgentConfigInput = {
					name: form.name.trim(),
					instructions: form.instructions.trim(),
					modelConfig: {
						provider: form.providerId,
						model: form.modelId,
						settings: sanitizeSettings(form.settings),
					},
					tools: [],
					inputGuardrails: [],
					outputGuardrails: [],
					mcpServers: [],
				};
				const created = await agentManager.createAgent(payload);
				refreshAgents();
				selectedAgentId = created.id;
				loadAgentIntoForm(created);
				isCreating = false;
			} else if (form.id) {
				await agentManager.updateAgent(form.id, {
					name: form.name.trim(),
					instructions: form.instructions.trim(),
					modelConfig: {
						provider: form.providerId,
						model: form.modelId,
						settings: sanitizeSettings(form.settings),
					},
				});
				refreshAgents();
			}
		} catch (e) {
			console.error("Failed to save agent", e);
		} finally {
			isLoading = false;
		}
	}

	async function handleDelete() {
		if (!selectedAgent || !selectedAgent.id) return;
		if (!confirm(`Delete agent "${selectedAgent.name}"?`)) return;
		isLoading = true;
		try {
			await agentManager.deleteAgent(selectedAgent.id);
			refreshAgents();
			// reset selection
			if (agents.length > 0) {
				selectedAgentId = agents[0].id;
				loadAgentIntoForm(agents[0]);
			} else {
				selectedAgentId = null;
				form = null;
			}
		} catch (e) {
			console.error("Failed to delete agent", e);
		} finally {
			isLoading = false;
		}
	}

	function sanitizeSettings(s: Partial<ModelSettings>): ModelSettings {
		const out: any = {};
		if (s.temperature !== undefined)
			out.temperature = Number(s.temperature);
		if (s.maxTokens !== undefined) out.maxTokens = Number(s.maxTokens);
		if (s.topP !== undefined) out.topP = Number(s.topP);
		if (s.frequencyPenalty !== undefined)
			out.frequencyPenalty = Number(s.frequencyPenalty);
		if (s.presencePenalty !== undefined)
			out.presencePenalty = Number(s.presencePenalty);
		if (s.toolChoice !== undefined) out.toolChoice = s.toolChoice as any;
		if (s.parallelToolCalls !== undefined)
			out.parallelToolCalls = Boolean(s.parallelToolCalls);
		return out as ModelSettings;
	}

	function handleProviderChange(id: string) {
		if (!form) return;
		form.providerId = id;
		const firstModel = providers.find((p) => p.id === id)?.models?.[0]?.modelId || "";
		form.modelId = firstModel;
	}

	function handleModelChange(id: string) {
		if (!form) return;
		form.modelId = id;
	}

	// 当 provider 或 providers 列变化时，如果当前 modelId 为空或不再存在，则回填第一个模型
	$effect(() => {
		const f = form;
		if (!f) return;
		const prov = providers.find((p) => p.id === f.providerId);
		if (!prov) return;
		const exists = prov.models.some((m) => m.modelId === f.modelId);
		if (!exists) {
			f.modelId = prov.models[0]?.modelId || "";
		}
	});
</script>

<div class="agent-view">
	<div class="sidebar">
		<div class="header">
			<h3>Agents</h3>
			<button
				class="primary"
				onclick={handleCreateNew}
				disabled={isLoading}>New</button
			>
		</div>
		<ul class="agent-list">
			{#each agents as a (a.id)}
				<li class:selected={a.id === selectedAgentId}>
					<button
						type="button"
						class="agent-item"
						onclick={() => handleSelectAgent(a.id)}
					>
						<div class="name">{a.name}</div>
					</button>
				</li>
			{/each}
			{#if agents.length === 0}
				<li class="empty">No agents yet. Create one →</li>
			{/if}
		</ul>
	</div>

	<div class="editor">
		{#if form}
			<div class="form-grid">
				<label for="agent-name">Name</label>
				<input
					id="agent-name"
					type="text"
					value={form.name}
					oninput={(e) =>
						form &&
						(form.name = (e.target as HTMLInputElement).value)}
					placeholder="Agent name"
				/>

				<label for="agent-instructions">Instructions</label>
				<textarea
					id="agent-instructions"
					rows="6"
					value={form.instructions}
					oninput={(e) =>
						form &&
						(form.instructions = (
							e.target as HTMLTextAreaElement
						).value)}
					placeholder="System instructions for the agent"
				></textarea>

				<label for="agent-provider">Provider</label>
				<select
					id="agent-provider"
					bind:value={form.providerId}
					onchange={(e) =>
						handleProviderChange(
							(e.target as HTMLSelectElement).value,
						)}
				>
					<option value="" disabled>Select provider</option>
					{#each providers as p (p.id)}
						<option value={p.id}>{p.name}</option>
					{/each}
				</select>

				<label for="agent-model">Model</label>
				<select
					id="agent-model"
					bind:value={form.modelId}
					onchange={(e) =>
						handleModelChange(
							(e.target as HTMLSelectElement).value,
						)}
				>
					<option value="" disabled>Select model</option>
					{#each currentProviderModels as m (m.modelId)}
						<option value={(m as ProviderModel).modelId}
							>{(m as ProviderModel).displayName}</option
						>
					{/each}
				</select>

				<div class="section-span">
					<h4>Model Settings</h4>
				</div>

				<label for="agent-temp">Temperature</label>
				<input
					id="agent-temp"
					type="number"
					min="0"
					max="2"
					step="0.1"
					value={form.settings.temperature ?? ""}
					oninput={(e) =>
						form &&
						(form.settings.temperature = Number(
							(e.target as HTMLInputElement).value,
						))}
				/>

				<label for="agent-max-tokens">Max Tokens</label>
				<input
					id="agent-max-tokens"
					type="number"
					min="1"
					step="1"
					value={form.settings.maxTokens ?? ""}
					oninput={(e) =>
						form &&
						(form.settings.maxTokens = Number(
							(e.target as HTMLInputElement).value,
						))}
				/>

				<label for="agent-top-p">Top P</label>
				<input
					id="agent-top-p"
					type="number"
					min="0"
					max="1"
					step="0.05"
					value={form.settings.topP ?? ""}
					oninput={(e) =>
						form &&
						(form.settings.topP = Number(
							(e.target as HTMLInputElement).value,
						))}
				/>

				<label for="agent-freq-pen">Frequency Penalty</label>
				<input
					id="agent-freq-pen"
					type="number"
					min="-2"
					max="2"
					step="0.1"
					value={form.settings.frequencyPenalty ?? ""}
					oninput={(e) =>
						form &&
						(form.settings.frequencyPenalty = Number(
							(e.target as HTMLInputElement).value,
						))}
				/>

				<label for="agent-pres-pen">Presence Penalty</label>
				<input
					id="agent-pres-pen"
					type="number"
					min="-2"
					max="2"
					step="0.1"
					value={form.settings.presencePenalty ?? ""}
					oninput={(e) =>
						form &&
						(form.settings.presencePenalty = Number(
							(e.target as HTMLInputElement).value,
						))}
				/>

				<label for="agent-tool-choice">Tool Choice</label>
				<select
					id="agent-tool-choice"
					value={(form.settings.toolChoice as any) ?? "auto"}
					onchange={(e) =>
						form &&
						(form.settings.toolChoice = (
							e.target as HTMLSelectElement
						).value as any)}
				>
					<option value="auto">auto</option>
					<option value="required">required</option>
					<option value="none">none</option>
				</select>

				<label for="agent-parallel">Parallel Tool Calls</label>
				<input
					id="agent-parallel"
					type="checkbox"
					checked={!!form.settings.parallelToolCalls}
					onchange={(e) =>
						form &&
						(form.settings.parallelToolCalls = (
							e.target as HTMLInputElement
						).checked)}
				/>
			</div>

			<div class="actions">
				{#if !isCreating}
					<button
						class="danger"
						onclick={handleDelete}
						disabled={isLoading}>Delete</button
					>
				{/if}
				<div class="spacer"></div>
				<button onclick={handleSave} class="primary" disabled={!canSave}
					>{isCreating ? "Create" : "Save"}</button
				>
			</div>
		{:else}
			<div class="empty-editor">Select an agent or create a new one.</div>
		{/if}
	</div>
</div>

<style>
	.agent-view {
		display: flex;
		height: 100%;
		gap: 0;
		background: var(--background-primary);
	}
	.sidebar {
		width: 260px;
		border-right: 1px solid var(--background-modifier-border);
		display: flex;
		flex-direction: column;
	}
	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem;
		border-bottom: 1px solid var(--background-modifier-border);
	}
	.header h3 {
		margin: 0;
		font-size: 1rem;
	}
	.agent-list {
		list-style: none;
		margin: 0;
		padding: 0.25rem 0;
		overflow-y: auto;
	}
	.agent-list li {
		padding: 0.5rem 0.75rem;
		cursor: pointer;
	}
	.agent-list li.selected {
		background: var(--background-modifier-hover);
	}
	.agent-list .name {
		font-weight: 600;
	}
	.agent-list .empty {
		color: var(--text-muted);
		font-style: italic;
	}
	.editor {
		flex: 1;
		padding: 1rem;
		overflow-y: auto;
	}
	.form-grid {
		display: grid;
		grid-template-columns: 180px 1fr;
		gap: 0.5rem 1rem;
		align-items: center;
	}
	.form-grid > .section-span {
		grid-column: 1 / -1;
		margin-top: 0.5rem;
	}
	input[type="text"],
	textarea,
	select,
	input[type="number"] {
		width: 100%;
		padding: 0.5rem;
		border: 1px solid var(--background-modifier-border);
		border-radius: 6px;
		background: var(--background-primary);
		color: var(--text-normal);
	}
	textarea {
		resize: vertical;
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 1rem;
	}
	.spacer {
		flex: 1;
	}
	button {
		padding: 0.4rem 0.75rem;
		border: 1px solid var(--background-modifier-border);
		border-radius: 6px;
		background: var(--background-secondary);
		color: var(--text-normal);
		cursor: pointer;
	}
	button.primary {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
		border: none;
	}
	button.danger {
		background: #d9534f;
		color: white;
		border: none;
	}
	button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.empty-editor {
		color: var(--text-muted);
		font-style: italic;
		padding: 1rem;
	}
</style>
