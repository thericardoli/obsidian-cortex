import { requestUrl } from 'obsidian';

import { cortexDb } from '../core/persistence/database';
import { BUILTIN_PROVIDER_IDS, type CortexSettings } from '../settings/settings';

import type { ModelConfig } from '../types/model';
import type { BuiltinProviderId } from '../types/provider';

const MODELS_DEV_API_URL = 'https://models.dev/api.json';
const MODELS_DEV_LOGO_BASE_URL = 'https://models.dev/logos';

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_KEY = 'models.dev/api.json';
const FAILURE_BACKOFF_MS = 5 * 60 * 1000;

export interface ModelsDevModel {
    id: string;
    name?: string;
    attachment?: boolean;
    reasoning?: boolean;
    tool_call?: boolean;
    /** Some providers expose a dedicated structured-output feature. */
    structured_output?: boolean;
    /** Whether temperature is supported for this model. */
    temperature?: boolean;
    knowledge?: string;
    release_date?: string;
    last_updated?: string;
    open_weights?: boolean;
    /** Interleaved reasoning support. In models.dev this can be `true` or `{ field }`. */
    interleaved?: boolean | { field: string };
    modalities?: {
        input?: string[];
        output?: string[];
    };
    limit?: {
        context?: number;
        input?: number;
        output?: number;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cost?: Record<string, any>;
    status?: string;
}

export interface ModelCapabilities {
    /** Obsidian provider id (eg. openai/anthropic/google/openrouter or custom id). */
    providerId: string;
    /** models.dev provider id (same as providerId for builtins). */
    modelsDevProviderId: string;

    /** The model identifier that should be sent to the provider API. */
    modelID: string;

    /** Human-friendly model name if present in models.dev. */
    name?: string;

    attachment?: boolean;
    reasoning?: boolean;
    toolCall?: boolean;
    structuredOutput?: boolean;
    temperature?: boolean;
    knowledge?: string;
    releaseDate?: string;
    lastUpdated?: string;
    openWeights?: boolean;
    interleaved?: boolean;
    interleavedField?: string;

    modalitiesInput?: string[];
    modalitiesOutput?: string[];

    /** Max context window tokens (when provided). */
    contextWindow?: number;
    /** Max input tokens (when provided). */
    maxInputTokens?: number;
    /** Max output tokens (when provided). */
    maxOutputTokens?: number;

    /** Optional model status: alpha | beta | deprecated (and any future values). */
    status?: string;

