import { Plugin } from 'obsidian';
import './src/input.css';
import type { CortexSettings } from './src/settings/settings';
import { DEFAULT_SETTINGS } from './src/settings/settings';
import { CortexSettingTab } from './src/settings/settings-tab';
import { registerChatView, activateChatView, VIEW_TYPE_CHAT } from './src/ui/chat-view';

export default class CortexPlugin extends Plugin {
    settings!: CortexSettings;

    async onload(): Promise<void> {
        console.log('Loading Cortex plugin (Vite build)');

        // 加载设置
        await this.loadSettings();

        // 注册 ChatView
        registerChatView(this);

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
    }

    async onunload(): Promise<void> {
        console.log('Unloading Cortex plugin');
    }

    async loadSettings(): Promise<void> {
        const savedData = await this.loadData();
        this.settings = Object.assign({}, DEFAULT_SETTINGS, savedData);
        
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
                this.settings.providers.openai.models = [{
                    id: savedData.openaiDefaultModel,
                    name: savedData.openaiDefaultModel,
                    modelName: savedData.openaiDefaultModel,
                }];
            }
            if (savedData.openrouterDefaultModel) {
                this.settings.providers.openrouter.models = [{
                    id: savedData.openrouterDefaultModel,
                    name: savedData.openrouterDefaultModel,
                    modelName: savedData.openrouterDefaultModel,
                }];
            }
            // 保存迁移后的设置
            await this.saveSettings();
        }
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
    }
}
