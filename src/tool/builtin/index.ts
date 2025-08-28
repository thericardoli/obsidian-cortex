import type { App } from 'obsidian';
import type { FunctionToolConfig, ToolParameters } from '../../types/tool';
import {
	createMarkdownFileToolMeta,
	registerCreateMarkdownFileExecutor,
} from './create-markdown-file';
import { readMarkdownFileToolMeta, registerReadMarkdownFileExecutor } from './read-markdown-file';
import { registerRequestUrlToolExecutor, requestUrlToolMeta } from './request-url';

export interface BuiltinFunctionToolMeta {
	name: string;
	description: string;
	parameters: unknown; // JSON schema object
}

export const builtinFunctionTools: BuiltinFunctionToolMeta[] = [
	{
		name: createMarkdownFileToolMeta.name,
		description: createMarkdownFileToolMeta.description,
		parameters: createMarkdownFileToolMeta.parameters,
	},
	{
		name: readMarkdownFileToolMeta.name,
		description: readMarkdownFileToolMeta.description,
		parameters: readMarkdownFileToolMeta.parameters,
	},
	{
		name: requestUrlToolMeta.name,
		description: requestUrlToolMeta.description,
		parameters: requestUrlToolMeta.parameters,
	},
];

// Registration helper
export function registerAllBuiltinFunctionExecutors(
	register: (name: string, exec: (args: unknown, ctx?: unknown) => unknown) => void,
	app: App
): void {
	registerCreateMarkdownFileExecutor(register, app);
	registerReadMarkdownFileExecutor(register, app);
	registerRequestUrlToolExecutor(register);
}

// Helper to map builtin meta to a FunctionToolConfig
export function toFunctionToolConfig(meta: BuiltinFunctionToolMeta): FunctionToolConfig {
	return {
		type: 'function',
		name: meta.name,
		enabled: true,
		description: meta.description,
		parameters: meta.parameters as ToolParameters,
		strict: true,
		needsApproval: false,
		executor: meta.name,
	};
}
