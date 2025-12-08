<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import { Textarea } from '$lib/components/ui/textarea';
    import { cn } from '$lib/utils';
    import { SvelteSet } from 'svelte/reactivity';
    import { DEFAULT_SETTINGS } from '../../settings/settings';
    import type { AgentConfig } from '../../types/agent';
    import type CortexPlugin from '../../../main';

    interface Props {
        plugin: CortexPlugin;
    }

    const DEFAULT_MODEL = 'openai:gpt-4.1-mini';

    let { plugin }: Props = $props();
    let newToolId = $state('');
    let saveStatus = $state<'idle' | 'saving' | 'saved'>('idle');

    function withDefaults(config: AgentConfig): AgentConfig {
        return {
            ...config,
            modelId: config.modelId || DEFAULT_MODEL,
            handoffIds: config.handoffIds ?? [],
            toolIds: config.toolIds ?? [],
            enabled: config.enabled ?? true,
        };
    }

    function fromLegacy(): AgentConfig[] | null {
        const legacy = (plugin.settings as unknown as Record<string, unknown>).agentConfigData as
            | {
                  configs?: Record<
                      string,
                      {
                          id?: string;
                          name?: string;
                          instructions?: string;
                          enabled?: boolean;
                          description?: string;
                      }
                  >;
              }
            | undefined;

        if (!legacy?.configs) return null;

        return Object.values(legacy.configs).map((config) =>
            withDefaults({
                id: config.id || crypto.randomUUID(),
                name: config.name || '未命名 Agent',
                instructions: config.instructions || '',
                modelId: DEFAULT_MODEL,
                handoffDescription: config.description || '',
                handoffIds: [],
                toolIds: [],
                enabled: config.enabled ?? true,
            })
        );
    }

    function cloneDefaults(configs: AgentConfig[]): AgentConfig[] {
        return configs.map((config) => withDefaults({ ...config }));
    }

    function loadAgents(): AgentConfig[] {
        if (
            Array.isArray(plugin.settings.agentConfigs) &&
            plugin.settings.agentConfigs.length > 0
        ) {
            return cloneDefaults(plugin.settings.agentConfigs);
        }

        const legacy = fromLegacy();
        if (legacy?.length) return legacy;

        return cloneDefaults(DEFAULT_SETTINGS.agentConfigs);
    }

    let agents = $state<AgentConfig[]>(loadAgents());
    let selectedAgentId = $state(agents[0]?.id ?? '');

    let selectedAgent = $derived(agents.find((agent) => agent.id === selectedAgentId));
    let otherAgents = $derived(agents.filter((agent) => agent.id !== selectedAgentId));

    $effect(() => {
        if (!selectedAgent && agents[0]) {
            selectedAgentId = agents[0].id;
        }
    });

    function selectAgent(agentId: string) {
        selectedAgentId = agentId;
    }

    function updateSelectedAgent(patch: Partial<AgentConfig>) {
        if (!selectedAgentId) return;
        agents = agents.map((agent) =>
            agent.id === selectedAgentId ? { ...agent, ...patch } : agent
        );
    }

    function addAgent() {
        const id = crypto.randomUUID();
        const newAgent: AgentConfig = {
            id,
            name: `Agent ${agents.length + 1}`,
            instructions: 'Describe what this agent is good at...',
            modelId: DEFAULT_MODEL,
            handoffDescription: '',
            handoffIds: [],
            toolIds: [],
            enabled: true,
        };

        agents = [...agents, newAgent];
        selectedAgentId = id;
    }

    function deleteAgent(agentId: string) {
        if (agents.length <= 1) return;
        const idx = agents.findIndex((a) => a.id === agentId);
        agents = agents.filter((a) => a.id !== agentId);
        agents = agents.map((a) => ({
            ...a,
            handoffIds: (a.handoffIds || []).filter((id) => id !== agentId),
        }));
        if (selectedAgentId === agentId) {
            selectedAgentId = agents[Math.max(0, idx - 1)]?.id ?? '';
        }
    }

    function addTool() {
        if (!selectedAgent || !newToolId.trim()) return;
        const toolId = newToolId.trim();
        updateSelectedAgent({
            toolIds: Array.from(new SvelteSet([...(selectedAgent.toolIds ?? []), toolId])),
        });
        newToolId = '';
    }

    function removeTool(toolId: string) {
        if (!selectedAgent) return;
        updateSelectedAgent({
            toolIds: (selectedAgent.toolIds || []).filter((id) => id !== toolId),
        });
    }

    function toggleSubAgent(agentId: string) {
        if (!selectedAgent || agentId === selectedAgent.id) return;
        const current = new SvelteSet(selectedAgent.handoffIds || []);
        if (current.has(agentId)) {
            current.delete(agentId);
        } else {
            current.add(agentId);
        }
        updateSelectedAgent({ handoffIds: Array.from(current) });
    }

    async function saveAgents() {
        saveStatus = 'saving';
        plugin.settings.agentConfigs = agents.map((agent) => withDefaults(agent));
        await plugin.saveSettings();
        saveStatus = 'saved';
        setTimeout(() => (saveStatus = 'idle'), 2000);
    }
