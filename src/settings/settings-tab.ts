import { App, Modal, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { mount, unmount } from 'svelte';

import SettingsComponent from './Settings.svelte';

import type { ModelConfig } from '../types/model';
import type { CortexSettings, CustomProviderConfig } from './settings';

export interface CortexPluginInterface extends Plugin {
    settings: CortexSettings;
    saveSettings(): Promise<void>;
}

export class CortexSettingTab extends PluginSettingTab {
    plugin: CortexPluginInterface;
    private component: ReturnType<typeof mount> | null = null;

    constructor(app: App, plugin: CortexPluginInterface) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        // 先卸载之前的组件
        if (this.component) {
            unmount(this.component);
            this.component = null;
        }

        containerEl.empty();

        // 挂载 Svelte 组件
        this.component = mount(SettingsComponent, {
            target: containerEl,
            props: {
                settings: this.plugin.settings,
                onSave: async () => {
                    await this.plugin.saveSettings();
                },
                onRefresh: () => {
                    this.display();
                },
                onOpenModal: (
                    model: ModelConfig | null,
                    onSaveModel: (model: ModelConfig) => void
                ) => {
                    const modal = new ModelConfigModal(this.app, model, async (savedModel) => {
                        onSaveModel(savedModel);
                        await this.plugin.saveSettings();
                        this.display();
                    });
                    modal.open();
                },
                onOpenProviderModal: (
                    provider: CustomProviderConfig | null,
                    onSaveProvider: (provider: CustomProviderConfig) => void
                ) => {
                    const usedProviderIds = new Set<string>(
                        Object.keys(this.plugin.settings.providers || {})
                    );
                    for (const p of this.plugin.settings.customProviders || []) {
                        usedProviderIds.add(p.id);
                    }

                    const modal = new CustomProviderModal(
                        this.app,
                        provider,
                        usedProviderIds,
                        async (savedProvider) => {
                            onSaveProvider(savedProvider);
                            await this.plugin.saveSettings();
                            this.display();
                        }
                    );
                    modal.open();
                },
            },
        });
    }

    hide(): void {
        // SettingTab 关闭时卸载 Svelte 组件
        if (this.component) {
            unmount(this.component);
            this.component = null;
        }
    }
}

function slugifyProviderId(label: string): string {
    const slug = label
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');

    return slug;
}

function createUniqueProviderId(base: string, used: Set<string>): string {
    const normalizedBase = base || '';
    if (!used.has(normalizedBase)) return normalizedBase;

    let counter = 2;
    while (used.has(`${normalizedBase}-${counter}`)) {
        counter += 1;
    }
    return `${normalizedBase}-${counter}`;
}

class CustomProviderModal extends Modal {
    private provider: CustomProviderConfig | null;
    private usedProviderIds: Set<string>;
    private onSave: (provider: CustomProviderConfig) => void;

    constructor(
        app: App,
        provider: CustomProviderConfig | null,
        usedProviderIds: Set<string>,
        onSave: (provider: CustomProviderConfig) => void
    ) {
        super(app);
        this.provider = provider;
        this.usedProviderIds = usedProviderIds;
        this.onSave = onSave;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('cortex-provider-modal');

        contentEl.createEl('h3', {
            text: this.provider ? 'Edit Custom Provider' : 'Add Custom Provider',
        });

        const nameValue = this.provider?.name || '';
        const baseUrlValue = this.provider?.baseUrl || '';
        const apiKeyValue = this.provider?.apiKey || '';

        new Setting(contentEl)
            .setName('Provider Name')
            .setDesc('A display name for this provider')
            .addText((text) => {
                text.setPlaceholder('My Custom Provider').setValue(nameValue);
                text.inputEl.dataset.field = 'name';
            });

        new Setting(contentEl)
            .setName('Base URL')
            .setDesc('The API base URL (OpenAI-compatible format)')
            .addText((text) => {
                text.setPlaceholder('https://api.example.com/v1').setValue(baseUrlValue);
                text.inputEl.dataset.field = 'baseUrl';
            });

        new Setting(contentEl)
            .setName('API Key')
            .setDesc('Your API key for this provider')
            .addText((text) => {
                text.setPlaceholder('sk-...').setValue(apiKeyValue);
                text.inputEl.inputMode = 'password';
                text.inputEl.dataset.field = 'apiKey';
            });

        new Setting(contentEl).addButton((btn) => {
            btn.setButtonText('Save')
                .setCta()
                .onClick(() => {
                    const nameInput = contentEl.querySelector(
                        'input[data-field="name"]'
                    ) as HTMLInputElement;
                    const baseUrlInput = contentEl.querySelector(
                        'input[data-field="baseUrl"]'
                    ) as HTMLInputElement;
                    const apiKeyInput = contentEl.querySelector(
                        'input[data-field="apiKey"]'
                    ) as HTMLInputElement;

                    const name = nameInput.value.trim();
                    const baseUrl = baseUrlInput.value.trim();
                    const apiKey = apiKeyInput.value.trim();

                    if (name && baseUrl) {
                        const existingId = this.provider?.id;
                        const slug = slugifyProviderId(name) || `custom-${Date.now()}`;
                        const used = new Set(this.usedProviderIds);
                        if (existingId) used.delete(existingId);

                        const newProvider: CustomProviderConfig = {
                            id: existingId || createUniqueProviderId(slug, used),
                            name,
                            baseUrl,
                            apiKey,
                        };
                        this.onSave(newProvider);
                        this.close();
                    }
                });
        });
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class ModelConfigModal extends Modal {
    private model: ModelConfig | null;
    private onSave: (model: ModelConfig) => void;

    constructor(app: App, model: ModelConfig | null, onSave: (model: ModelConfig) => void) {
        super(app);
        this.model = model;
        this.onSave = onSave;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('cortex-model-modal');

        contentEl.createEl('h3', { text: this.model ? 'Edit Model' : 'Add Model' });

        const nameValue = this.model?.name || '';
        const modelIDValue = this.model?.modelID || '';

        new Setting(contentEl).setName('Display Name').addText((text) => {
            text.setPlaceholder('My Model').setValue(nameValue);
            text.inputEl.dataset.field = 'name';
        });

        new Setting(contentEl)
            .setName('Model Name')
            .setDesc('The actual model identifier sent to the API')
            .addText((text) => {
                text.setPlaceholder('gpt-4o-mini').setValue(modelIDValue);
                text.inputEl.dataset.field = 'modelID';
            });

        new Setting(contentEl).addButton((btn) => {
            btn.setButtonText('Save')
                .setCta()
                .onClick(() => {
                    const nameInput = contentEl.querySelector(
                        'input[data-field="name"]'
                    ) as HTMLInputElement;
                    const modelIDInput = contentEl.querySelector(
                        'input[data-field="modelID"]'
                    ) as HTMLInputElement;

                    const newModel: ModelConfig = {
                        id: this.model?.id || `model-${Date.now()}`,
                        name: nameInput.value.trim() || modelIDInput.value.trim(),
                        modelID: modelIDInput.value.trim(),
                    };

                    if (newModel.modelID) {
                        this.onSave(newModel);
                        this.close();
                    }
                });
        });
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}
