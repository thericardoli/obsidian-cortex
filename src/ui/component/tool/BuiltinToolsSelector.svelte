<script lang="ts">
	import type { AgentManager } from '../../../agent/agent-manager';
	import { builtinFunctionTools, toFunctionToolConfig } from '../../../tool/builtin';
	import type { AgentConfig } from '../../../types/agent';
	import type { ToolConfig } from '../../../types/tool';
	import { createLogger } from '../../../utils/logger';

	const logger = createLogger('ui');

	let { agentManager, agent }: { agentManager: AgentManager; agent: AgentConfig | null } =
		$props();

	// 当前选中的工具名集合（来自 agent.tools）
	const selectedNames = $derived(
		new Set((agent?.tools || []).filter((t) => t.type === 'function').map((t) => t.name))
	);

	function isChecked(name: string): boolean {
		return selectedNames.has(name);
	}

	async function toggleTool(name: string) {
		if (!agent) return;
		const already = isChecked(name);
		try {
			if (already) {
				await agentManager.removeTool(agent.id, name);
				const idx = agent.tools.findIndex((t) => t.name === name);
				if (idx >= 0) agent.tools.splice(idx, 1);
			} else {
				const meta = builtinFunctionTools.find((t) => t.name === name);
				if (!meta) return;
				const cfg = toFunctionToolConfig(meta);
				await agentManager.addTool(agent.id, cfg as ToolConfig);
				agent.tools.push(cfg);
			}
		} catch (e) {
			logger.error('Toggle builtin tool failed', e);
		}
	}
</script>

{#if agent}
	<div class="builtin-tools">
		<h4>Builtin Function Tools</h4>
		{#each builtinFunctionTools as t (t.name)}
			<label class="tool-item">
				<input
					type="checkbox"
					checked={isChecked(t.name)}
					onchange={() => toggleTool(t.name)}
				/>
				<span class="tool-name">{t.name}</span>
				<span class="tool-desc">{t.description}</span>
			</label>
		{/each}
	</div>
{:else}
	<div class="builtin-tools empty">Create or select an agent to configure tools.</div>
{/if}

<style>
	.builtin-tools {
		margin-top: 1rem;
		padding: 0.75rem;
		border: 1px solid var(--background-modifier-border);
		border-radius: 0.5rem; /* unify with inputs/buttons */
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
	}
	.builtin-tools h4 {
		margin: 0 0 0.5rem 0;
		font-size: 0.95rem;
	}
	.tool-item {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 0.4rem 0;
	}
	.tool-item input {
		margin-right: 0.5rem;
	}
	.tool-name {
		font-weight: 600;
	}
	.tool-desc {
		font-size: 0.75rem;
		color: var(--text-muted);
	}
</style>
