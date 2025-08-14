<script lang="ts">
  import { BUILTIN_TOOLS, type BuiltinToolDefinition } from '../../../tool/builtin';
  import type { FunctionToolConfig } from '../../../types';

  let { selectedTools, onToolChange }: {
    selectedTools: FunctionToolConfig[];
    onToolChange: (tool: FunctionToolConfig, enabled: boolean) => void;
  } = $props();

  function isToolEnabled(toolName: string): boolean {
    return selectedTools.some(t => t.name === toolName && t.type === 'function');
  }

  function handleCheckboxChange(event: Event, tool: BuiltinToolDefinition) {
    const target = event.target as HTMLInputElement;
    const enabled = target.checked;

    const toolConfig: FunctionToolConfig = {
      type: 'function',
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
      executor: tool.name,
    };

    onToolChange(toolConfig, enabled);
  }
</script>

<div class="builtin-tool-selector">
  <h4>Built-in Tools</h4>
  <div class="tool-list">
    {#each BUILTIN_TOOLS as tool (tool.name)}
      <div class="tool-item">
        <input
          type="checkbox"
          id={`tool-${tool.name}`}
          checked={isToolEnabled(tool.name)}
          onchange={(e) => handleCheckboxChange(e, tool)}
        />
        <label for={`tool-${tool.name}`}>
          <div class="tool-name">{tool.name}</div>
          <div class="tool-description">{tool.description}</div>
        </label>
      </div>
    {/each}
  </div>
</div>

<style>
  .builtin-tool-selector {
    grid-column: 1 / -1;
    margin-top: 0.5rem;
  }
  .tool-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }
  .tool-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .tool-item label {
    display: block;
    cursor: pointer;
  }
  .tool-name {
    font-weight: 600;
  }
  .tool-description {
    font-size: 0.9em;
    color: var(--text-muted);
  }
</style>
