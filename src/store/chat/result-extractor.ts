// Extract assistant fallback text from a final stream/result object.
export function extractTextFromResult(result: unknown): string {
	if (typeof result === 'string') return result;
	if (result && typeof result === 'object') {
		const r = result as Record<string, unknown>;
		if (typeof r.finalOutput === 'string') return r.finalOutput as string;
		const content = r.content;
		if (typeof content === 'string') return content;
		if (Array.isArray(content)) {
			const texts = content
				.filter((item) => !!item && typeof item === 'object')
				.map((item) => item as { type?: unknown; text?: unknown })
				.filter((it) => it.type === 'text' || it.type === 'output_text')
				.map((it) => (typeof it.text === 'string' ? it.text : ''));
			if (texts.length > 0) return texts.join('');
		}
		if (typeof r.text === 'string') return r.text as string;
		if (typeof r.message === 'string') return r.message as string;
	}
	return 'No response content available';
}
