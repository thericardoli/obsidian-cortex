import type { AgentInputItem } from '../../types/session';

function isAgentInputItem(v: unknown): v is AgentInputItem {
	return typeof v === 'object' && v !== null;
}

export function serializeItems(items: AgentInputItem[]): string {
	return JSON.stringify(items);
}

export function deserializeItems(serialized: string | unknown[]): AgentInputItem[] {
	if (Array.isArray(serialized)) {
		const arr = [...serialized] as unknown[];
		return arr.filter(isAgentInputItem);
	}
	if (typeof serialized === 'string') {
		try {
			const parsed: unknown = JSON.parse(serialized);
			return Array.isArray(parsed) ? (parsed as unknown[]).filter(isAgentInputItem) : [];
		} catch {
			return [];
		}
	}
	return [];
}

export function serializeMetadata(metadata: Record<string, unknown>): string {
	return JSON.stringify(metadata ?? {});
}

export function deserializeMetadata(
	serialized: string | Record<string, unknown>
): Record<string, unknown> {
	if (typeof serialized === 'object' && serialized !== null) {
		return serialized;
	}
	if (typeof serialized === 'string') {
		try {
			const parsed: unknown = JSON.parse(serialized);
			return typeof parsed === 'object' && parsed !== null
				? (parsed as Record<string, unknown>)
				: ({} as Record<string, unknown>);
		} catch {
			return {} as Record<string, unknown>;
		}
	}
	return {} as Record<string, unknown>;
}
