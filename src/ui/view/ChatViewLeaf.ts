/**
 * Obsidian View Integration for ChatView
 * This file shows how to integrate the ChatView Svelte component into an Obsidian plugin
 */

import { ItemView, WorkspaceLeaf } from 'obsidian';
import ChatView from './ChatView.svelte';
import type { AgentManager } from '../../agent/agent-manager';
import type { ProviderManager } from '../../providers/provider-manager';
import type { PluginSettings } from '../../types';
import type { SessionService } from '../../services/session-service';
import type { EventBus } from '../../services/event-bus';
import { createLogger, type Logger } from '../../utils/logger';

export const VIEW_TYPE_CHAT = 'cortex-side-chat-view';

export class ChatViewLeaf extends ItemView {
    private chatViewComponent: ReturnType<typeof import('svelte').mount> | null = null;
    private agentManager: AgentManager;
    private providerManager: ProviderManager;
    private getSettings: () => PluginSettings;
    private sessionService: SessionService;
    private eventBus: EventBus;
    private logger: Logger;

    constructor(leaf: WorkspaceLeaf, agentManager: AgentManager, providerManager: ProviderManager, getSettings: () => PluginSettings, sessionService: SessionService, eventBus: EventBus) {
        super(leaf);
        this.agentManager = agentManager;
        this.providerManager = providerManager;
        this.getSettings = getSettings;
        this.sessionService = sessionService;
        this.eventBus = eventBus;
        this.logger = createLogger('ui');
    }

    getViewType(): string {
        return VIEW_TYPE_CHAT;
    }

    getDisplayText(): string {
        return 'Cortex Chat';
    }

    getIcon(): string {
        return 'message-circle';
    }

    async onOpen(): Promise<void> {
        // Clear any existing content
        this.contentEl.empty();
        
        // Add custom CSS classes for styling
        this.contentEl.addClass('cortex-chat-container');
        
        // Import Svelte mount function
        const { mount } = await import('svelte');
        
        // Create and mount the Svelte component
        // The mount function in Svelte 5 properly handles effect context internally
        this.chatViewComponent = mount(ChatView, {
            target: this.contentEl,
            props: {
                agentManager: this.agentManager,
                providerManager: this.providerManager,
                getSettings: this.getSettings,
                sessionService: this.sessionService,
                eventBus: this.eventBus,
                workspaceLeaf: this.leaf,
                app: this.app
            }
        });
    }

    async onClose(): Promise<void> {
        // Cleanup the Svelte component
        if (this.chatViewComponent) {
            // Import unmount function from Svelte 5
            const { unmount } = await import('svelte');
            unmount(this.chatViewComponent);
            this.chatViewComponent = null;
        }
    }

    // Optional: Method to refresh the view when agents/providers change
    public refreshAgents(): void {
        // Since we're using reactive Svelte components, 
        // the view should automatically update when the manager state changes
        // This method could be used to force a refresh if needed
        if (this.chatViewComponent) {
            // The component will automatically react to changes in managers
            this.logger.debug('Chat view will automatically refresh based on manager changes');
        }
    }
}
