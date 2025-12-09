import { Plugin } from 'obsidian';
import './src/input.css';
import type { AgentConfig } from './src/types/agent';
import type { CortexSettings } from './src/settings/settings';
import { DEFAULT_AGENT_CONFIGS, DEFAULT_SETTINGS, SETTINGS_UPDATED_EVENT } from './src/settings/settings';
import { CortexSettingTab } from './src/settings/settings-tab';
import { registerChatView, activateChatView } from './src/ui/chat-view';
import { activateAgentConfigView, registerAgentConfigView } from './src/ui/agent-config-view';
import { initializePersistence } from './src/core/persistence/bootstrap';

export default class CortexPlugin extends Plugin {
    settings!: CortexSettings;
    private legacyAgentConfigs: AgentConfig[] = [];

    async onload(): Promise<void> {
        console.log('Loading Cortex plugin (Vite build)');

        // 加载设置
        await this.loadSettings();
        await initializePersistence(this.legacyAgentConfigs.length > 0 ? this.legacyAgentConfigs : DEFAULT_AGENT_CONFIGS);

        // 注册 ChatView
        registerChatView(this);
        registerAgentConfigView(this);

        // 添加设置页
        this.addSettingTab(new CortexSettingTab(this.app, this));

        // 添加打开聊天视图的命令
        this.addCommand({
            id: 'open-chat-view',
            name: 'Open chat view',
            callback: () => activateChatView(this.app),
        });

        // 添加 ribbon 图标
        this.addRibbonIcon('message-circle', 'Open Cortex Chat', () => {
            activateChatView(this.app);
        });

        this.addRibbonIcon('sliders-horizontal', 'Open Agent Config', () => {
            activateAgentConfigView(this.app);
        });

        this.addCommand({
            id: 'open-agent-config-view',
            name: 'Open agent config view',
            callback: () => activateAgentConfigView(this.app),
        });
    }

    async onunload(): Promise<void> {
        console.log('Unloading Cortex plugin');
    }

    async loadSettings(): Promise<void> {
        const savedData = await this.loadData();
        const { agentConfigs = [], agentConfigData, ...rest } = savedData || {};
        this.legacyAgentConfigs = this.extractLegacyAgents(agentConfigs, agentConfigData);
        this.settings = Object.assign({}, DEFAULT_SETTINGS, rest);

        // 迁移旧设置到新结构
        if (savedData && !savedData.providers) {
            // 旧设置存在但没有新的 providers 字段，进行迁移
            if (savedData.openaiApiKey) {
                this.settings.providers.openai.apiKey = savedData.openaiApiKey;
            }
            if (savedData.openrouterApiKey) {
                this.settings.providers.openrouter.apiKey = savedData.openrouterApiKey;
            }
            if (savedData.openaiDefaultModel) {
                this.settings.providers.openai.models = [
                    {
                        id: savedData.openaiDefaultModel,
                        name: savedData.openaiDefaultModel,
                        modelName: savedData.openaiDefaultModel,
                    },
                ];
            }
            if (savedData.openrouterDefaultModel) {
                this.settings.providers.openrouter.models = [
                    {
                        id: savedData.openrouterDefaultModel,
                        name: savedData.openrouterDefaultModel,
                        modelName: savedData.openrouterDefaultModel,
                    },
                ];
            }
            // 保存迁移后的设置
            await this.saveSettings();
        }
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
        this.app.workspace.trigger(SETTINGS_UPDATED_EVENT, this.settings);
    }

    private extractLegacyAgents(
        agentConfigs: unknown,
        agentConfigData: unknown
    ): AgentConfig[] {
        const fromAgentConfigs =
            Array.isArray(agentConfigs) && agentConfigs.length > 0
                ? agentConfigs
                : [];

        const fromAgentConfigData =
            agentConfigData &&
            typeof agentConfigData === 'object' &&
            'configs' in (agentConfigData as Record<string, unknown>)
                ? Object.values(
                      ((agentConfigData as { configs?: Record<string, unknown> }).configs ||
                          {}) as Record<string, Partial<AgentConfig>>
                  )
                : [];

        const candidates = [...fromAgentConfigs, ...fromAgentConfigData] as Partial<AgentConfig>[];

        return candidates.map((config, index) => ({
            id: config.id || crypto.randomUUID(),
            name: config.name || `Agent ${index + 1}`,
            kind: config.kind || 'custom',
            instructions: config.instructions || '',
            description: config.description || config.handoffDescription || '',
            handoffDescription: config.handoffDescription || config.description || '',
            handoffIds: config.handoffIds || [],
            toolIds: config.toolIds || [],
            modelId: config.modelId,
            defaultModelId: config.defaultModelId || config.modelId,
            enabled: config.enabled ?? true,
        }));
    }
}
