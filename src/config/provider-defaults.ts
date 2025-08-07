import type { ProviderSettingsEntry } from "../types";

// Central place to define built-in providers and their default models.
// Edit this file to add/update built-in providers and model presets.

export const DEFAULT_PROVIDER_SPECS: ProviderSettingsEntry[] = [
    {
        id: "openai-default",
        name: "OpenAI",
        providerType: "OpenAI",
        apiKey: undefined,
        baseUrl: "https://api.openai.com/v1",
        enabled: false, // requires user API key
        models: [
            { displayName: "GPT5", modelId: "gpt-5" },
            { displayName: "GPT5-mini", modelId: "gpt-5-mini" },
            { displayName: "GPT5-nano", modelId: "gpt-5-nano" }
        ],
    },
    {
        id: "ollama-default",
        name: "Ollama",
        providerType: "OpenAICompatible",
        apiKey: undefined,
        baseUrl: "http://localhost:11434/v1",
        enabled: true,
        models: [
            { displayName: "Qwen3:8b", modelId: "qwen3:8b" },
            { displayName: "Gemma3:12b", modelId: "gemma3:12b" },
        ],
    },
];

export function cloneDefaultProviders(): ProviderSettingsEntry[] {
    // Ensure we don't mutate the exported array
    return DEFAULT_PROVIDER_SPECS.map(p => ({
        ...p,
        models: [...p.models],
    }));
}

