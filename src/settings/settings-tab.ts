import { App, Modal, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { mount, unmount } from 'svelte';
import SettingsComponent from './Settings.svelte';
import type { CortexSettings, ModelSettings } from './settings';

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
                onOpenModal: (model: ModelSettings | null, onSaveModel: (model: ModelSettings) => void) => {
                    const modal = new ModelConfigModal(this.app, model, async (savedModel) => {
                        onSaveModel(savedModel);
                        await this.plugin.saveSettings();
                        this.display();
                    });
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

class ModelConfigModal extends Modal {
    private model: ModelSettings | null;
    private onSave: (model: ModelSettings) => void;

    constructor(app: App, model: ModelSettings | null, onSave: (model: ModelSettings) => void) {
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
        const modelNameValue = this.model?.modelName || '';

        new Setting(contentEl).setName('Display Name').addText((text) => {
            text.setPlaceholder('My Model').setValue(nameValue);
            text.inputEl.dataset.field = 'name';
        });

        new Setting(contentEl).setName('Model Name').setDesc('The actual model identifier sent to the API').addText((text) => {
            text.setPlaceholder('gpt-4o-mini').setValue(modelNameValue);
            text.inputEl.dataset.field = 'modelName';
        });

        new Setting(contentEl).addButton((btn) => {
            btn.setButtonText('Save').setCta().onClick(() => {
                const nameInput = contentEl.querySelector('input[data-field="name"]') as HTMLInputElement;
                const modelNameInput = contentEl.querySelector('input[data-field="modelName"]') as HTMLInputElement;

                const newModel: ModelSettings = {
                    id: this.model?.id || `model-${Date.now()}`,
                    name: nameInput.value.trim() || modelNameInput.value.trim(),
                    modelName: modelNameInput.value.trim(),
                };

                if (newModel.modelName) {
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
