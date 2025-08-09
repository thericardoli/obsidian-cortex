import type { ProviderSettingsEntry } from "../types/settings";

/**
 * Decide if a provider should be considered enabled at runtime
 * given its persisted settings and available credentials/URL.
 */
export function isRuntimeEnabled(p: ProviderSettingsEntry): boolean {
    return (
        p.enabled === true ||
        (p.providerType === 'OpenAI' && !!p.apiKey) ||
        (p.providerType === 'OpenAICompatible' && !!p.baseUrl)
    );
}

