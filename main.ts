import { Plugin, WorkspaceLeaf } from 'obsidian';
import { AgentManager } from './src/agent/agent-manager';
import { ProviderManager } from './src/providers/provider-manager';
import { PersistenceManager, PGliteResourceLoader } from './src/persistence';
import { ChatViewLeaf, VIEW_TYPE_CHAT } from './src/ui/view/ChatViewLeaf';
import { AgentViewLeaf, VIEW_TYPE_AGENT } from './src/ui/view/AgentViewLeaf';
import { CortexSettingTab } from './src/ui/settings/CortexSettingTab';
import type { PluginSettings, CreateProviderInput } from './src/types';
import { SettingsService } from './src/services/settings-service';
import { ProviderService } from './src/services/provider-service';
import { SessionService } from './src/services/session-service';
import { SimpleEventBus, type EventBus } from './src/services/event-bus';

export default class CortexPlugin extends Plugin {
    private agentManager: AgentManager;
    private providerManager: ProviderManager;
    private providerService: ProviderService;
    private sessionService: SessionService;
    public eventBus: EventBus;
    private settingsService: SettingsService;
    private persistenceManager: PersistenceManager | null = null;
    public settings: PluginSettings;

    async onload() {
        console.log('Loading Cortex Plugin');

        try {
            // Create services
            this.settingsService = new SettingsService(this);
            this.eventBus = new SimpleEventBus();

            // Load + migrate + seed settings
            this.settings = await this.settingsService.load();

            // Initialize the managers
            this.providerManager = new ProviderManager();
            this.providerService = new ProviderService(this.providerManager);
            
            // Initialize persistence manager with PGlite resource loading
            try {
                console.log('Loading PGlite resources...');
                const pgliteResources = await PGliteResourceLoader.loadResources();
                
                if (pgliteResources) {
                    console.log('PGlite resources loaded successfully');
                    
                    this.persistenceManager = new PersistenceManager(this, {
                        wasmModule: pgliteResources.wasmModule,
                        fsBundle: pgliteResources.fsBundle
                        // 不需要 pluginBasePath，因为我们使用 IndexedDB 存储
                    });
                    
                    await this.persistenceManager.initialize();
                    console.log('PersistenceManager initialized successfully');
                } else {
                    console.warn('Failed to load PGlite resources, continuing without persistence');
                    this.persistenceManager = null;
                }
            } catch (error) {
                console.error('Failed to initialize PersistenceManager:', error);
                // 如果数据库初始化失败，继续使用内存模式
                this.persistenceManager = null;
            }
            
            // Initialize agent + session services with persistence
            this.agentManager = new AgentManager(this.providerManager, this.persistenceManager);
            this.sessionService = new SessionService(this.persistenceManager);
            
            // Load existing agents from database (only if persistence is available)
            if (this.persistenceManager) {
                try {
                    await this.agentManager.loadAgentsFromDatabase();
                } catch (error) {
                    console.error('Failed to load agents from database:', error);
                }
            }

            // Initialize providers from settings via service
            await this.providerService.refreshFromSettings(this.settings);

            // Register the chat view
            this.registerView(
                VIEW_TYPE_CHAT,
                (leaf) => new ChatViewLeaf(leaf, this.agentManager, this.providerManager, () => this.settings, this.sessionService, this.eventBus)
            );

            // Register the agent management view
            this.registerView(
                VIEW_TYPE_AGENT,
                (leaf) => new AgentViewLeaf(leaf, this.agentManager, this.providerManager, () => this.settings)
            );

            // Register settings tab
            this.addSettingTab(new CortexSettingTab(this.app, this));

            // Load settings CSS
            this.loadSettingsCSS();

            // Add command to open chat view
            this.addCommand({
                id: 'open-cortex-chat',
                name: 'Open Cortex Chat',
                callback: () => {
                    this.activateChatView();
                }
            });

            // Add command to open agent view
            this.addCommand({
                id: 'open-cortex-agents',
                name: 'Open Cortex Agents',
                callback: () => {
                    this.activateAgentView();
                }
            });

            // Add ribbon icon
            this.addRibbonIcon('message-circle', 'Cortex Chat', () => {
                this.activateChatView();
            });

            // Optional: second ribbon icon for agents
            this.addRibbonIcon('bot', 'Cortex Agents', () => {
                this.activateAgentView();
            });

            console.log('Cortex Plugin loaded successfully');
        } catch (error) {
            console.error('Failed to load Cortex Plugin:', error);
            throw error;
        }
    }

    async onunload() {
        console.log('Unloading Cortex Plugin');
        
        // Clean up persistence manager
        if (this.persistenceManager) {
            try {
                await this.persistenceManager.dispose();
            } catch (error) {
                console.error('Error disposing persistence manager:', error);
            }
        }
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

    async activateAgentView() {
        const { workspace } = this.app;

        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(VIEW_TYPE_AGENT);

        if (leaves.length > 0) {
            leaf = leaves[0];
        } else {
            leaf = workspace.getRightLeaf(false);
            if (leaf) {
                await leaf.setViewState({ type: VIEW_TYPE_AGENT, active: true });
            }
        }

        if (leaf) {
            workspace.revealLeaf(leaf);
        }
    }

    async saveSettings() {
        await this.settingsService.save(this.settings);
    }

    async addCustomProvider(input: CreateProviderInput) {
        // Generate unique ID
        const id = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Add to settings
        this.settings.providers.push({
            id,
            name: input.name,
            providerType: 'OpenAICompatible',
            apiKey: input.apiKey,
            baseUrl: input.baseUrl,
            enabled: true,
            models: [],
        });

        // Save settings
        await this.saveSettings();

        // Add to provider manager
        await this.providerManager.addProvider({
            id,
            name: input.name,
            providerType: 'OpenAICompatible',
            apiKey: input.apiKey,
            baseUrl: input.baseUrl,
            enabled: true,
        });

        // Make it the active provider
        this.settings.activeProviderId = id;
        await this.saveSettings();
    }

    async refreshProviders() {
        await this.providerService.refreshFromSettings(this.settings);
        // Notify via typed event bus
        this.eventBus.emit('providersUpdated');
    }

    private loadSettingsCSS() {
        // This method will be called to load settings-specific CSS
        // For now, we'll use the existing styles.css
        // In a real implementation, you might want to load additional CSS files
    }

    // Settings migration moved to SettingsService
}
