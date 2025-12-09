import type { AgentConfig } from '../../types/agent';
import { cortexDb, type AgentConfigRecord } from './database';

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
    const stored = await cortexDb.agentConfigs.toArray();
    if (stored.length > 0) {
        return stored;
    }
    if (defaults.length > 0) {
        const sanitized = defaults.map((item) => withTimestamps(sanitizeConfig(item)));
        await cortexDb.agentConfigs.bulkPut(sanitized);
    }
    return defaults;
}

export async function persistAgentConfigs(configs: AgentConfig[]): Promise<void> {
    const now = Date.now();
    const sanitized = configs.map((config) => withTimestamps(sanitizeConfig(config), now));
    await cortexDb.agentConfigs.bulkPut(sanitized);
}
