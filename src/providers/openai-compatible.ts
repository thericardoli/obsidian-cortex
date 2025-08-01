import { OpenAI } from "openai";
import type { Model } from "@openai/agents-core";
import { OpenAIProvider } from "@openai/agents-openai";

import type { ProviderConfig, IProvider } from "../types";

export class OpenAICompatibleProvider implements IProvider {
	private _config: ProviderConfig;
	private _openaiCompatibleProvider: OpenAIProvider | null = null;
	private _initialized = false;

	constructor(config: ProviderConfig) {
		this._config = config;
	}

	async initialize(): Promise<void> {
		if (!this._config.apiKey) {
			throw new Error("API key is required for OpenAICompatibleProvider");
		}
        if (!this._config.baseUrl) {
            throw new Error("Base URL is required for OpenAICompatibleProvider");
        }

		const customOpenAIClient = new OpenAI({
			apiKey: this._config.apiKey,
			baseURL: this._config.baseUrl,
		});

		// Initialize the OpenAI provider with the provided configuration
		this._openaiCompatibleProvider = new OpenAIProvider({
			openAIClient: customOpenAIClient,
			useResponses: false, // Disable response api
		});

		this._initialized = true;
	}

	async getModel(modelName: string): Promise<Model> {
		if (!this._openaiCompatibleProvider) {
			throw new Error("Provider not initialized");
		}
		// Fetch the model from the OpenAI Compatible provider
		return this._openaiCompatibleProvider.getModel(modelName);
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
