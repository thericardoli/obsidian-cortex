import type { CortexSettings } from '../../settings/settings';
import { loadAgentConfigs, persistAgentConfigs } from './agent-store';

/**
 * Hydrate settings.agentConfigs from IndexedDB and ensure Dexie stays source of truth.
 */
export async function initializePersistence(settings: CortexSettings): Promise<void> {
    const hydrated = await loadAgentConfigs(settings.agentConfigs);
    settings.agentConfigs = hydrated;
    await persistAgentConfigs(hydrated);
}
