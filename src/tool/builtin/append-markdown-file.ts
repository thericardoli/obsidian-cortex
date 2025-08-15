import { z } from 'zod';
import { TFile, type App } from 'obsidian';
import { createLogger } from '../../utils/logger';

const logger = createLogger('tool');

export const AppendMarkdownFileArgsSchema = z.object({
	path: z.string().min(1).describe('要写入的 markdown 相对路径'),
	content: z.string().min(1).describe('要追加的内容'),
	createIfNotExists: z.boolean().default(true).describe('若不存在则创建'),
	separator: z.string().default('\n').describe('追加前的分隔符'),
});
export type AppendMarkdownFileArgs = z.infer<typeof AppendMarkdownFileArgsSchema>;

export const appendMarkdownFileParameters = {
	type: 'object',
	properties: {
		path: { type: 'string', description: 'Markdown 文件相对路径' },
		content: { type: 'string', description: '要追加的内容' },
		createIfNotExists: { type: 'boolean', default: true },
		separator: { type: 'string', default: '\n' },
	},
	required: ['path', 'content'],
	additionalProperties: false,
};

export const appendMarkdownFileToolMeta = {
	name: 'append_markdown_file',
	description: '向指定 Markdown 文件追加内容，必要时创建文件',
	schema: AppendMarkdownFileArgsSchema,
	parameters: appendMarkdownFileParameters,
};

export function registerAppendMarkdownFileExecutor(
	register: (
		name: string,
		exec: (args: unknown, ctx?: unknown) => Promise<unknown> | unknown
	) => void,
	app: App
): void {
	register(appendMarkdownFileToolMeta.name, async (raw: unknown) => {
		const { path, content, createIfNotExists, separator } =
			AppendMarkdownFileArgsSchema.parse(raw);
		try {
			const existing = app.vault.getAbstractFileByPath(path);
			if (existing instanceof TFile) {
				const prev = await app.vault.read(existing);
				const next = prev ? prev + (separator ?? '\n') + content : content;
				await app.vault.modify(existing, next);
				return { ok: true, path, appended: true, newLength: next.length };
			}
			if (!existing && createIfNotExists) {
				// ensure folders
				const segments = path.split('/');
				if (segments.length > 1) {
					let current = '';
					for (const seg of segments.slice(0, -1)) {
						current = current ? current + '/' + seg : seg;
						if (!app.vault.getAbstractFileByPath(current)) {
							await app.vault.createFolder(current);
						}
					}
				}
				await app.vault.create(path.endsWith('.md') ? path : path + '.md', content);
				return {
					ok: true,
					path: path.endsWith('.md') ? path : path + '.md',
					created: true,
				};
			}
			return { ok: false, error: 'File not found' };
		} catch (e) {
			logger.error('append_markdown_file failed', e);
			return { ok: false, error: e instanceof Error ? e.message : String(e) };
		}
	});
}
