import { tool, type Tool } from '@openai/agents';
import type { App } from 'obsidian';
import type { ToolContext, ToolDefinition } from '../types/tool';

export class ToolRegistry {
    private tools = new Map<string, ToolDefinition>();

    constructor(private app: App) {}

    private createContext(): ToolContext {
        return {
            app: this.app,
            vault: this.app.vault,
            workspace: this.app.workspace,
        };
    }

    register(def: ToolDefinition) {
        this.tools.set(def.id, def);
    }

    getDefinition(id: string): ToolDefinition | undefined {
        return this.tools.get(id);
    }

    listDefinitions(): ToolDefinition[] {
        return Array.from(this.tools.values());
    }

    getSdkTool(id: string): Tool | undefined {
        const def = this.tools.get(id);
        if (!def) return undefined;

        const ctx = this.createContext();

        // OpenAI Agents SDK 对 parameters 的类型是 Zod 对象 schema。
        // 这里假设调用方保证传入的是 z.object(...)，避免在此做复杂的类型收窄。
        return tool({
            name: def.name,
            description: def.description,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            parameters: def.parameters as any,
            execute: async (input) => def.execute(input, ctx),
        });
    }
}
