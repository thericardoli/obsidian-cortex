<script lang="ts">
	import { onMount } from 'svelte';
	import type { AgentManager } from '../../agent/agent-manager';
	import type { AgentConfig, AgentConfigInput, ModelSettings } from '../../types';
	import type { ModelDescriptor, ProviderDescriptor } from '../../types/provider';
	import { createLogger } from '../../utils/logger';
	import { toProviderDescriptor } from '../../utils/provider-runtime';
	import BuiltinToolsSelector from '../component/tool/BuiltinToolsSelector.svelte';

	const logger = createLogger('ui');

	let {
		agentManager,
		getSettings,
	}: { agentManager: AgentManager; getSettings: () => import('../../types').PluginSettings } =
		$props();

	// state
	let isLoading = $state(false);
	let providers = $state<ProviderDescriptor[]>([]);
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

	const selectedAgent = $derived(agents.find((a) => a.id === selectedAgentId) || null);

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

	const currentProviderModels: ModelDescriptor[] = $derived(
		(() => {
			const f = form;
			if (!f) return [] as ModelDescriptor[];
			const p = providers.find((p) => p.id === f.providerId);
			return p?.models ?? [];
		})()
	);

	onMount(() => {
		refreshProviders();
		refreshAgents();
	});

	function refreshProviders() {
		const settings = getSettings();
		providers = (settings.providers || []).map(toProviderDescriptor);
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
			name: '',
			instructions: '',
			providerId: firstProvider?.id || '',
			modelId: firstModel?.modelId || '',
			settings: {
				temperature: 0.7,
			},
		};
	}

	async function handleSave() {
		if (!form) return;
		isLoading = true;
		try {
			const settings = {
				...sanitizeSettings(form.settings),
			};

			if (isCreating) {
				const payload: AgentConfigInput = {
					name: form.name.trim(),
					instructions: form.instructions.trim(),
					modelConfig: {
						provider: form.providerId,
						model: form.modelId,
						settings,
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
						settings,
					},
				});
				refreshAgents();
			}
		} catch (e) {
			logger.error('Failed to save agent', e);
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
			logger.error('Failed to delete agent', e);
		} finally {
			isLoading = false;
		}
	}

	function sanitizeSettings(s: Partial<ModelSettings>): ModelSettings {
		const out: Partial<ModelSettings> = {};
		if (s.temperature !== undefined) out.temperature = Number(s.temperature);
		if (s.maxTokens !== undefined) out.maxTokens = Number(s.maxTokens);
		if (s.topP !== undefined) out.topP = Number(s.topP);
		if (s.frequencyPenalty !== undefined) out.frequencyPenalty = Number(s.frequencyPenalty);
		if (s.presencePenalty !== undefined) out.presencePenalty = Number(s.presencePenalty);
		return out as ModelSettings;
	}

	function handleProviderChange(id: string) {
		if (!form) return;
		form.providerId = id;
		const firstModel = providers.find((p) => p.id === id)?.models?.[0]?.modelId || '';
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
			f.modelId = prov.models[0]?.modelId || '';
		}
	});
</script>

