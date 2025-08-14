import { z } from 'zod';
import { App, TFile } from 'obsidian';

const WriteToMdFileSchema = z.object({
  path: z.string().describe('The full path of the file to write to, e.g. "folder/file.md"'),
  content: z.string().describe('The content to write to the file'),
});

function writeToMdFile(app: App) {
  return async (args: z.infer<typeof WriteToMdFileSchema>) => {
    const { path, content } = args;
    try {
      const file = app.vault.getAbstractFileByPath(path);
      if (!file || !(file instanceof TFile)) {
        throw new Error('File not found or is not a markdown file.');
      }
      await app.vault.modify(file, content);
      return `Successfully wrote to file: ${path}`;
    } catch (error) {
      console.error('Error writing to markdown file:', error);
      throw new Error(`Failed to write to file at path: ${path}. Error: ${error.message}`);
    }
  };
}

export const WriteToMdFileTool = {
  name: 'write_to_md_file',
  description: 'Write content to a specific markdown file in the Obsidian vault.',
  parameters: WriteToMdFileSchema,
  executorFactory: writeToMdFile,
};
