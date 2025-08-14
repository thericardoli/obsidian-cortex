import { z } from 'zod';
import type { FunctionTool, ToolExecutor } from '../../types/tool';
import type { App, TFile } from 'obsidian';

// Define the parameters schema for the read_note tool
export const readNoteParamsSchema = z.object({
  path: z.string().describe("The path of the note to read, relative to the vault root."),
});

// Define the schema for the read_note tool
export const readNoteToolSchema: FunctionTool = {
  type: 'function',
  name: 'read_note',
  description: "Reads the content of a markdown file in the Obsidian vault.",
  parameters: readNoteParamsSchema,
  executor: 'read_note',
};

// Define the executor for the read_note tool
export const readNoteExecutor: ToolExecutor = async (args, context) => {
  const { path } = args as z.infer<typeof readNoteParamsSchema>;
  const app = (context as any)?.app as App;

  if (!app) {
    throw new Error("Obsidian `app` object not available in context.");
  }

  try {
    const file = app.vault.getAbstractFileByPath(path);
    if (!file || !(file instanceof TFile)) {
      throw new Error("File not found or it's a directory.");
    }
    const content = await app.vault.read(file);
    return content;
  } catch (error) {
    console.error("Error reading note:", error);
    throw new Error(`Failed to read note at path: ${path}. Error: ${error.message}`);
  }
};
