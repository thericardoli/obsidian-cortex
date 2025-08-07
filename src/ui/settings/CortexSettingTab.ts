import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type CortexPlugin from '../../../main';
import type { CreateProviderInput, ProviderModelEntry } from '../../types';
import { CreateProviderInputSchema } from '../../types';

export class CortexSettingTab extends PluginSettingTab {
	plugin: CortexPlugin;
	private selectedProviderKey: string | null = null; // provider id
	private showAddProviderForm = false;

	constructor(app: App, plugin: CortexPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// Page title
		containerEl.createEl('h2', { text: 'Cortex Plugin Settings' });

		// Provider dock + details view
		this.renderProviderDock();
		this.renderAddProviderControls();
		this.renderSelectedProviderPage();
	}

	// --- New UI below ---

	private renderProviderDock(): void {
		const { containerEl } = this;
		const dock = containerEl.createDiv({ cls: 'provider-dock' });
		dock.createEl('h3', { text: 'Providers' });

		// Build from unified providers list
		const entries = this.plugin.settings.providers.map(p => ({ key: p.id, label: p.name }));

		// Default selection from saved activeProviderId or first provider
		if (!this.selectedProviderKey) this.selectedProviderKey = this.plugin.settings.activeProviderId || entries[0]?.key || null;

		const btnRow = dock.createDiv({ cls: 'provider-dock-row' });
		entries.forEach(e => {
			const btn = btnRow.createEl('button', { text: e.label });
			btn.addClass('mod-cta');
			if (this.selectedProviderKey === e.key) btn.addClass('is-active');
			btn.onclick = async () => {
				this.selectedProviderKey = e.key;
				this.plugin.settings.activeProviderId = e.key;
				await this.plugin.saveSettings();
				this.display();
			};
		});
	}

	private renderAddProviderControls(): void {
		const { containerEl } = this;
		const wrap = containerEl.createDiv({ cls: 'provider-add-wrap' });
		new Setting(wrap)
			.setName('Add Provider')
			.setDesc('Add an OpenAI-compatible provider')
			.addButton(btn =>
				btn.setButtonText(this.showAddProviderForm ? 'Close' : 'New Provider')
					.onClick(() => {
						this.showAddProviderForm = !this.showAddProviderForm;
						this.display();
					})
			);

		if (!this.showAddProviderForm) return;

		let nameValue = '';
		let baseUrlValue = '';
		let apiKeyValue = '';

		const formContainer = wrap.createDiv('provider-form-container');
		formContainer.createEl('h4', { text: 'Add New Provider' });

		new Setting(formContainer)
			.setName('Provider Name')
			.setDesc('Displayed in the dock')
			.addText(t => t.setPlaceholder('My Provider').onChange(v => (nameValue = v)));

		new Setting(formContainer)
			.setName('Base URL')
			.setDesc('OpenAI-compatible API base URL')
			.addText(t => t.setPlaceholder('https://api.example.com/v1').onChange(v => (baseUrlValue = v)));

		new Setting(formContainer)
			.setName('API Key')
			.setDesc('API key for this provider')
			.addText(t => t.setPlaceholder('your-api-key').onChange(v => (apiKeyValue = v)));

		new Setting(formContainer).addButton(b =>
			b.setButtonText('Add').setCta().onClick(async () => {
				try {
					const input: CreateProviderInput = { name: nameValue, baseUrl: baseUrlValue, apiKey: apiKeyValue };
					CreateProviderInputSchema.parse(input);
					await this.plugin.addCustomProvider(input);
					this.showAddProviderForm = false;
					new Notice('Provider added successfully!');
					this.display();
				} catch (err) {
					console.error('Error adding provider:', err);
					new Notice(err instanceof Error ? `Error: ${err.message}` : 'Failed to add provider');
				}
			})
		);
	}

	private renderSelectedProviderPage(): void {
		const { containerEl } = this;
		const page = containerEl.createDiv({ cls: 'provider-page' });

		const key = this.selectedProviderKey;
		if (!key) return;
		const pIndex = this.plugin.settings.providers.findIndex(p => p.id === key);
		if (pIndex >= 0) this.renderProviderPage(page, pIndex);
	}

