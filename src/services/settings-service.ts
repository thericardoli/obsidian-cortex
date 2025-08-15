import type { Plugin } from 'obsidian';
import {
	PluginSettingsSchema,
	DEFAULT_SETTINGS,
	type PluginSettings,
	type ProviderSettingsEntry,
} from '../types/settings';
import { cloneDefaultProviders } from '../config/provider-defaults';
import { createLogger } from '../utils/logger';
const logger = createLogger('main');

export interface SettingsServiceApi {
	load(): Promise<PluginSettings>;
	save(s: PluginSettings): Promise<void>;
	migrate(raw: unknown): PluginSettings; // validates + normalizes
	seedDefaults(s: PluginSettings): PluginSettings; // cloneDefaultProviders when empty
}

export class SettingsService implements SettingsServiceApi {
	constructor(private plugin: Plugin) {}

	async load(): Promise<PluginSettings> {
		const data = await this.plugin.loadData();
		const merged = Object.assign({}, DEFAULT_SETTINGS, data);
		const migrated = this.migrate(merged as unknown);
		try {
			const parsed = PluginSettingsSchema.parse(migrated);
			// Ensure default seeding for providers and activeProviderId
			return this.seedDefaults(parsed);
		} catch (e) {
			logger.warn('Invalid plugin settings after migration, using defaults', e);
			return this.seedDefaults(DEFAULT_SETTINGS);
		}
	}

	async save(s: PluginSettings): Promise<void> {
		await this.plugin.saveData(s);
	}

	seedDefaults(s: PluginSettings): PluginSettings {
		const next: PluginSettings = { ...s };
		if (!next.providers || next.providers.length === 0) {
			next.providers = cloneDefaultProviders();
		}
		if (!next.activeProviderId && next.providers.length > 0) {
			next.activeProviderId = next.providers[0].id;
		}
		return next;
	}

	migrate(raw: unknown): PluginSettings {
		const isRecord = (v: unknown): v is Record<string, unknown> =>
			typeof v === 'object' && v !== null;
		const toStringOr = (v: unknown, fallback: string): string =>
			typeof v === 'string' ? v : fallback;
		// Accept true boolean, string 'true', or numeric 1 as truthy; avoid any casts.
		const toBool = (v: unknown): boolean => v === true || v === 'true' || v === 1;
		// Normalize user-entered baseUrl: add https:// if missing, ensure valid URL; return undefined if invalid
		const normalizeBaseUrl = (v: unknown): string | undefined => {
			if (typeof v !== 'string') return undefined;
			let url = v.trim();
			if (!url) return undefined;
			if (!/^https?:\/\//i.test(url)) {
				url = 'https://' + url; // assume https if protocol omitted
			}
			try {
				// Validate
				new URL(url);
				return url;
			} catch {
				return undefined;
			}
		};
		const toModels = (v: unknown): { displayName: string; modelId: string }[] =>
			Array.isArray(v)
				? v
						.map((m) =>
							isRecord(m)
								? {
										displayName: toStringOr(m.displayName, ''),
										modelId: toStringOr(m.modelId, ''),
									}
								: null
						)
						.filter(
							(m): m is { displayName: string; modelId: string } =>
								!!m && m.displayName !== '' && m.modelId !== ''
						)
				: [];

		const r = isRecord(raw) ? raw : {};

		// If already in new shape, normalize models for each provider
		const rProviders = Array.isArray(r.providers) ? (r.providers as unknown[]) : undefined;
		if (rProviders) {
			const providers: ProviderSettingsEntry[] = rProviders
				.map((p) => (isRecord(p) ? p : null))
				.filter((p): p is Record<string, unknown> => !!p)
				.map((p) => ({
					id: toStringOr(p.id, ''),
					name: toStringOr(p.name, 'Provider'),
					providerType: (p.providerType === 'OpenAI' ? 'OpenAI' : 'OpenAICompatible') as
						| 'OpenAI'
						| 'OpenAICompatible',
					apiKey: typeof p.apiKey === 'string' ? p.apiKey : undefined,
					baseUrl: normalizeBaseUrl(p.baseUrl),
					enabled: toBool(p.enabled),
					models: toModels(p.models),
				}))
				.filter((p) => p.id !== '' && p.name !== '');

			return {
				providers,
				activeProviderId:
					typeof r.activeProviderId === 'string' ? r.activeProviderId : undefined,
			} as PluginSettings;
		}

		// Old shape migration
		const providers: ProviderSettingsEntry[] = [];

		if (isRecord(r.openai)) {
			const openai = r.openai as Record<string, unknown>;
			providers.push({
				id: 'openai-default',
				name: 'OpenAI',
				providerType: 'OpenAI',
				apiKey: typeof openai.apiKey === 'string' ? openai.apiKey : undefined,
				baseUrl: normalizeBaseUrl(openai.baseUrl) || 'https://api.openai.com/v1',
				enabled: toBool(openai.enabled) || typeof openai.apiKey === 'string',
				models: toModels(openai.models),
			});
		}

		if (isRecord(r.ollama)) {
			const ollama = r.ollama as Record<string, unknown>;
			providers.push({
				id: 'ollama-default',
				name: 'Ollama',
				providerType: 'OpenAICompatible',
				apiKey: typeof ollama.apiKey === 'string' ? ollama.apiKey : undefined,
				baseUrl:
					typeof ollama.baseUrl === 'string'
						? ollama.baseUrl
						: 'http://localhost:11434/v1',
				enabled: toBool(ollama.enabled) || typeof ollama.baseUrl === 'string',
				models: toModels(ollama.models),
			});
		}

		// Old custom providers (without models)
		const legacyProviders = Array.isArray(r.providers) ? (r.providers as unknown[]) : [];
		for (const p of legacyProviders) {
			if (!isRecord(p)) continue;
			providers.push({
				id: toStringOr(p.id, ''),
				name: toStringOr(p.name, 'Provider'),
				providerType: (p.providerType === 'OpenAI' ? 'OpenAI' : 'OpenAICompatible') as
					| 'OpenAI'
					| 'OpenAICompatible',
				apiKey: typeof p.apiKey === 'string' ? p.apiKey : undefined,
				baseUrl: normalizeBaseUrl(p.baseUrl),
				enabled: toBool(p.enabled),
				models: toModels(p.models),
			});
		}

		return {
			providers,
			activeProviderId:
				typeof r.activeProviderId === 'string' ? r.activeProviderId : undefined,
		} as PluginSettings;
	}
}
