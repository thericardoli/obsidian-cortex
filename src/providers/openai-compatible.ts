import { OpenAI } from "openai";
import type { Model, ModelRequest } from "@openai/agents-core";
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
        if (!this._config.baseUrl) {
            throw new Error("Base URL is required for OpenAICompatibleProvider");
        }

		const customOpenAIClient = new OpenAI({
			apiKey: this._config.apiKey ?? 'none',
			baseURL: this._config.baseUrl,
			dangerouslyAllowBrowser: true,
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
		const originalModel = await this._openaiCompatibleProvider.getModel(modelName);

		// Return a wrapped model to normalize message content in getResponse
		return {
			...originalModel,
			getResponse: async (request: ModelRequest & { messages?: any[] }) => {
				if (request.messages) {
					const normalizedMessages = request.messages.map(message => {
						if (Array.isArray(message.content) && message.content.length === 1) {
							const part = message.content[0];
							if (part.type === 'text') {
								return { ...message, content: part.text };
							}
						}
						return message;
					});

					const normalizedRequest = { ...request, messages: normalizedMessages };
					return originalModel.getResponse(normalizedRequest);
				}
				return originalModel.getResponse(request);
			},
		};
	}

	async getAvailableModels(): Promise<string[]> {
		if (!this._config.baseUrl) {
			throw new Error("Provider not initialized - base URL is required");
		}

		try {
			const customOpenAIClient = new OpenAI({
				apiKey: this._config.apiKey ?? 'none',
				baseURL: this._config.baseUrl,
				dangerouslyAllowBrowser: true,
			});

			const modelsPage = await customOpenAIClient.models.list();
			return modelsPage.data.map(model => model.id);
		} catch (error) {
			console.error("Failed to fetch available models:", error);
			throw new Error("Failed to fetch available models from OpenAI Compatible provider");
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
