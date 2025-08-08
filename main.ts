import { Plugin, WorkspaceLeaf } from 'obsidian';
import { AgentManager } from './src/agent/agent-manager';
import { ProviderManager } from './src/providers/provider-manager';
import { PersistenceManager, PGliteResourceLoader } from './src/persistence';
import { ChatViewLeaf, VIEW_TYPE_CHAT } from './src/ui/view/ChatViewLeaf';
import { AgentViewLeaf, VIEW_TYPE_AGENT } from './src/ui/view/AgentViewLeaf';
import { CortexSettingTab } from './src/ui/settings/CortexSettingTab';
import type { PluginSettings, CreateProviderInput } from './src/types';
import { DEFAULT_SETTINGS, PluginSettingsSchema } from './src/types';
import type { ProviderSettingsEntry } from './src/types';
import { cloneDefaultProviders } from './src/config/provider-defaults';

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
                (leaf) => new ChatViewLeaf(leaf, this.agentManager, this.providerManager, () => this.settings)
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

    async loadSettings() {
        const data = await this.loadData();
        const merged = Object.assign({}, DEFAULT_SETTINGS, data);

    const migrated = this.migrateSettings(merged as unknown);

        // Validate settings with Zod
        try {
            this.settings = PluginSettingsSchema.parse(migrated);
        } catch (error) {
            console.warn('Invalid plugin settings after migration, using defaults:', error);
            this.settings = DEFAULT_SETTINGS;
        }

        // Seed defaults if empty (from central defaults file)
        if (!this.settings.providers || this.settings.providers.length === 0) {
            this.settings.providers = cloneDefaultProviders();
        }

        if (!this.settings.activeProviderId && this.settings.providers.length > 0) {
            this.settings.activeProviderId = this.settings.providers[0].id;
        }

        await this.saveSettings();
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async initializeProvidersFromSettings() {
        // Initialize providers from unified list
        for (const p of this.settings.providers) {
            // Treat as enabled at runtime if credentials are present even when the persisted flag is false
            const runtimeEnabled =
                p.enabled ||
                (p.providerType === 'OpenAI' && !!p.apiKey) ||
                (p.providerType === 'OpenAICompatible' && !!p.baseUrl);

            if (!runtimeEnabled) continue;

            try {
                await this.providerManager.addProvider({
                    id: p.id,
                    name: p.name,
                    providerType: p.providerType,
                    apiKey: p.apiKey,
                    baseUrl: p.baseUrl,
                    enabled: runtimeEnabled,
                });
            } catch (error) {
                console.error(`Failed to initialize provider ${p.name}:`, error);
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
        // Reinitialize providers on the existing manager instance
        await this.providerManager.resetProviders(
            (this.settings.providers || []).map(p => {
                const runtimeEnabled =
                    p.enabled ||
                    (p.providerType === 'OpenAI' && !!p.apiKey) ||
                    (p.providerType === 'OpenAICompatible' && !!p.baseUrl);
                return {
                    id: p.id,
                    name: p.name,
                    providerType: p.providerType,
                    apiKey: p.apiKey,
                    baseUrl: p.baseUrl,
                    enabled: runtimeEnabled,
                };
            })
        );
        // Notify views to refresh dropdowns
        this.app.workspace.trigger('cortex:providers-updated');
    }

    private loadSettingsCSS() {
        // This method will be called to load settings-specific CSS
        // For now, we'll use the existing styles.css
        // In a real implementation, you might want to load additional CSS files
    }

    private migrateSettings(raw: unknown): { providers: ProviderSettingsEntry[]; activeProviderId?: string } {
        const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
        const toStringOr = (v: unknown, fallback: string): string => (typeof v === 'string' ? v : fallback);
        const toBool = (v: unknown): boolean => v === true || v === 'true' || v === 1;
        const toModels = (v: unknown): { displayName: string; modelId: string }[] =>
            Array.isArray(v)
                ? v
                    .map((m) => (isRecord(m) ? { displayName: toStringOr(m.displayName, ''), modelId: toStringOr(m.modelId, '') } : null))
                    .filter((m): m is { displayName: string; modelId: string } => !!m && m.displayName !== '' && m.modelId !== '')
                : [];

        const r = isRecord(raw) ? raw : {};

        // If already in new shape, normalize models for each provider
        const rProviders = Array.isArray(r.providers) ? (r.providers as unknown[]) : undefined;
        if (rProviders) {
            const providers: ProviderSettingsEntry[] = rProviders
                .map((p) => (isRecord(p) ? p : null))
                .filter((p): p is Record<string, unknown> => !!p)
                .map((p) => ({
                    id: toStringOr(p.id, ''),
                    name: toStringOr(p.name, 'Provider'),
                    providerType: (p.providerType === 'OpenAI' ? 'OpenAI' : 'OpenAICompatible') as 'OpenAI' | 'OpenAICompatible',
                    apiKey: typeof p.apiKey === 'string' ? p.apiKey : undefined,
                    baseUrl: typeof p.baseUrl === 'string' ? p.baseUrl : undefined,
                    enabled: toBool(p.enabled),
                    models: toModels(p.models),
                }))
                .filter((p) => p.id !== '' && p.name !== '');

            return { providers, activeProviderId: typeof r.activeProviderId === 'string' ? r.activeProviderId : undefined };
        }

        // Old shape migration
        const providers: ProviderSettingsEntry[] = [];

        if (isRecord(r.openai)) {
            const openai = r.openai as Record<string, unknown>;
            providers.push({
                id: 'openai-default',
                name: 'OpenAI',
                providerType: 'OpenAI',
                apiKey: typeof openai.apiKey === 'string' ? openai.apiKey : undefined,
                baseUrl: 'https://api.openai.com/v1',
                enabled: toBool(openai.enabled) || typeof openai.apiKey === 'string',
                models: toModels(openai.models),
            });
        }

        if (isRecord(r.ollama)) {
            const ollama = r.ollama as Record<string, unknown>;
            providers.push({
                id: 'ollama-default',
                name: 'Ollama',
                providerType: 'OpenAICompatible',
                apiKey: typeof ollama.apiKey === 'string' ? ollama.apiKey : undefined,
                baseUrl: typeof ollama.baseUrl === 'string' ? ollama.baseUrl : 'http://localhost:11434/v1',
                enabled: toBool(ollama.enabled) || typeof ollama.baseUrl === 'string',
                models: toModels(ollama.models),
            });
        }

        // Old custom providers (without models)
        const legacyProviders = Array.isArray(r.providers) ? (r.providers as unknown[]) : [];
        for (const p of legacyProviders) {
            if (!isRecord(p)) continue;
            providers.push({
                id: toStringOr(p.id, ''),
                name: toStringOr(p.name, 'Provider'),
                providerType: (p.providerType === 'OpenAI' ? 'OpenAI' : 'OpenAICompatible') as 'OpenAI' | 'OpenAICompatible',
                apiKey: typeof p.apiKey === 'string' ? p.apiKey : undefined,
                baseUrl: typeof p.baseUrl === 'string' ? p.baseUrl : undefined,
                enabled: toBool(p.enabled),
                models: toModels(p.models),
            });
        }

        return { providers, activeProviderId: typeof r.activeProviderId === 'string' ? r.activeProviderId : undefined };
    }
}
