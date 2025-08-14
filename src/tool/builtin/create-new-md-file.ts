import { z } from 'zod';
import type { App } from 'obsidian';

const CreateNewMdFileSchema = z.object({
  path: z.string().describe('The full path of the new file, e.g. "folder/new-file.md"'),
  content: z.string().optional().describe('The initial content of the file'),
});

function createNewMdFile(app: App) {
  return async (args: z.infer<typeof CreateNewMdFileSchema>) => {
    const { path, content } = args;
    try {
      await app.vault.create(path, content || '');
      return `Successfully created file: ${path}`;
    } catch (error) {
      console.error('Error creating new markdown file:', error);
      throw new Error(`Failed to create file at path: ${path}. Error: ${error.message}`);
    }
  };
}

export const CreateNewMdFileTool = {
  name: 'create_new_md_file',
  description: 'Create a new markdown file in the Obsidian vault.',
  parameters: CreateNewMdFileSchema,
  executorFactory: createNewMdFile,
};
