import { z } from 'zod';
import type { FunctionTool, ToolExecutor } from '../../types/tool';
import type { App, TFile } from 'obsidian';

// Define the parameters schema for the write_to_note tool
export const writeToNoteParamsSchema = z.object({
  path: z.string().describe("The path of the note to write to, relative to the vault root."),
  content: z.string().describe("The content to write to the note."),
  overwrite: z.boolean().optional().default(false).describe("Whether to overwrite the existing content or append to it."),
});

// Define the schema for the write_to_note tool
export const writeToNoteToolSchema: FunctionTool = {
  type: 'function',
  name: 'write_to_note',
  description: "Writes or appends content to a markdown file in the Obsidian vault.",
  parameters: writeToNoteParamsSchema,
  executor: 'write_to_note',
};

// Define the executor for the write_to_note tool
export const writeToNoteExecutor: ToolExecutor = async (args, context) => {
  const { path, content, overwrite } = args as z.infer<typeof writeToNoteParamsSchema>;
  const app = (context as any)?.app as App;

  if (!app) {
    throw new Error("Obsidian `app` object not available in context.");
  }

  try {
    const file = app.vault.getAbstractFileByPath(path);
    if (!file || !(file instanceof TFile)) {
      throw new Error("File not found or it's a directory.");
    }

    if (overwrite) {
      await app.vault.modify(file, content);
      return `Successfully overwrote note at path: ${path}`;
    } else {
      await app.vault.append(file, content);
      return `Successfully appended to note at path: ${path}`;
    }
  } catch (error) {
    console.error("Error writing to note:", error);
    throw new Error(`Failed to write to note at path: ${path}. Error: ${error.message}`);
  }
};
