import { z } from 'zod';
import { TFile, type App } from 'obsidian';
import { createLogger } from '../../utils/logger';
import { buildJsonParametersFromZod } from '../utils/zod-to-json';

const logger = createLogger('tool');

export const CreateMarkdownFileArgsSchema = z.object({
	path: z
		.string()
		.min(1)
		.describe('Path relative to vault root including filename, e.g. "folder/new-note.md"'),
	content: z.string().default('').describe('Initial file content'),
	overwrite: z.boolean().default(false).describe('Overwrite if file already exists'),
});

const createMarkdownFileParameters = buildJsonParametersFromZod(CreateMarkdownFileArgsSchema);

export const createMarkdownFileToolMeta = {
	name: 'create_markdown_file',
	description: 'Create a new Markdown file in the current Obsidian vault',
	schema: CreateMarkdownFileArgsSchema,
	parameters: createMarkdownFileParameters,
};

export function registerCreateMarkdownFileExecutor(
	register: (name: string, exec: (args: unknown, ctx?: unknown) => unknown) => void,
	app: App
): void {
	register(createMarkdownFileToolMeta.name, async (raw: unknown) => {
		const parsed = CreateMarkdownFileArgsSchema.parse(raw);
		const normalized = parsed.path.endsWith('.md') ? parsed.path : parsed.path + '.md';
		try {
			const existing = app.vault.getAbstractFileByPath(normalized);
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
