/**
 * Obsidian View Integration for ChatView
 * This file shows how to integrate the ChatView Svelte component into an Obsidian plugin
 */

import { ItemView, WorkspaceLeaf } from 'obsidian';
import ChatView from './ChatView.svelte';
import type { CortexManager } from '../../cortex-manager';

export const VIEW_TYPE_CHAT = 'cortex-side-chat-view';

export class ChatViewLeaf extends ItemView {
    private chatViewComponent: ReturnType<typeof import('svelte').mount> | null = null;
    private cortexManager: CortexManager;

    constructor(leaf: WorkspaceLeaf, cortexManager: CortexManager) {
        super(leaf);
        this.cortexManager = cortexManager;
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
                cortexManager: this.cortexManager,
                workspaceLeaf: this.leaf
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
        // the view should automatically update when the cortexManager state changes
        // This method could be used to force a refresh if needed
        if (this.chatViewComponent) {
            // The component will automatically react to changes in cortexManager
            console.log('Chat view will automatically refresh based on cortex manager changes');
        }
    }
}
