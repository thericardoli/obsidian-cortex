import type { z } from 'zod';
import type { App, Vault, Workspace } from 'obsidian';

export interface ToolContext {
    app: App;
    vault: Vault;
    workspace: Workspace;
}

export interface ToolDefinition {
    id: string;
    name: string;
    description: string;
    parameters: z.ZodSchema;
    execute: (input: unknown, ctx: ToolContext) => Promise<unknown>;
    builtin: boolean;
}
