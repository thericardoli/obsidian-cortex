import type { ProviderSettingsEntry } from "../types/settings";
import type { ProviderRuntimeConfig, ProviderDescriptor } from '../types/provider';

/**
 * Decide if a provider should be considered enabled at runtime
 * given its persisted settings and available credentials/URL.
 */
export function isRuntimeEnabled(p: ProviderSettingsEntry): boolean {
    return (
        p.enabled === true &&
        ((p.providerType === 'OpenAI' && !!p.apiKey) ||
        (p.providerType === 'OpenAICompatible' && !!p.baseUrl && !!p.apiKey))
    );
}

/**
 * 将设置中的 provider 转换为运行时配置
 */
export function toRuntimeConfig(provider: ProviderSettingsEntry): ProviderRuntimeConfig {
	return {
		id: provider.id,
		name: provider.name,
		providerType: provider.providerType,
		apiKey: provider.apiKey,
		baseUrl: provider.baseUrl,
		enabled: provider.enabled
	};
}

/**
 * 将设置中的 provider 转换为 UI 描述符
 */
export function toProviderDescriptor(provider: ProviderSettingsEntry): ProviderDescriptor {
	return {
		id: provider.id,
		name: provider.name,
		enabled: provider.enabled,
		models: provider.models.map(model => ({
			modelId: model.modelId,
			displayName: model.displayName
		}))
	};
}

