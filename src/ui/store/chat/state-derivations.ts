import type { PluginSettings } from '../../../types';
import type { ProviderManager } from '../../../providers/provider-manager';
import type { AgentConfig } from '../../../types/agent';
import type { ChatState, ModelGroup, ModelGroupItem } from '../chat-store';
import { toProviderDescriptor, isRuntimeEnabled } from '../../../utils/provider-runtime';
import { buildModelKey } from '../../../utils/model-key';

export interface DerivationInput {
	state: ChatState;
	agents: AgentConfig[];
	settings: PluginSettings;
	providerManager: ProviderManager;
}

export function buildGroupedModels(
	settings: PluginSettings,
	providerManager: ProviderManager
): ModelGroup[] {
	const presentProviderIds = new Set(providerManager.getAllProviders().map((p) => p.getId()));
	const groups: ModelGroup[] = [];
	for (const p of settings.providers) {
		if (!presentProviderIds.has(p.id) || !isRuntimeEnabled(p)) continue;
		const descriptor = toProviderDescriptor(p);
		const items: ModelGroupItem[] = descriptor.models.map((m) => ({
			key: buildModelKey(p.id, m.modelId),
			label: m.displayName,
			modelId: m.modelId,
		}));
		groups.push({ providerId: p.id, providerName: p.name, items });
	}
	return groups;
}

export function recomputeDerived(input: DerivationInput): void {
	const { state, agents, settings, providerManager } = input;
	state.availableAgents = agents;
	if (!state.selectedAgent && state.availableAgents.length > 0) {
		state.selectedAgent = state.availableAgents[0];
	} else if (state.selectedAgent) {
		const match = state.availableAgents.find((a) => a.id === state.selectedAgent?.id);
		state.selectedAgent = match ?? state.availableAgents[0] ?? null;
	}
	state.modelGroups = buildGroupedModels(settings, providerManager);
	if (!state.selectedModelKey) {
		const first = state.modelGroups.find((g) => g.items.length > 0)?.items[0];
		state.selectedModelKey = first ? first.key : '';
	} else {
		const keys = new Set<string>();
		for (const g of state.modelGroups) for (const it of g.items) keys.add(it.key);
		if (!keys.has(state.selectedModelKey)) {
			const first = state.modelGroups.find((g) => g.items.length > 0)?.items[0];
			state.selectedModelKey = first ? first.key : '';
		}
	}
	state.canSend =
		state.selectedAgent !== null && state.selectedModelKey !== '' && !state.isLoading;
}
