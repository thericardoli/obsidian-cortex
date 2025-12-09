import type { AgentConfig } from '../../types/agent';
import { cortexDb, type AgentConfigRecord } from './database';

function normalizeAgentConfig(config: AgentConfig): AgentConfig {
    const description = config.description || config.handoffDescription || '';
    const modelId = config.modelId ?? config.defaultModelId;
    const defaultModelId = config.defaultModelId ?? modelId;
    return {
        ...config,
        kind: config.kind || 'custom',
        modelId,
        defaultModelId,
        description,
        handoffDescription: config.handoffDescription ?? description,
        handoffIds: config.handoffIds ?? [],
        toolIds: config.toolIds ?? [],
        enabled: config.enabled ?? true,
    };
}

function withTimestamps(agent: AgentConfig, now = Date.now()): AgentConfigRecord {
    const existing = agent as Partial<AgentConfigRecord>;
    return {
        ...agent,
        createdAt: existing.createdAt ?? now,
        updatedAt: now,
    };
}

/**
 * Sanitize agent config to ensure it can be stored in IndexedDB.
 * This removes any Svelte reactive proxies or non-serializable properties.
 */
function sanitizeConfig(config: AgentConfig): AgentConfig {
    return JSON.parse(JSON.stringify(config)) as AgentConfig;
}

export async function loadAgentConfigs(defaults: AgentConfig[]): Promise<AgentConfig[]> {
    const stored = (await cortexDb.agentConfigs.toArray()).map((item) =>
        normalizeAgentConfig(item as AgentConfig)
    );
    if (stored.length > 0) {
        return stored;
    }
    if (defaults.length > 0) {
        const normalized = defaults.map((item) => normalizeAgentConfig(item));
        const sanitized = normalized.map((item) => withTimestamps(sanitizeConfig(item)));
        await cortexDb.agentConfigs.bulkPut(sanitized);
    }
    return defaults.map(normalizeAgentConfig);
}

export async function persistAgentConfigs(configs: AgentConfig[]): Promise<void> {
    const now = Date.now();
    const normalized = configs.map((config) => normalizeAgentConfig(config));
    const sanitized = normalized.map((config) => withTimestamps(sanitizeConfig(config), now));
    const ids = new Set(sanitized.map((item) => item.id));

    await cortexDb.transaction('rw', cortexDb.agentConfigs, async () => {
        const existingIds = await cortexDb.agentConfigs.toCollection().primaryKeys();
        const removedIds = existingIds.filter(
            (id): id is string => typeof id === 'string' && !ids.has(id)
        );

        if (removedIds.length > 0) {
            await cortexDb.agentConfigs.bulkDelete(removedIds);
        }

        await cortexDb.agentConfigs.bulkPut(sanitized);
    });
}