	private renderProviderPage(host: HTMLElement, index: number): void {
		const provider = this.plugin.settings.providers[index];
		host.createEl('h3', { text: provider.name });

		new Setting(host)
			.setName('Provider Name')
			.setDesc('Displayed in the dock')
			.addText(t =>
				t.setValue(provider.name).onChange(async v => {
					this.plugin.settings.providers[index].name = v;
					await this.plugin.saveSettings();
					this.display();
				})
			)
			.addExtraButton(b =>
				b.setIcon('trash')
					.setTooltip('Remove provider')
					.onClick(async () => {
					this.plugin.settings.providers.splice(index, 1);
						await this.plugin.saveSettings();
						await this.plugin.refreshProviders();
						this.selectedProviderKey = this.plugin.settings.activeProviderId = this.plugin.settings.providers[0]?.id ?? null;
						this.display();
						new Notice('Provider removed successfully!');
					})
			);

		// Base URL for OpenAI-compatible providers only
		if (provider.providerType === 'OpenAICompatible') {
			new Setting(host)
				.setName('Base URL')
				.setDesc('OpenAI-compatible API base URL')
				.addText(t =>
					t.setValue(provider.baseUrl || '')
						.onChange(async v => {
							this.plugin.settings.providers[index].baseUrl = v;
							this.plugin.settings.providers[index].enabled = !!v;
							await this.plugin.saveSettings();
							await this.plugin.refreshProviders();
						})
				);
		}

		new Setting(host)
			.setName('API Key')
			.setDesc('API key for this provider')
			.addText(t =>
				t.setValue(provider.apiKey || '')
					.onChange(async v => {
						this.plugin.settings.providers[index].apiKey = v;
						await this.plugin.saveSettings();
						await this.plugin.refreshProviders();
					})
			);

		this.renderModelsEditor(host, provider.id);
	}

	private renderModelsEditor(host: HTMLElement, providerKey: string): void {
		host.createEl('h4', { text: 'Models' });

		// Resolve model list reference
		const getModels = (): ProviderModelEntry[] => {
			const idx = this.plugin.settings.providers.findIndex(p => p.id === providerKey);
			return idx >= 0 ? this.plugin.settings.providers[idx].models : [];
		};
		const setModels = async (models: ProviderModelEntry[]) => {
			const idx = this.plugin.settings.providers.findIndex(p => p.id === providerKey);
			if (idx >= 0) this.plugin.settings.providers[idx].models = models;
			await this.plugin.saveSettings();
		};

		// Add form
		let displayName = '';
		let modelId = '';
		const addWrap = host.createDiv({ cls: 'model-add-wrap' });
		new Setting(addWrap)
			.setName('Model display name')
			.addText(t => t.setPlaceholder('GPT‑4.1 (friendly)').onChange(v => (displayName = v)));
		new Setting(addWrap)
			.setName('Model ID')
			.setDesc('API model identifier, e.g., gpt-4o-mini')
			.addText(t => t.setPlaceholder('gpt-4o-mini').onChange(v => (modelId = v)));
		new Setting(addWrap).addButton(b =>
			b.setButtonText('Add model').setCta().onClick(async () => {
				const list = getModels();
				const next = [...list, { displayName, modelId }];
				await setModels(next);
				new Notice('Model added');
				this.display();
			})
		);

		// Existing models
		const listWrap = host.createDiv({ cls: 'model-list-wrap' });
		getModels().forEach((m, idx) => {
			new Setting(listWrap)
				.setName(m.displayName)
				.setDesc(`ID: ${m.modelId}`)
				.addExtraButton(b =>
					b.setIcon('trash').setTooltip('Remove').onClick(async () => {
						const list = getModels();
						list.splice(idx, 1);
						await setModels([...list]);
						this.display();
						new Notice('Model removed');
					})
				);
		});
	}
}
