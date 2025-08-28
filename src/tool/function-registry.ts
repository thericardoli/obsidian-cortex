// Simple function tool registry to decouple storage from AgentManager
// Avoids using any by typing executor args/output narrowly as unknown
export type ToolExecutor = (args: unknown, ctx?: unknown) => unknown;

export class FunctionToolRegistry {
	private executors: Map<string, ToolExecutor> = new Map();

	register(name: string, exec: ToolExecutor): void {
		if (!name.trim()) throw new Error('FunctionToolRegistry: name is required');
		this.executors.set(name, exec);
	}

	unregister(name: string): void {
		this.executors.delete(name);
	}

	get(name: string): ToolExecutor | undefined {
		return this.executors.get(name);
	}
}

// Shared singleton used across the plugin
export const functionToolRegistry = new FunctionToolRegistry();
