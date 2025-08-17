import type { AgentInputItem } from '../../types/session';

export function serializeItems(items: AgentInputItem[]): string {
	return JSON.stringify(items);
}

export function deserializeItems(serialized: string | unknown[]): AgentInputItem[] {
	if (Array.isArray(serialized)) {
		return serialized as AgentInputItem[];
	}
	if (typeof serialized === 'string') {
		try {
			const parsed = JSON.parse(serialized);
			return Array.isArray(parsed) ? parsed : [];
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
		return serialized as Record<string, unknown>;
	}
	if (typeof serialized === 'string') {
		try {
			const parsed = JSON.parse(serialized);
			return typeof parsed === 'object' && parsed !== null ? parsed : {};
		} catch {
			return {};
		}
	}
	return {};
}
