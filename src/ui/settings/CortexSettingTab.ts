import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type CortexPlugin from '../../../main';
import type { CreateProviderInput, PluginSettings } from '../../types';
import { CreateProviderInputSchema } from '../../types';

export class CortexSettingTab extends PluginSettingTab {
	plugin: CortexPlugin;

	constructor(app: App, plugin: CortexPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// Page title
		containerEl.createEl('h2', { text: 'Cortex Plugin Settings' });

		// OpenAI Provider section
		this.createOpenAISection();

		// Custom Providers section
		this.createCustomProvidersSection();
	}

	private createOpenAISection(): void {
		const { containerEl } = this;

		// OpenAI section header
		containerEl.createEl('h3', { text: 'OpenAI Provider' });

		// OpenAI API Key setting
		new Setting(containerEl)
			.setName('OpenAI API Key')
			.setDesc('Your OpenAI API key')
			.addText(text => text
				.setPlaceholder('sk-...')
				.setValue(this.plugin.settings.openai.apiKey || '')
				.onChange(async (value) => {
					this.plugin.settings.openai.apiKey = value;
					this.plugin.settings.openai.enabled = !!value;
					await this.plugin.saveSettings();
					await this.plugin.refreshProviders();
				}));

		// OpenAI enabled toggle
		new Setting(containerEl)
			.setName('Enable OpenAI Provider')
			.setDesc('Enable the OpenAI provider')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.openai.enabled)
				.onChange(async (value) => {
					this.plugin.settings.openai.enabled = value;
					await this.plugin.saveSettings();
					await this.plugin.refreshProviders();
				}));
	}

	private createCustomProvidersSection(): void {
		const { containerEl } = this;

		// Custom providers section header
		containerEl.createEl('h3', { text: 'Custom OpenAI-Compatible Providers' });

		// Add new provider form
		this.createAddProviderForm();

		// List existing providers
		this.createProvidersList();
	}

	private createAddProviderForm(): void {
		const { containerEl } = this;

		// Form container
		const formContainer = containerEl.createDiv('provider-form-container');
		formContainer.createEl('h4', { text: 'Add New Provider' });

		let nameValue = '';
		let baseUrlValue = '';
		let apiKeyValue = '';

		// Provider name
		new Setting(formContainer)
			.setName('Provider Name')
			.setDesc('A friendly name for this provider')
			.addText(text => text
				.setPlaceholder('My Custom Provider')
				.onChange((value) => {
					nameValue = value;
				}));

		// Base URL
		new Setting(formContainer)
			.setName('Base URL')
			.setDesc('The base URL for the OpenAI-compatible API')
			.addText(text => text
				.setPlaceholder('https://api.example.com/v1')
				.onChange((value) => {
					baseUrlValue = value;
				}));

		// API Key
		new Setting(formContainer)
			.setName('API Key')
			.setDesc('The API key for this provider')
			.addText(text => text
				.setPlaceholder('Your API key')
				.onChange((value) => {
					apiKeyValue = value;
				}));

		// Add button
		new Setting(formContainer)
			.addButton(button => button
				.setButtonText('Add Provider')
				.setCta()
				.onClick(async () => {
					try {
						const input: CreateProviderInput = {
							name: nameValue,
							baseUrl: baseUrlValue,
							apiKey: apiKeyValue,
						};

						// Validate input
						CreateProviderInputSchema.parse(input);

						// Add provider
						await this.plugin.addCustomProvider(input);

						// Clear form
						nameValue = '';
						baseUrlValue = '';
						apiKeyValue = '';

						// Refresh display
						this.display();

						new Notice('Provider added successfully!');
					} catch (error) {
						console.error('Error adding provider:', error);
						if (error instanceof Error) {
							new Notice(`Error: ${error.message}`);
						} else {
							new Notice('Failed to add provider');
						}
					}
				}));
	}

	private createProvidersList(): void {
		const { containerEl } = this;

		if (this.plugin.settings.providers.length === 0) {
			containerEl.createEl('p', { 
				text: 'No custom providers configured.',
				cls: 'setting-item-description'
			});
			return;
		}

		// Providers list header
		containerEl.createEl('h4', { text: 'Configured Providers' });

		// List each provider
		this.plugin.settings.providers.forEach((provider: PluginSettings['providers'][0], index: number) => {
			const providerContainer = containerEl.createDiv('provider-item');
			
			new Setting(providerContainer)
				.setName(provider.name)
				.setDesc(`URL: ${provider.baseUrl}`)
				.addToggle(toggle => toggle
					.setValue(provider.enabled)
					.onChange(async (value) => {
						this.plugin.settings.providers[index].enabled = value;
						await this.plugin.saveSettings();
						await this.plugin.refreshProviders();
					}))
				.addExtraButton(button => button
					.setIcon('trash')
					.setTooltip('Remove provider')
					.onClick(async () => {
						this.plugin.settings.providers.splice(index, 1);
						await this.plugin.saveSettings();
						await this.plugin.refreshProviders();
						this.display(); // Refresh the display
						new Notice('Provider removed successfully!');
					}));
		});
	}
}
