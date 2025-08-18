import { Plugin, WorkspaceLeaf } from 'obsidian';
import { AgentManager } from './src/agent/agent-manager';
import { ProviderManager } from './src/providers/provider-manager';
import { PersistenceManager, PGliteResourceLoader } from './src/persistence';
import { ChatViewLeaf, VIEW_TYPE_CHAT } from './src/ui/view/ChatViewLeaf';
import { AgentViewLeaf, VIEW_TYPE_AGENT } from './src/ui/view/AgentViewLeaf';
import { CortexSettingTab } from './src/ui/settings/CortexSettingTab';
import type { PluginSettings, CreateProviderInput } from './src/types';
import { SettingsService } from './src/settings/settings-service';
import { ProviderService } from './src/providers/provider-service';
import { SessionService } from './src/session/session-service';
import { AgentService } from './src/agent/agent-service';
import { SimpleEventBus, type EventBus } from './src/utils/event-bus';
import { createLogger } from './src/utils/logger';
import { registerAllBuiltinFunctionExecutors } from './src/tool/builtin';

const logger = createLogger('main');

export default class CortexPlugin extends Plugin {
    private agentManager: AgentManager;
    private providerManager: ProviderManager;
    private providerService: ProviderService;
    private agentService: AgentService;
    private sessionService: SessionService;
    public eventBus: EventBus;
    private settingsService: SettingsService;
    private persistenceManager: PersistenceManager;
    public settings: PluginSettings;

    async onload() {
        logger.info('Loading Cortex Plugin');

        try {
            // Create services
            this.settingsService = new SettingsService(this);
            this.eventBus = new SimpleEventBus();

            // Load + migrate + seed settings
            this.settings = await this.settingsService.load();

            // Initialize the managers
            this.providerManager = new ProviderManager();
            this.providerService = new ProviderService(this.providerManager);
            
            // Initialize persistence manager (load resources first to maximize success rate)
            try {
                logger.info('Loading PGlite resources...');
                const pgliteResources = await PGliteResourceLoader.loadResources();
                if (pgliteResources) {
                    this.persistenceManager = new PersistenceManager({
                        wasmModule: pgliteResources.wasmModule,
                        fsBundle: pgliteResources.fsBundle,
                    });
                } else {
                    logger.warn('PGlite resources unavailable, using memory mode (existing IDB data will NOT load)');
                    this.persistenceManager = new PersistenceManager();
                }
                await this.persistenceManager.initialize();
                logger.info('PersistenceManager initialized (persistent=' + this.persistenceManager.isPersistent() + ')');
            } catch (error) {
                logger.error('Failed to initialize persistence (memory mode fallback)', error);
                this.persistenceManager = new PersistenceManager();
            }
            
            // Initialize agent + session services with repositories (Milestone 1 decoupling)
            this.agentManager = new AgentManager(
                this.persistenceManager.getAgentRepository(),
                this.eventBus
            );
            this.agentService = new AgentService(this.agentManager, this.providerManager); // 运行态装配独立
            this.sessionService = new SessionService(this.persistenceManager.getSessionRepository());

            // Register builtin function tool executors (requires Obsidian app context -> this.app)
            registerAllBuiltinFunctionExecutors((name, exec) => {
                this.agentManager.registerFunctionToolExecutor(name, exec);
            }, this.app);
            
            // Load existing agents from database (only if persistence is available)
            try {
                await this.agentManager.loadAgentsFromDatabase();
            } catch (error) {
                logger.error('Failed to load agents (repository)', error);
            }

            // Initialize providers from settings via service
            await this.providerService.refreshFromSettings(this.settings);

            // Register the chat view
            this.registerView(
                VIEW_TYPE_CHAT,
                (leaf) => new ChatViewLeaf(leaf, this.agentManager, this.providerManager, this.agentService, () => this.settings, this.sessionService, this.eventBus)
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

            logger.info('Cortex Plugin loaded successfully');
        } catch (error) {
            logger.error('Failed to load Cortex Plugin', error);
            throw error;
        }
    }

    async onunload() {
        logger.info('Unloading Cortex Plugin');
        
        // Clean up persistence manager
        try {
            await this.persistenceManager.dispose();
        } catch (error) {
            logger.error('Error disposing persistence manager', error);
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
