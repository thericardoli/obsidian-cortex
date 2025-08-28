import type { RunStreamEvent } from '@openai/agents-core';

export interface StreamDeltaResult {
	delta?: string;
	done?: boolean;
}

// 统一提取 delta 文本（兼容多种事件结构）
export function extractDelta(ev: RunStreamEvent): string | null {
	if (!ev) return null;
	if (ev.type === 'raw_model_stream_event') {
		const d = ev.data as {
			type?: unknown;
			delta?: unknown;
			event?: { type?: unknown; delta?: unknown };
		};
		if (d.type === 'output_text_delta' && typeof d.delta === 'string') return d.delta;
		if (d.event && typeof d.event.delta === 'string') {
			const t = d.event.type;
			if (
				t === 'response.output_text.delta' ||
				t === 'output_text.delta' ||
				t === 'output_text_delta'
			)
				return d.event.delta;
		}
	}
	return null;
}

export async function accumulateStream(
	asyncIter: AsyncIterable<RunStreamEvent>,
	onDelta: (text: string) => void
): Promise<{ final: string }> {
	let acc = '';
	for await (const ev of asyncIter) {
		const d = extractDelta(ev);
		if (d) {
			acc += d;
			onDelta(acc);
		}
	}
	return { final: acc };
}
