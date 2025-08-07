import { z } from "zod";
import { ProviderConfigSchema } from "./provider";

// Model entry for a provider (display name + underlying model id)
export const ProviderModelEntrySchema = z
    .object({
        displayName: z.string().min(1, "Model display name is required"),
        modelId: z.string().min(1, "Model ID is required"),
    })
    .strict();

export type ProviderModelEntry = z.infer<typeof ProviderModelEntrySchema>;

// Provider entry in settings extends ProviderConfig with models
export const ProviderSettingsEntrySchema = ProviderConfigSchema.extend({
    models: z.array(ProviderModelEntrySchema).default([]),
}).strict();

export type ProviderSettingsEntry = z.infer<typeof ProviderSettingsEntrySchema>;

// Plugin settings schema: unified providers list
export const PluginSettingsSchema = z
    .object({
        providers: z.array(ProviderSettingsEntrySchema).default([]),
        activeProviderId: z.string().optional(),
    })
    .strict();

export type PluginSettings = z.infer<typeof PluginSettingsSchema>;

// Default settings
export const DEFAULT_SETTINGS: PluginSettings = {
    providers: [],
    activeProviderId: undefined,
};

// Input types for creating new providers
export const CreateProviderInputSchema = z
    .object({
        name: z.string().min(1, "Provider name is required"),
        baseUrl: z.string().url("Invalid URL format"),
        apiKey: z.string().min(1, "API key is required"),
    })
    .strict();

export type CreateProviderInput = z.infer<typeof CreateProviderInputSchema>;