<div class="agent-view">
	<div class="sidebar">
		<div class="header">
			<h3>Agents</h3>
			<button class="primary" onclick={handleCreateNew} disabled={isLoading}>New</button>
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
					oninput={(e: Event) =>
						form && (form.name = (e.target as HTMLInputElement).value)}
					placeholder="Agent name"
				/>

				<label for="agent-instructions">Instructions</label>
				<textarea
					id="agent-instructions"
					rows="6"
					value={form.instructions}
					oninput={(e: Event) =>
						form && (form.instructions = (e.target as HTMLTextAreaElement).value)}
					placeholder="System instructions for the agent"
				></textarea>

				<label for="agent-provider">Provider</label>
				<select
					id="agent-provider"
					bind:value={form.providerId}
					onchange={(e: Event) =>
						handleProviderChange((e.target as HTMLSelectElement).value)}
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
					onchange={(e: Event) =>
						handleModelChange((e.target as HTMLSelectElement).value)}
				>
					<option value="" disabled>Select model</option>
					{#each currentProviderModels as m (m.modelId)}
						<option value={m.modelId}>{m.displayName}</option>
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
					value={form.settings.temperature ?? ''}
					oninput={(e: Event) =>
						form &&
						(form.settings.temperature = Number((e.target as HTMLInputElement).value))}
				/>

				<label for="agent-max-tokens">Max Tokens</label>
				<input
					id="agent-max-tokens"
					type="number"
					min="1"
					step="1"
					value={form.settings.maxTokens ?? ''}
					oninput={(e: Event) =>
						form &&
						(form.settings.maxTokens = Number((e.target as HTMLInputElement).value))}
				/>

				<label for="agent-top-p">Top P</label>
				<input
					id="agent-top-p"
					type="number"
					min="0"
					max="1"
					step="0.05"
					value={form.settings.topP ?? ''}
					oninput={(e: Event) =>
						form && (form.settings.topP = Number((e.target as HTMLInputElement).value))}
				/>

				<label for="agent-freq-pen">Frequency Penalty</label>
				<input
					id="agent-freq-pen"
					type="number"
					min="-2"
					max="2"
					step="0.1"
					value={form.settings.frequencyPenalty ?? ''}
					oninput={(e: Event) =>
						form &&
						(form.settings.frequencyPenalty = Number(
							(e.target as HTMLInputElement).value
						))}
				/>

				<label for="agent-pres-pen">Presence Penalty</label>
				<input
					id="agent-pres-pen"
					type="number"
					min="-2"
					max="2"
					step="0.1"
					value={form.settings.presencePenalty ?? ''}
					oninput={(e: Event) =>
						form &&
						(form.settings.presencePenalty = Number(
							(e.target as HTMLInputElement).value
						))}
				/>
			</div>

			<div class="actions">
				{#if !isCreating}
					<button class="danger" onclick={handleDelete} disabled={isLoading}
						>Delete</button
					>
				{/if}
				<div class="spacer"></div>
				<button onclick={handleSave} class="primary" disabled={!canSave}
					>{isCreating ? 'Create' : 'Save'}</button
				>
			</div>

			{#if selectedAgent}
				<BuiltinToolsSelector {agentManager} agent={selectedAgent} />
			{/if}
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
	input[type='text'],
	textarea,
	select,
	input[type='number'] {
		width: 100%;
		padding: 0.5rem 0.625rem;
		border: 1px solid var(--background-modifier-border);
		border-radius: 0.5rem; /* unify with chat */
		background: var(--background-primary);
		color: var(--text-normal);
		box-sizing: border-box;
		transition:
			border-color 0.15s ease,
			box-shadow 0.15s ease;
	}
	input[type='text']:focus,
	textarea:focus,
	select:focus,
	input[type='number']:focus {
		outline: none;
		border-color: var(--interactive-accent);
		box-shadow: 0 0 0 2px rgba(var(--interactive-accent-rgb), 0.2);
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
		padding: 0.45rem 0.8rem;
		border: 1px solid var(--background-modifier-border);
		border-radius: 0.5rem; /* unify with header buttons */
		background: var(--background-secondary);
		color: var(--text-normal);
		cursor: pointer;
		transition:
			background-color 0.15s ease,
			transform 0.05s ease,
			box-shadow 0.15s ease;
	}
	button:hover {
		background: var(--background-modifier-hover);
	}
	button:active {
		transform: translateY(0.5px);
	}
	button.primary {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
		border: none;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
	}
	button.primary:hover {
		background: var(--interactive-accent-hover);
	}
	button.danger {
		background: #d9534f;
		color: #fff;
		border: none;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
	}
	button.danger:hover {
		background: #c64541;
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
