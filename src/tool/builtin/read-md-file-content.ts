import { z } from 'zod';
import type { App } from 'obsidian';

const ReadMdFileContentSchema = z.object({
  path: z.string().describe('The full path of the file to read, e.g. "folder/file.md"'),
});

function readMdFileContent(app: App) {
  return async (args: z.infer<typeof ReadMdFileContentSchema>) => {
    const { path } = args;
    try {
      const file = app.vault.getAbstractFileByPath(path);
      if (!file || !('read' in file)) {
        throw new Error('File not found or is not a readable file.');
      }
      // @ts-expect-error we already checked if it's a file
      const content = await app.vault.read(file);
      return content;
    } catch (error) {
      console.error('Error reading markdown file:', error);
      throw new Error(`Failed to read file at path: ${path}. Error: ${error.message}`);
    }
  };
}

export const ReadMdFileContentTool = {
  name: 'read_md_file_content',
  description: 'Read the content of a markdown file in the Obsidian vault.',
  parameters: ReadMdFileContentSchema,
  executorFactory: readMdFileContent,
};
