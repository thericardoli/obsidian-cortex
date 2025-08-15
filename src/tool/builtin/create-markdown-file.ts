import { z } from 'zod';
import { TFile, type App, type TAbstractFile } from 'obsidian';
import { createLogger } from '../../utils/logger';

const logger = createLogger('tool');

export const CreateMarkdownFileArgsSchema = z.object({
	path: z.string().min(1).describe('相对于库根目录的路径，包含文件名，例如 "folder/new-note.md"'),
	content: z.string().default('').describe('初始写入内容'),
	overwrite: z.boolean().default(false).describe('若文件已存在是否覆盖'),
});
export type CreateMarkdownFileArgs = z.infer<typeof CreateMarkdownFileArgsSchema>;

export const createMarkdownFileParameters = {
	type: 'object',
	properties: {
		path: {
			type: 'string',
			description: '相对于库根目录的路径，包含文件名，例如 folder/new-note.md',
		},
		content: { type: 'string', description: '初始写入内容' },
		overwrite: { type: 'boolean', description: '若文件已存在是否覆盖', default: false },
	},
	required: ['path'],
	additionalProperties: false,
};

export const createMarkdownFileToolMeta = {
	name: 'create_markdown_file',
	description: '在当前 Obsidian 笔记库中创建一个新的 Markdown 文件',
	schema: CreateMarkdownFileArgsSchema,
	parameters: createMarkdownFileParameters,
};

export function registerCreateMarkdownFileExecutor(
	register: (
		name: string,
		exec: (args: unknown, ctx?: unknown) => Promise<unknown> | unknown
	) => void,
	app: App
): void {
	register(createMarkdownFileToolMeta.name, async (raw: unknown) => {
		const parsed = CreateMarkdownFileArgsSchema.parse(raw);
		const normalized = parsed.path.endsWith('.md') ? parsed.path : parsed.path + '.md';
		try {
			const existing = app.vault.getAbstractFileByPath(normalized) as TAbstractFile | null;
			if (existing && !parsed.overwrite) {
				return { ok: false, error: 'File already exists' };
			}
			if (existing instanceof TFile) {
				// overwrite path
				await app.vault.modify(existing, parsed.content ?? '');
				return { ok: true, path: normalized, overwritten: true };
			}
			// Ensure folder exists (Obsidian vault auto-creates intermediate?) We'll manually create.
			const segments = normalized.split('/');
			if (segments.length > 1) {
				const folders = segments.slice(0, -1);
				let currentPath = '';
				for (const folder of folders) {
					currentPath = currentPath ? currentPath + '/' + folder : folder;
					const maybe = app.vault.getAbstractFileByPath(currentPath);
					if (!maybe) {
						await app.vault.createFolder(currentPath);
					}
				}
			}
			await app.vault.create(normalized, parsed.content ?? '');
			return { ok: true, path: normalized, created: true };
		} catch (e) {
			logger.error('create_markdown_file failed', e);
			return { ok: false, error: e instanceof Error ? e.message : String(e) };
		}
	});
}