    /** Raw models.dev model object (passthrough for future iterations). */
    raw?: ModelsDevModel;
}

export interface ModelsDevProvider {
    id: string;
    name?: string;
    npm?: string;
    api?: string;
    env?: string[];
    doc?: string;
    models?: Record<string, ModelsDevModel>;
}

export type ModelsDevApi = Record<string, ModelsDevProvider>;

/**
 * Resolve model capabilities from models.dev for a given providerId + modelID.
 *
 * Matching rules:
 * - Uses exact key match first.
 * - Falls back to case-insensitive key match (to tolerate user-edited casing).
 * - Does NOT mutate/normalize the returned `modelID` (the value you should send to the provider).
 *
 * Supported fields (documented by models.dev; safe to rely on):
 * - `id`: string
 * - `name`: string
 * - `attachment`: boolean
 * - `reasoning`: boolean
 * - `tool_call`: boolean
 * - `structured_output`: boolean (optional)
 * - `temperature`: boolean (optional)
 * - `knowledge`: string (optional)
 * - `release_date`: string
 * - `last_updated`: string
 * - `open_weights`: boolean
 * - `interleaved`: boolean | { field: string } (optional)
 * - `modalities.input`: string[]
 * - `modalities.output`: string[]
 * - `limit.context`: number
 * - `limit.input`: number
 * - `limit.output`: number
 * - `cost.*`: numbers (varies by provider; passed through in `raw.cost`)
 * - `status`: string (optional; commonly alpha|beta|deprecated)
 */
export async function getModelCapabilitiesFromModelsDev(
    providerId: string,
    modelID: string,
    options: { ttlMs?: number } = {}
): Promise<ModelCapabilities | null> {
    const normalizedProviderId = (providerId || '').trim();
    const normalizedModelID = (modelID || '').trim();
    if (!normalizedProviderId || !normalizedModelID) return null;

    let api: ModelsDevApi;
    try {
        api = await getModelsDevApi({ ttlMs: options.ttlMs });
    } catch {
        return null;
    }

    const modelsDevProviderId = normalizedProviderId.toLowerCase();
    const provider = api[modelsDevProviderId];
    const models = provider?.models;
    if (!provider || !models) return null;

    const resolvedKey = resolveModelKey(models, normalizedModelID);
    if (!resolvedKey) return null;

    const raw = models[resolvedKey];
    if (!raw) return null;

    const interleavedField =
        raw.interleaved && typeof raw.interleaved === 'object' && 'field' in raw.interleaved
            ? raw.interleaved.field
            : undefined;

    return {
        providerId: normalizedProviderId,
        modelsDevProviderId,
        modelID: resolvedKey,
        name: raw.name,
        attachment: raw.attachment,
        reasoning: raw.reasoning,
        toolCall: raw.tool_call,
        structuredOutput: raw.structured_output,
        temperature: raw.temperature,
        knowledge: raw.knowledge,
        releaseDate: raw.release_date,
        lastUpdated: raw.last_updated,
        openWeights: raw.open_weights,
        interleaved: Boolean(raw.interleaved),
        interleavedField,
        modalitiesInput: raw.modalities?.input,
        modalitiesOutput: raw.modalities?.output,
        contextWindow: raw.limit?.context,
        maxInputTokens: raw.limit?.input,
        maxOutputTokens: raw.limit?.output,
        status: raw.status,
        raw,
    };
}

export function mapObsidianProviderToModelsDev(providerId: string): string {
    return providerId.trim().toLowerCase();
}

export function mapModelsDevProviderToObsidian(providerId: string): string {
    return providerId.trim().toLowerCase();
}

function resolveModelKey(models: Record<string, ModelsDevModel>, modelID: string): string | null {
    if (modelID in models) return modelID;

    const target = modelID.toLowerCase();
    for (const key of Object.keys(models)) {
        if (key.toLowerCase() === target) return key;
    }

    return null;
}

let inFlightApiFetch: Promise<ModelsDevApi> | null = null;
let lastFetchFailureAt = 0;

async function readCachedApi(ttlMs: number): Promise<ModelsDevApi | null> {
    try {
        const record = await cortexDb.modelsDevCache.get(CACHE_KEY);
        if (!record) return null;
        if (Date.now() - record.updatedAt > ttlMs) return null;
        if (!record.value || typeof record.value !== 'object') return null;
        return record.value as ModelsDevApi;
    } catch {
        return null;
    }
}

async function writeCachedApi(value: ModelsDevApi): Promise<void> {
    await cortexDb.modelsDevCache.put({
        key: CACHE_KEY,
        updatedAt: Date.now(),
        value,
    });
}

async function fetchModelsDevApiFromNetwork(): Promise<ModelsDevApi> {
    const res = await requestUrl({ url: MODELS_DEV_API_URL });
    if (res.status !== 200) {
        throw new Error(`Failed to fetch models.dev api.json: ${res.status}`);
    }

    const json = (res.json ?? JSON.parse(res.text)) as unknown;
    if (!json || typeof json !== 'object' || Array.isArray(json)) {
        throw new Error('models.dev api.json returned unexpected payload');
    }

    return json as ModelsDevApi;
}

export async function getModelsDevApi(options: { ttlMs?: number; forceRefresh?: boolean } = {}) {
    const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;

    if (!options.forceRefresh) {
        const cached = await readCachedApi(ttlMs);
        if (cached) return cached;

        if (lastFetchFailureAt && Date.now() - lastFetchFailureAt < FAILURE_BACKOFF_MS) {
            throw new Error('models.dev fetch is in backoff window');
        }
    }

    if (!inFlightApiFetch) {
        inFlightApiFetch = (async () => {
            try {
                const fresh = await fetchModelsDevApiFromNetwork();
                await writeCachedApi(fresh);
                return fresh;
            } catch (err) {
                lastFetchFailureAt = Date.now();
                throw err;
            }
        })().finally(() => {
            inFlightApiFetch = null;
        });
    }

    return inFlightApiFetch;
}

export function buildModelsFromModelsDevProvider(
    providerId: BuiltinProviderId,
    modelsDevApi: ModelsDevApi
): ModelConfig[] {
    const modelsDevProviderId = mapObsidianProviderToModelsDev(providerId);
    const provider = modelsDevApi[modelsDevProviderId];
    const models = provider?.models;
    if (!models || typeof models !== 'object') return [];

    const entries = Object.entries(models)
        .filter(([modelID]) => typeof modelID === 'string' && modelID.trim().length > 0)
        .map(([modelID, model]) => {
            const displayName = (model?.name || modelID).trim();
            return {
                id: `modelsdev:${providerId}:${modelID}`,
                name: displayName,
                modelID,
            } satisfies ModelConfig;
        });

    entries.sort((a, b) => a.name.localeCompare(b.name));

    return entries;
}

export async function ensureBuiltinProviderModelsFromModelsDev(
    settings: CortexSettings,
    options: { ttlMs?: number } = {}
): Promise<{ updated: boolean; updatedProviders: BuiltinProviderId[] }> {
    const candidates = BUILTIN_PROVIDER_IDS.filter((providerId) => {
        const provider = settings.providers?.[providerId];
        if (!provider) return false;
        if (!provider.apiKey) return false;
        return !provider.models || provider.models.length === 0;
    });

    if (!candidates.length) {
        return { updated: false, updatedProviders: [] };
    }

    let api: ModelsDevApi;
    try {
        api = await getModelsDevApi({ ttlMs: options.ttlMs });
    } catch (err) {
        console.warn('Failed to load models.dev api.json; skipping auto model population', err);
        return { updated: false, updatedProviders: [] };
    }

    const updatedProviders: BuiltinProviderId[] = [];

    for (const providerId of candidates) {
        const nextModels = buildModelsFromModelsDevProvider(providerId, api);
        if (!nextModels.length) continue;

        const providerSettings = settings.providers[providerId];
        if (!providerSettings.models || providerSettings.models.length === 0) {
            providerSettings.models = nextModels;
            updatedProviders.push(providerId);
        }
    }

    return { updated: updatedProviders.length > 0, updatedProviders };
}

export function modelsDevLogoUrl(providerId: string): string {
    const mapped = mapObsidianProviderToModelsDev(providerId);
    return `${MODELS_DEV_LOGO_BASE_URL}/${encodeURIComponent(mapped)}.svg`;
}
