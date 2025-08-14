<script lang="ts">
	import type { FunctionTool } from '../../../types/tool';

	let { selectedTools } = $props<{ selectedTools: FunctionTool[] }>();

	let availableTools = $state<FunctionTool[]>([]);
	let isLoading = $state(true);

	$effect(() => {
		const load = async () => {
			const modules = import.meta.glob('../../../tool/builtin/*.ts');
			const toolSchemas: FunctionTool[] = [];
			for (const path in modules) {
				const module = await modules[path]();
				if (module && typeof module === 'object') {
					Object.values(module).forEach((value: any) => {
						if (value && value.type === 'function' && value.name) {
							toolSchemas.push(value as FunctionTool);
						}
					});
				}
			}
			availableTools = toolSchemas;
			isLoading = false;
		};
		load();
	});

	function handleToolToggle(checked: boolean, tool: FunctionTool) {
		if (checked) {
			selectedTools = [...selectedTools, tool];
		} else {
			selectedTools = selectedTools.filter((t) => t.name !== tool.name);
		}
	}

	function isSelected(tool: FunctionTool) {
		return selectedTools.some((t) => t.name === tool.name);
	}
</script>

<div class="builtin-tool-selector">
	<h4>Built-in Tools</h4>
	{#if isLoading}
		<p>Loading tools...</p>
	{:else if availableTools.length === 0}
		<p>No built-in tools found.</p>
	{:else}
		<ul class="tool-list">
			{#each availableTools as tool (tool.name)}
				<li>
					<label>
						<input
							type="checkbox"
							checked={isSelected(tool)}
							onchange={(e) => handleToolToggle(e.currentTarget.checked, tool)}
						/>
						{tool.name}
						{#if tool.description}
							<span class="description">{tool.description}</span>
						{/if}
					</label>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
  .builtin-tool-selector {
    margin-top: 1rem;
  }
  .tool-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .tool-list li {
    margin-bottom: 0.5rem;
  }
  .tool-list label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .description {
    font-size: 0.9rem;
    color: var(--text-muted);
  }
</style>