</script>

<div class="bg-background text-foreground flex h-full gap-4 p-4">
    <aside
        class="border-border/80 bg-card/60 flex w-64 shrink-0 flex-col rounded-2xl border shadow-sm"
    >
        <div class="border-border/60 flex items-center justify-between gap-2 border-b px-3 py-3">
            <div class="text-muted-foreground text-sm font-semibold">Agents</div>
            <Button size="sm" variant="ghost" class="h-7 px-2 text-xs" onclick={addAgent}>
                <span class="mr-1">+</span> 新建
            </Button>
        </div>

        <div class="flex-1 space-y-1.5 overflow-y-auto p-2">
            {#if agents.length === 0}
                <div
                    class="text-muted-foreground flex h-32 items-center justify-center text-center text-sm"
                >
                    暂无 Agent
                </div>
            {:else}
                {#each agents as agent (agent.id)}
                    <button
                        class={cn(
                            'group relative w-full rounded-lg border px-3 py-2.5 text-left transition-all duration-150',
                            selectedAgentId === agent.id
                                ? 'border-primary/60 bg-primary/10 shadow-sm'
                                : 'hover:border-border hover:bg-muted/50 border-transparent'
                        )}
                        onclick={() => selectAgent(agent.id)}
                    >
                        <div class="flex items-center justify-between gap-2">
                            <span class="line-clamp-1 text-sm font-medium"
                                >{agent.name || '未命名 Agent'}</span
                            >
                            <span
                                class={cn(
                                    'h-2 w-2 shrink-0 rounded-full transition-colors',
                                    agent.enabled ? 'bg-emerald-500' : 'bg-muted-foreground/40'
                                )}
                                title={agent.enabled ? '已启用' : '已禁用'}
                            ></span>
                        </div>
                        <div class="text-muted-foreground mt-1 line-clamp-1 text-xs">
                            {agent.handoffDescription ||
                                agent.instructions?.slice(0, 50) ||
                                '暂无描述'}
                        </div>
                    </button>
                {/each}
            {/if}
        </div>
    </aside>

    <section
        class="border-border/80 bg-card/40 flex flex-1 flex-col overflow-hidden rounded-2xl border shadow-sm"
    >
        {#if selectedAgent}
            <header class="border-border/60 shrink-0 border-b p-5">
                <div class="flex items-start justify-between gap-4">
                    <div class="min-w-0 flex-1">
                        <div
                            class="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase"
                        >
                            Agent Configuration
                        </div>
                        <h2 class="text-foreground mt-1 truncate text-xl font-semibold">
                            {selectedAgent.name || '未命名 Agent'}
                        </h2>
                        <p class="text-muted-foreground mt-0.5 text-sm">
                            管理 Agent 的指令、工具和 handoff 策略
                        </p>
                    </div>
                    <div class="flex shrink-0 items-center gap-2">
                        <label
                            class={cn(
                                'flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors',
                                selectedAgent.enabled
                                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600'
                                    : 'border-border bg-muted/50 text-muted-foreground'
                            )}
                        >
                            <input
                                type="checkbox"
                                class="sr-only"
                                checked={selectedAgent.enabled}
                                onchange={(e) =>
                                    updateSelectedAgent({
                                        enabled: (e.currentTarget as HTMLInputElement).checked,
                                    })}
                            />
                            <span
                                class={cn(
                                    'h-2 w-2 rounded-full transition-colors',
                                    selectedAgent.enabled
                                        ? 'bg-emerald-500'
                                        : 'bg-muted-foreground/50'
                                )}
                            ></span>
                            {selectedAgent.enabled ? '已启用' : '已禁用'}
                        </label>
                        <Button
                            size="sm"
                            variant="ghost"
                            class="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onclick={() => deleteAgent(selectedAgent.id)}
                            disabled={agents.length <= 1}
                            title={agents.length <= 1 ? '至少保留一个 Agent' : '删除此 Agent'}
                        >
                            删除
                        </Button>
                        <Button
                            size="sm"
                            onclick={saveAgents}
                            disabled={saveStatus === 'saving'}
                            class={cn(
                                'min-w-16 transition-all',
                                saveStatus === 'saved' && 'bg-emerald-600 hover:bg-emerald-600'
                            )}
                        >
                            {#if saveStatus === 'saving'}
                                保存中...
                            {:else if saveStatus === 'saved'}
                                已保存 ✓
                            {:else}
                                保存
                            {/if}
                        </Button>
                    </div>
                </div>
            </header>

            <div class="flex-1 space-y-4 overflow-y-auto p-5">
                <div class="border-border/60 bg-background/60 rounded-xl border p-4">
                    <label class="block space-y-1.5">
                        <span class="text-foreground text-sm font-medium">名称</span>
                        <input
                            class="border-input focus:border-primary focus:ring-primary/20 h-10 w-full rounded-lg border bg-transparent px-3 font-[inherit] text-sm shadow-xs transition-colors outline-none focus:ring-2"
                            value={selectedAgent.name}
                            oninput={(e) =>
                                updateSelectedAgent({
                                    name: (e.currentTarget as HTMLInputElement).value,
                                })}
                            placeholder="给 Agent 起个名字"
                        />
                    </label>

                    <label class="mt-4 block space-y-1.5">
                        <span class="text-foreground text-sm font-medium">系统指令</span>
                        <Textarea
                            class="min-h-28 resize-y"
                            value={selectedAgent.instructions}
                            oninput={(e) =>
                                updateSelectedAgent({
                                    instructions: (e.currentTarget as HTMLTextAreaElement).value,
                                })}
                            placeholder="为 Agent 设置系统提示语，例如角色、语气、输出格式等"
                        />
                    </label>

                    <label class="mt-4 block space-y-1.5">
                        <span class="text-foreground text-sm font-medium">Handoff 描述</span>
                        <input
                            class="border-input focus:border-primary focus:ring-primary/20 h-10 w-full rounded-lg border bg-transparent px-3 font-[inherit] text-sm shadow-xs transition-colors outline-none focus:ring-2"
                            value={selectedAgent.handoffDescription}
                            oninput={(e) =>
                                updateSelectedAgent({
                                    handoffDescription: (e.currentTarget as HTMLInputElement).value,
                                })}
                            placeholder="描述此 Agent 的专长，供其他 Agent 在 handoff 时参考"
                        />
                    </label>
                </div>

                <div class="border-border/60 bg-background/60 rounded-xl border p-4">
                    <div class="flex items-center justify-between gap-3">
                        <div>
                            <div class="text-foreground text-sm font-medium">工具列表</div>
                            <p class="text-muted-foreground text-xs">为 Agent 配置可调用的工具</p>
                        </div>
                        <div class="flex items-center gap-2">
                            <input
                                class="border-input focus:border-primary focus:ring-primary/20 h-8 w-36 rounded-lg border bg-transparent px-2.5 font-[inherit] text-sm shadow-xs transition-colors outline-none focus:ring-2"
                                placeholder="输入 tool ID"
                                value={newToolId}
                                oninput={(e) =>
                                    (newToolId = (e.currentTarget as HTMLInputElement).value)}
                                onkeydown={(e) => e.key === 'Enter' && addTool()}
                            />
                            <Button size="sm" variant="secondary" class="h-8" onclick={addTool}
                                >添加</Button
                            >
                        </div>
                    </div>

                    <div class="mt-3 space-y-1.5">
                        {#if selectedAgent.toolIds?.length}
                            {#each selectedAgent.toolIds as toolId (toolId)}
                                <div
                                    class="border-border/50 bg-card/80 hover:border-border flex items-center justify-between rounded-lg border px-3 py-2 transition-colors"
                                >
                                    <div class="flex items-center gap-2">
                                        <span
                                            class="bg-primary/10 text-primary flex h-6 w-6 items-center justify-center rounded text-xs"
                                        >
                                            T
                                        </span>
                                        <span class="text-sm font-medium">{toolId}</span>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        class="text-muted-foreground hover:text-destructive h-7 px-2 text-xs"
                                        onclick={() => removeTool(toolId)}
                                    >
                                        移除
                                    </Button>
                                </div>
                            {/each}
                        {:else}
                            <div
                                class="border-border/60 text-muted-foreground rounded-lg border border-dashed py-6 text-center text-sm"
                            >
                                尚未添加工具
                            </div>
                        {/if}
                    </div>
                </div>

                <div class="border-border/60 bg-background/60 rounded-xl border p-4">
                    <div class="text-foreground text-sm font-medium">子 Agent（Handoff）</div>
                    <p class="text-muted-foreground text-xs">
                        选择此 Agent 可以转交任务的目标 Agent
                    </p>

                    <div class="mt-3 space-y-1.5">
                        {#if otherAgents.length === 0}
                            <div
                                class="border-border/60 text-muted-foreground rounded-lg border border-dashed py-6 text-center text-sm"
                            >
                                暂无其他 Agent 可供 handoff
                            </div>
                        {:else}
                            {#each otherAgents as agent (agent.id)}
                                {@const isSelected = selectedAgent.handoffIds?.includes(agent.id)}
                                <label
                                    class={cn(
                                        'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-all',
                                        isSelected
                                            ? 'border-primary/40 bg-primary/5'
                                            : 'border-border/50 bg-card/80 hover:border-border'
                                    )}
                                >
                                    <input
                                        type="checkbox"
                                        class="sr-only"
                                        checked={isSelected}
                                        onchange={() => toggleSubAgent(agent.id)}
                                    />
                                    <span
                                        class={cn(
                                            'flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors',
                                            isSelected
                                                ? 'border-primary bg-primary text-primary-foreground'
                                                : 'border-border bg-background'
                                        )}
                                    >
                                        {#if isSelected}
                                            <svg
                                                class="h-3 w-3"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                                stroke-width="3"
                                            >
                                                <path
                                                    stroke-linecap="round"
                                                    stroke-linejoin="round"
                                                    d="M5 13l4 4L19 7"
                                                />
                                            </svg>
                                        {/if}
                                    </span>
                                    <div class="min-w-0 flex-1">
                                        <div class="flex items-center gap-2">
                                            <span class="text-sm font-medium">{agent.name}</span>
                                            <span
                                                class={cn(
                                                    'h-1.5 w-1.5 rounded-full',
                                                    agent.enabled
                                                        ? 'bg-emerald-500'
                                                        : 'bg-muted-foreground/40'
                                                )}
                                            ></span>
                                        </div>
                                        <div class="text-muted-foreground line-clamp-1 text-xs">
                                            {agent.handoffDescription ||
                                                agent.instructions?.slice(0, 60) ||
                                                '尚未添加描述'}
                                        </div>
                                    </div>
                                </label>
                            {/each}
                        {/if}
                    </div>
                </div>
            </div>
        {:else}
            <div
                class="text-muted-foreground flex h-full flex-col items-center justify-center gap-3"
            >
                <div class="bg-muted/50 flex h-16 w-16 items-center justify-center rounded-full">
                    <svg
                        class="h-8 w-8"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="1.5"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                        />
                    </svg>
                </div>
                <div class="text-center">
                    <div class="text-lg font-semibold">还没有配置 Agent</div>
                    <p class="mt-1 text-sm">点击左侧"新建"按钮创建你的第一个 Agent</p>
                </div>
            </div>
        {/if}
    </section>
</div>
