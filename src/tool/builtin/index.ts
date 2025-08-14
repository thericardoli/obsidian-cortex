import type { App } from 'obsidian';
import { functionToolRegistry } from '../function-registry';

import { CreateNewMdFileTool } from './create-new-md-file';
import { ReadMdFileContentTool } from './read-md-file-content';
import { WriteToMdFileTool } from './write-to-md-file';

export const BUILTIN_TOOLS = [
  CreateNewMdFileTool,
  ReadMdFileContentTool,
  WriteToMdFileTool,
];

export function registerBuiltinTools(app: App) {
  for (const tool of BUILTIN_TOOLS) {
    functionToolRegistry.register(tool.name, tool.executorFactory(app));
  }
}

// Helper type for the UI
export type BuiltinToolDefinition = (typeof BUILTIN_TOOLS)[number];
