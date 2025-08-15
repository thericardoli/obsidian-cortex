import { OpenAI } from 'openai';
import type { Model } from '@openai/agents-core';
import { OpenAIProvider } from '@openai/agents-openai';

import type { ProviderConfig, IProvider } from '../types';
import { createLogger } from '../utils/logger';

export class OpenAIProvider_Custom implements IProvider {
	private _config: ProviderConfig;
	private _openaiProvider: OpenAIProvider | null = null;
	private _initialized = false;
	private logger = createLogger('providers');

	constructor(config: ProviderConfig) {
		this._config = config;
	}

	async initialize(): Promise<void> {
		if (!this._config.apiKey) {
			throw new Error('API key is required for OpenAI Provider');
		}

		const openAIClient = new OpenAI({
			apiKey: this._config.apiKey,
			dangerouslyAllowBrowser: true,
		});

		// Initialize the OpenAI provider with the provided configuration
		this._openaiProvider = new OpenAIProvider({
			openAIClient,
			useResponses: false, // Disable response api
		});

		this._initialized = true;
	}

	async getModel(modelName: string): Promise<Model> {
		if (!this._openaiProvider) {
			throw new Error('Provider not initialized');
		}
		// Fetch the model from the OpenAI provider
		return this._openaiProvider.getModel(modelName);
	}

	async getAvailableModels(): Promise<string[]> {
		if (!this._config.apiKey) {
			throw new Error('Provider not initialized - API key is required');
		}

		try {
			const openAIClient = new OpenAI({
				apiKey: this._config.apiKey,
				dangerouslyAllowBrowser: true,
			});

			const modelsPage = await openAIClient.models.list();
			return modelsPage.data.map((model) => model.id);
		} catch (error) {
			this.logger.error('Failed to fetch available models', error);
			throw new Error('Failed to fetch available models from OpenAI');
		}
	}

	getId(): string {
		return this._config.id;
	}

	getName(): string {
		return this._config.name;
	}

	isInitialized(): boolean {
		return this._initialized;
	}
}
