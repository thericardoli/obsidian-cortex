import { z } from 'zod';
import type { Model } from '@openai/agents-core';

export const ModelProviderTypeSchema = z.enum(['OpenAI', 'OpenAICompatible']);

export const ProviderConfigSchema = z
	.object({
		id: z.string().min(1),
		name: z.string().min(1),
		providerType: ModelProviderTypeSchema,

		// 通用配置
		apiKey: z.string().optional(),
		baseUrl: z.string().url().optional(),
		enabled: z.boolean().default(true),
	})
	.strict();

export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

// Runtime configuration for ProviderManager (derived from settings)
export interface ProviderRuntimeConfig {
	id: string;
	name: string;
	providerType: 'OpenAI' | 'OpenAICompatible';
	apiKey?: string;
	baseUrl?: string;
	enabled: boolean;
}

// Descriptor for UI components (read-only provider info with models)
export interface ProviderDescriptor {
	id: string;
	name: string;
	enabled: boolean;
	models: ModelDescriptor[];
}

export interface ModelDescriptor {
	modelId: string;
	displayName: string;
}

export interface IProvider {
	initialize(): Promise<void>;
	getModel(modelName: string): Promise<Model>;
	getAvailableModels(): Promise<string[]>;
	getId(): string;
	getName(): string;
	isInitialized(): boolean;
}
