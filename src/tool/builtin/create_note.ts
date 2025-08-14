import { z } from 'zod';
import type { FunctionTool, ToolExecutor } from '../../types/tool';
import type { App } from 'obsidian';

// Define the parameters schema for the create_note tool
export const createNoteParamsSchema = z.object({
  path: z.string().describe("The path for the new note, relative to the vault root."),
  content: z.string().describe("The initial content of the new note."),
});

// Define the schema for the create_note tool
export const createNoteToolSchema: FunctionTool = {
  type: 'function',
  name: 'create_note',
  description: "Creates a new markdown file in the Obsidian vault.",
  parameters: createNoteParamsSchema,
  executor: 'create_note',
};

// Define the executor for the create_note tool
export const createNoteExecutor: ToolExecutor = async (args, context) => {
  const { path, content } = args as z.infer<typeof createNoteParamsSchema>;
  const app = (context as any)?.app as App;

  if (!app) {
    throw new Error("Obsidian `app` object not available in context.");
  }

  try {
    await app.vault.create(path, content);
    return `Successfully created note at path: ${path}`;
  } catch (error) {
    console.error("Error creating note:", error);
    throw new Error(`Failed to create note at path: ${path}. Error: ${error.message}`);
  }
};
