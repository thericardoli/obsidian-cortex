import { functionToolRegistry } from '../function-registry';
import type { ToolExecutor } from '../../types/tool';

// Register all built-in tools
export async function registerBuiltinTools() {
	const modules = import.meta.glob('./*.ts');
	for (const path in modules) {
		if (path === './index.ts') continue;

		const module = await modules[path]();
		if (module && typeof module === 'object') {
			const schema = Object.values(module).find(
				(v: any) => v && v.type === 'function' && v.name && v.executor
			);
			const executor = Object.values(module).find(
				(v: any) => typeof v === 'function' && v.name.endsWith('Executor')
			);

			if (schema && executor && (schema as any).executor) {
				const executorName = (schema as any).executor;
				console.log(`Registering tool: ${executorName}`);
				functionToolRegistry.register(executorName, executor as ToolExecutor);
			}
		}
	}
}
