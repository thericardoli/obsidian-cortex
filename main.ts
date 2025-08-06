import { Plugin, WorkspaceLeaf } from 'obsidian';
import { AgentManager } from './src/agent/agent-manager';
import { ProviderManager } from './src/providers/provider-manager';
import { ChatViewLeaf, VIEW_TYPE_CHAT } from './src/ui/view/ChatViewLeaf';

export default class CortexPlugin extends Plugin {
    private agentManager: AgentManager;
    private providerManager: ProviderManager;

    async onload() {
        console.log('Loading Cortex Plugin');

        // Initialize the managers
        this.providerManager = new ProviderManager();
        this.agentManager = new AgentManager(this.providerManager);

        // Register the chat view
        this.registerView(
            VIEW_TYPE_CHAT,
            (leaf) => new ChatViewLeaf(leaf, this.agentManager, this.providerManager)
        );

        // Add command to open chat view
        this.addCommand({
            id: 'open-cortex-chat',
            name: 'Open Cortex Chat',
            callback: () => {
                this.activateChatView();
            }
        });

        // Add ribbon icon
        this.addRibbonIcon('message-circle', 'Cortex Chat', () => {
            this.activateChatView();
        });

        console.log('Cortex Plugin loaded successfully');
    }

    async onunload() {
        console.log('Unloading Cortex Plugin');
    }

    async activateChatView() {
        const { workspace } = this.app;

        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(VIEW_TYPE_CHAT);

        if (leaves.length > 0) {
            // A chat view already exists, focus it
            leaf = leaves[0];
        } else {
            // No chat view exists, create one
            leaf = workspace.getRightLeaf(false);
            if (leaf) {
                await leaf.setViewState({ type: VIEW_TYPE_CHAT, active: true });
            }
        }

        // Reveal the leaf
        if (leaf) {
            workspace.revealLeaf(leaf);
        }
    }
}