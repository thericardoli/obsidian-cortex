import type { Model } from "@openai/agents-core";
import type { ProviderConfig, IProvider } from "../types";
import { OpenAICompatibleProvider } from "./openai-compatible";
import { OpenAIProvider_Custom } from "./openai";

export class ProviderManager {
    private providers: Map<string, IProvider> = new Map();

    constructor() {}

    /**
     * Ensure the target provider exists and is initialized.
     * Centralizes lazy init to avoid scattered checks.
     */
    async ensureInitialized(providerId: string): Promise<IProvider> {
        const provider = this.providers.get(providerId);
        if (!provider) {
            throw new Error(`Provider with id '${providerId}' not found`);
        }
        if (!provider.isInitialized()) {
            await provider.initialize();
        }
        return provider;
    }

    async addProvider(config: ProviderConfig): Promise<void> {
        let provider: IProvider;

        switch (config.providerType) {
            case "OpenAI":
                provider = new OpenAIProvider_Custom(config);
                break;
            case "OpenAICompatible":
                provider = new OpenAICompatibleProvider(config);
                break;
            default:
                throw new Error(`Unsupported provider type: ${config.providerType}`);
        }

        this.providers.set(config.id, provider);
        
        if (config.enabled) {
            await provider.initialize();
        }
    }

    async getModel(providerId: string, modelName: string): Promise<Model> {
        const provider = await this.ensureInitialized(providerId);
        return provider.getModel(modelName);
    }

    async getAvailableModels(providerId: string): Promise<string[]> {
        const provider = await this.ensureInitialized(providerId);
        return provider.getAvailableModels();
    }

    getProvider(providerId: string): IProvider | undefined {
        return this.providers.get(providerId);
    }

    getAllProviders(): IProvider[] {
        return Array.from(this.providers.values());
    }

    getEnabledProviders(): IProvider[] {
        return this.getAllProviders().filter(p => p.isInitialized());
    }

    async removeProvider(providerId: string): Promise<void> {
        this.providers.delete(providerId);
    }

    /**
     * Reset internal providers map and (re)register from provided configs.
     * Keeps ProviderManager instance stable for existing references.
     */
    async resetProviders(configs: ProviderConfig[]): Promise<void> {
        this.providers.clear();
        for (const cfg of configs) {
            try {
                // Add the provider; initialize only when enabled flag is true
                await this.addProvider(cfg);
            } catch (err) {
                console.error(`Failed to add provider '${cfg.name}'`, err);
            }
        }
    }
}
