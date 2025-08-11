import type { Model } from '@openai/agents-core';
import type { ProviderManager } from '../providers/provider-manager';
import type { PluginSettings } from '../types/settings';
import { isRuntimeEnabled } from '../utils/provider-runtime';

export interface ProviderServiceApi {
	refreshFromSettings(settings: PluginSettings): Promise<void>;
	resolveModel(providerId: string, modelId: string): Promise<Model>;
	getDescriptors(
		settings: PluginSettings
	): Array<{ id: string; name: string; models: { modelId: string; displayName: string }[] }>;
}

export class ProviderService implements ProviderServiceApi {
	constructor(private manager: ProviderManager) {}

	async refreshFromSettings(settings: PluginSettings): Promise<void> {
		await this.manager.resetProviders(
			(settings.providers || [])
				.filter((p) => isRuntimeEnabled(p))
				.map((p) => ({
					id: p.id,
					name: p.name,
					providerType: p.providerType,
					apiKey: p.apiKey,
					baseUrl: p.baseUrl,
					enabled: true,
				}))
		);
	}

	async resolveModel(providerId: string, modelId: string): Promise<Model> {
		return this.manager.getModel(providerId, modelId);
	}

	getDescriptors(settings: PluginSettings) {
		return (settings.providers || []).map((p) => ({
			id: p.id,
			name: p.name,
			models: (p.models || []).map((m) => ({
				modelId: m.modelId,
				displayName: m.displayName,
			})),
		}));
	}
}
