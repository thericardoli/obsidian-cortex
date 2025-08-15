import { z } from 'zod';
import { TFile, type App } from 'obsidian';
import { createLogger } from '../../utils/logger';

const logger = createLogger('tool');

export const ReadMarkdownFileArgsSchema = z.object({
	path: z.string().min(1).describe('要读取的 markdown 相对路径，例如 notes/today.md'),
});
export type ReadMarkdownFileArgs = z.infer<typeof ReadMarkdownFileArgsSchema>;

export const readMarkdownFileParameters = {
	type: 'object',
	properties: {
		path: { type: 'string', description: 'Markdown 文件相对路径' },
	},
	required: ['path'],
	additionalProperties: false,
};

export const readMarkdownFileToolMeta = {
	name: 'read_markdown_file',
	description: '读取指定 Markdown 文件内容',
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
