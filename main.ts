import { Plugin, WorkspaceLeaf } from 'obsidian';
import { AgentManager } from './src/agent/agent-manager';
import { ProviderManager } from './src/providers/provider-manager';
import { PersistenceManager, PGliteResourceLoader } from './src/persistence';
import { ChatViewLeaf, VIEW_TYPE_CHAT } from './src/ui/view/ChatViewLeaf';
import { AgentViewLeaf, VIEW_TYPE_AGENT } from './src/ui/view/AgentViewLeaf';
import { CortexSettingTab } from './src/ui/settings/CortexSettingTab';
import type { PluginSettings, CreateProviderInput } from './src/types';
import { DEFAULT_SETTINGS, PluginSettingsSchema } from './src/types';

export default class CortexPlugin extends Plugin {
    private agentManager: AgentManager;
    private providerManager: ProviderManager;
    private persistenceManager: PersistenceManager | null = null;
    public settings: PluginSettings;

    async onload() {
        console.log('Loading Cortex Plugin');

        try {
            // Load settings
            await this.loadSettings();

            // Initialize the managers
            this.providerManager = new ProviderManager();
            
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
            
            // Initialize agent manager with persistence
            this.agentManager = new AgentManager(this.providerManager, this.persistenceManager);
            
            // Load existing agents from database (only if persistence is available)
            if (this.persistenceManager) {
                try {
                    await this.agentManager.loadAgentsFromDatabase();
                } catch (error) {
                    console.error('Failed to load agents from database:', error);
                }
            }

            // Initialize providers from settings
            await this.initializeProvidersFromSettings();

            // Register the chat view
            this.registerView(
                VIEW_TYPE_CHAT,
                (leaf) => new ChatViewLeaf(leaf, this.agentManager, this.providerManager)
            );

            // Register the agent view
            this.registerView(
                VIEW_TYPE_AGENT,
                (leaf) => new AgentViewLeaf(leaf, this.agentManager, this.providerManager)
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
            // An agent view already exists, focus it
            leaf = leaves[0];
        } else {
            // No agent view exists, create one
            leaf = workspace.getRightLeaf(false);
            if (leaf) {
                await leaf.setViewState({ type: VIEW_TYPE_AGENT, active: true });
            }
        }

        // Reveal the leaf
        if (leaf) {
            workspace.revealLeaf(leaf);
        }
    }

    async loadSettings() {
        const data = await this.loadData();
        this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
        
        // Validate settings with Zod
        try {
            this.settings = PluginSettingsSchema.parse(this.settings);
        } catch (error) {
            console.warn('Invalid plugin settings, using defaults:', error);
            this.settings = DEFAULT_SETTINGS;
        }
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async initializeProvidersFromSettings() {
        // Initialize OpenAI provider if configured
        if (this.settings.openai.enabled && this.settings.openai.apiKey) {
            try {
                await this.providerManager.addProvider({
                    id: 'openai-default',
                    name: 'OpenAI',
                    providerType: 'OpenAI',
                    apiKey: this.settings.openai.apiKey,
                    baseUrl: 'https://api.openai.com/v1',
                    enabled: true,
                });
            } catch (error) {
                console.error('Failed to initialize OpenAI provider:', error);
            }
        }

        // Initialize custom providers
        for (const providerConfig of this.settings.providers) {
            if (providerConfig.enabled) {
                try {
                    await this.providerManager.addProvider({
                        id: providerConfig.id,
                        name: providerConfig.name,
                        providerType: 'OpenAICompatible',
                        apiKey: providerConfig.apiKey,
                        baseUrl: providerConfig.baseUrl,
                        enabled: true,
                    });
                } catch (error) {
                    console.error(`Failed to initialize provider ${providerConfig.name}:`, error);
                }
            }
        }
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
    }

    async refreshProviders() {
        // Clear existing providers
        this.providerManager = new ProviderManager();
        
        // Re-initialize from settings
        await this.initializeProvidersFromSettings();
    }

    private loadSettingsCSS() {
        // This method will be called to load settings-specific CSS
        // For now, we'll use the existing styles.css
        // In a real implementation, you might want to load additional CSS files
    }
}