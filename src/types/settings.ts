import { z } from "zod";

// Plugin settings schema
export const PluginSettingsSchema = z.object({
	// Provider configurations
	providers: z.array(z.object({
		id: z.string(),
		name: z.string(),
		providerType: z.enum(["OpenAI", "OpenAICompatible"]),
		apiKey: z.string().optional(),
		baseUrl: z.string().url().optional(),
		enabled: z.boolean().default(true),
	})).default([]),
	
	// Default OpenAI provider settings
	openai: z.object({
		apiKey: z.string().optional(),
		enabled: z.boolean().default(false),
	}).default({ enabled: false }),
}).strict();

export type PluginSettings = z.infer<typeof PluginSettingsSchema>;

// Default settings
export const DEFAULT_SETTINGS: PluginSettings = {
	providers: [],
	openai: {
		enabled: false,
	}
};

// Input types for creating new providers
export const CreateProviderInputSchema = z.object({
	name: z.string().min(1, "Provider name is required"),
	baseUrl: z.string().url("Invalid URL format"),
	apiKey: z.string().min(1, "API key is required"),
}).strict();

export type CreateProviderInput = z.infer<typeof CreateProviderInputSchema>;
