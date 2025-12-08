import { tool, type RunContext, type Tool } from '@openai/agents';
import type { App } from 'obsidian';
import type {
    AgentToolDefinition,
    FunctionToolDefinition,
    HostedToolDefinition,
    ToolContext,
    ToolDefinition,
} from '../types/tool';

export class ToolRegistry {
    private tools = new Map<string, ToolDefinition>();
    private names = new Map<string, string>();
    private sdkToolCache = new Map<string, Tool>();

    constructor(private app: App) {}

    private createContext(): ToolContext {
        return {
            app: this.app,
            vault: this.app.vault,
            workspace: this.app.workspace,
        };
    }

    register(def: ToolDefinition) {
        if (this.tools.has(def.id)) {
            throw new Error(`Tool id ${def.id} is already registered`);
        }
        if (this.names.has(def.name)) {
            throw new Error(`Tool name ${def.name} is already registered`);
        }

        this.tools.set(def.id, def);
        this.names.set(def.name, def.id);
        this.sdkToolCache.delete(def.id);
    }

    unregister(id: string) {
        const def = this.tools.get(id);
        if (!def) return;
        this.tools.delete(id);
        this.names.delete(def.name);
        this.sdkToolCache.delete(id);
    }

    getDefinition(id: string): ToolDefinition | undefined {
        return this.tools.get(id);
    }

    listDefinitions(): ToolDefinition[] {
        return Array.from(this.tools.values());
    }

    listTools(): Tool[] {
        const tools: Tool[] = [];
        for (const def of this.tools.values()) {
            const sdkTool = this.getTool(def.id);
            if (sdkTool) tools.push(sdkTool);
        }
        return tools;
    }

    getTool(id: string): Tool | undefined {
        const def = this.tools.get(id);
        if (!def) return undefined;

        const cached = this.sdkToolCache.get(id);
        if (cached) return cached;

        if (def.kind === 'function') {
            const built = this.buildFunctionTool(def);
            this.sdkToolCache.set(id, built);
            return built;
        }

        if (def.kind === 'hosted') {
            const built = this.buildHostedTool(def);
            this.sdkToolCache.set(id, built);
            return built;
        }

        if (def.kind === 'agent') {
            const built = this.buildAgentTool(def);
            this.sdkToolCache.set(id, built);
            return built;
        }

        return undefined;
    }

    private buildFunctionTool(def: FunctionToolDefinition): Tool {
        const strictValue = def.strict ?? true;

        if (!strictValue && this.isZodSchema(def.parameters)) {
            throw new Error(`Tool ${def.id} cannot disable strict mode when using a Zod schema`);
        }

        const options = {
            name: def.name,
            description: def.description,
            parameters: def.parameters as Parameters<typeof tool>[0]['parameters'],
            strict: strictValue,
            errorFunction: def.errorFunction,
            execute: async (input: unknown, runContext?: RunContext) => {
                const ctx = this.createContext();
                return def.execute(input, ctx, runContext);
            },
        } as unknown as Parameters<typeof tool>[0];

        return tool(options);
    }

    private buildHostedTool(def: HostedToolDefinition): Tool {
        return def.factory();
    }

    private buildAgentTool(def: AgentToolDefinition): Tool {
        return def.factory();
    }

    private isZodSchema(value: unknown): value is { safeParse: (input: unknown) => unknown } {
        return Boolean(value && typeof value === 'object' && 'safeParse' in value);
    }
}
