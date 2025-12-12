import { loadAgentConfigs, persistAgentConfigs } from './agent-store';

import type { AgentConfig } from '../../types/agent';

/**
 * Hydrate agent configs from IndexedDB and ensure Dexie stays source of truth.
 */
export async function initializePersistence(fallbackAgentConfigs: AgentConfig[]): Promise<void> {
    const hydrated = await loadAgentConfigs(fallbackAgentConfigs);
    await persistAgentConfigs(hydrated);
}
