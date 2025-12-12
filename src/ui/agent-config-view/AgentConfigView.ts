import { type App, ItemView, WorkspaceLeaf } from 'obsidian';
import { mount, unmount } from 'svelte';

import AgentConfigViewComponent from './AgentConfigView.svelte';

import type CortexPlugin from '../../../main';

export const VIEW_TYPE_AGENT_CONFIG = 'cortex-agent-config-view';

export class AgentConfigView extends ItemView {
    private component: ReturnType<typeof mount> | null = null;
    private plugin: CortexPlugin;

    constructor(leaf: WorkspaceLeaf, plugin: CortexPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return VIEW_TYPE_AGENT_CONFIG;
    }

    getDisplayText(): string {
        return 'Agent Configuration';
    }

    getIcon(): string {
        return 'sliders-horizontal';
    }

    async onOpen(): Promise<void> {
        const container = this.containerEl.children[1] as HTMLElement;
        container.empty();
        container.style.height = '100%';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';

        const mountPoint = container.createDiv({
            cls: 'cortex-agent-config-view-container',
        });
        mountPoint.style.height = '100%';
        mountPoint.style.display = 'flex';
        mountPoint.style.flexDirection = 'column';

        this.component = mount(AgentConfigViewComponent, {
            target: mountPoint,
            props: {
                plugin: this.plugin,
            },
        });
    }

    async onClose(): Promise<void> {
        if (this.component) {
            unmount(this.component);
            this.component = null;
        }
    }
}

export function registerAgentConfigView(plugin: CortexPlugin): void {
    plugin.registerView(VIEW_TYPE_AGENT_CONFIG, (leaf) => new AgentConfigView(leaf, plugin));
}

export async function activateAgentConfigView(app: App): Promise<void> {
    const { workspace } = app;

    let leaf = workspace.getLeavesOfType(VIEW_TYPE_AGENT_CONFIG)[0];
    if (!leaf) {
        leaf = workspace.getLeaf(true);
        await leaf.setViewState({
            type: VIEW_TYPE_AGENT_CONFIG,
            active: true,
        });
    }

    if (leaf) {
        workspace.revealLeaf(leaf);
    }
}
