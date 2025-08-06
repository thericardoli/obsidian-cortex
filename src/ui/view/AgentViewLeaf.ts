/**
 * Obsidian View Integration for AgentView
 */

import { ItemView, WorkspaceLeaf } from 'obsidian';
import AgentView from './AgentView.svelte';
import type { AgentManager } from '../../agent/agent-manager';
import type { ProviderManager } from '../../providers/provider-manager';

export const VIEW_TYPE_AGENT = 'cortex-agent-view';

export class AgentViewLeaf extends ItemView {
    private agentViewComponent: ReturnType<typeof import('svelte').mount> | null = null;
    private agentManager: AgentManager;
    private providerManager: ProviderManager;

    constructor(leaf: WorkspaceLeaf, agentManager: AgentManager, providerManager: ProviderManager) {
        super(leaf);
        this.agentManager = agentManager;
        this.providerManager = providerManager;
    }

    getViewType(): string {
        return VIEW_TYPE_AGENT;
    }

    getDisplayText(): string {
        return 'Cortex Agents';
    }

    getIcon(): string {
        return 'users'; // Using a different icon for distinction
    }

    async onOpen(): Promise<void> {
        // Clear any existing content
        this.contentEl.empty();

        // Add custom CSS classes for styling
        this.contentEl.addClass('cortex-agent-container');

        // Import Svelte mount function
        const { mount } = await import('svelte');

        // Create and mount the Svelte component
        this.agentViewComponent = mount(AgentView, {
            target: this.contentEl,
            props: {
                agentManager: this.agentManager,
                providerManager: this.providerManager
            }
        });
    }

    async onClose(): Promise<void> {
        // Cleanup the Svelte component
        if (this.agentViewComponent) {
            const { unmount } = await import('svelte');
            unmount(this.agentViewComponent);
            this.agentViewComponent = null;
        }
    }
}
