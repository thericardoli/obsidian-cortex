import { z } from 'zod';
import { TFile, type App } from 'obsidian';
import { createLogger } from '../../utils/logger';
import { buildJsonParametersFromZod } from '../utils/zod-to-json';

const logger = createLogger('tool');

export const ReadMarkdownFileArgsSchema = z.object({
	path: z
		.string()
		.min(1)
		.describe('Relative path of the markdown file to read, e.g. notes/today.md'),
});

const readMarkdownFileParameters = buildJsonParametersFromZod(ReadMarkdownFileArgsSchema);

export const readMarkdownFileToolMeta = {
	name: 'read_markdown_file',
	description: 'Read the content of a Markdown file',
	schema: ReadMarkdownFileArgsSchema,
	parameters: readMarkdownFileParameters,
};

export function registerReadMarkdownFileExecutor(
	register: (
		name: string,
		exec: (args: unknown, ctx?: unknown) => Promise<unknown> | unknown
	) => void,
	app: App
): void {
	register(readMarkdownFileToolMeta.name, async (raw: unknown) => {
		const { path } = ReadMarkdownFileArgsSchema.parse(raw);
		try {
			const file = app.vault.getAbstractFileByPath(path);
			if (!(file instanceof TFile)) {
				return { ok: false, error: 'File not found' };
			}
			const content = await app.vault.read(file);
			return { ok: true, path, content, length: content.length };
		} catch (e) {
			logger.error('read_markdown_file failed', e);
			return { ok: false, error: e instanceof Error ? e.message : String(e) };
		}
	});
}
