import type { Tool } from '@openai/agents';
import type {
	JsonObjectSchema,
	JsonObjectSchemaNonStrict,
	JsonObjectSchemaStrict,
	JsonSchemaDefinitionEntry,
} from '@openai/agents-core/dist/types/helpers';
import type { ZodObject, ZodTypeAny } from 'zod';
import type { AgentManager } from '../agent/agent-manager';
import type { AgentService } from '../agent/agent-service';
import type { AgentConfig } from '../types/agent';
import type { ToolConfig, ToolParameters } from '../types/tool';
import { createLogger } from '../utils/logger';
import { buildAgentAsTool } from './agent-as-tool';
import { functionToolRegistry } from './function-registry';
import { createHostedTool } from './hosted-registry';

export interface ToolDiagnostic {
	level: 'warn' | 'error';
	message: string;
	toolName?: string;
}

export async function buildTools(
	agentConfig: AgentConfig,
	ctx: { agentManager: AgentManager; agentService: AgentService }
): Promise<{ tools: Tool[]; diagnostics: ToolDiagnostic[] }> {
	const diagnostics: ToolDiagnostic[] = [];
	const tools: Tool[] = [];
	const logger = createLogger('agent');

	for (const toolConfig of agentConfig.tools) {
		if (!toolConfig.enabled) continue;
		try {
			const built = await buildSingle(toolConfig, ctx.agentManager, ctx.agentService);
			if (built) tools.push(built);
		} catch (e) {
			diagnostics.push({
				level: 'warn',
				message: e instanceof Error ? e.message : 'Unknown tool error',
				toolName: toolConfig.name,
			});
		}
	}

	if (diagnostics.length) {
		for (const d of diagnostics) {
			if (d.level === 'warn')
				logger.warn(`Tool diagnostic: ${d.toolName ?? ''} ${d.message}`);
			else logger.error(`Tool diagnostic: ${d.toolName ?? ''} ${d.message}`);
		}
	}

	return { tools, diagnostics };
}

async function buildSingle(
	toolConfig: ToolConfig,
	agentManager: AgentManager,
	agentService: AgentService
): Promise<Tool | null> {
	switch (toolConfig.type) {
		case 'function': {
			const executorName = toolConfig.executor;
			const executor = executorName ? functionToolRegistry.get(executorName) : undefined;
			if (!executor)
				throw new Error(`No executor found for function tool: ${toolConfig.name}`);
			const { tool } = await import('@openai/agents');
			const isStrict = toolConfig.strict ?? true;
			if (isStrict) {
				const params = toStrictParameters(toolConfig.parameters);
				return tool({
					name: toolConfig.name,
					description: toolConfig.description || '',
					parameters: params,
					strict: true,
					needsApproval: toolConfig.needsApproval ?? false,
					execute: (args: unknown, runContext?: unknown) => executor(args, runContext),
				});
			} else {
				const params = toNonStrictParameters(toolConfig.parameters);
				return tool({
					name: toolConfig.name,
					description: toolConfig.description || '',
					parameters: params,
					strict: false,
					needsApproval: toolConfig.needsApproval ?? false,
					execute: (args: unknown, runContext?: unknown) => executor(args, runContext),
				});
			}
		}
		case 'hosted': {
			const hosted = createHostedTool(
				toolConfig.name as unknown as import('./hosted-registry').HostedToolName,
				toolConfig.providerData ?? {}
			);
			return hosted ?? null;
		}
		case 'agent': {
			const agentTool = await buildAgentAsTool(agentManager, agentService, toolConfig);
			return agentTool ?? null;
		}
	}
}

function isZodObject(v: unknown): v is ZodObject<Record<string, ZodTypeAny>> {
	const o = v as { safeParse?: unknown; _def?: { typeName?: unknown } };
	return (
		typeof v === 'object' &&
		v !== null &&
		typeof o.safeParse === 'function' &&
		o._def !== undefined &&
		o._def.typeName === 'ZodObject'
	);
}

function isJsonObjectSchema(
	v: unknown
): v is JsonObjectSchema<Record<string, JsonSchemaDefinitionEntry>> {
	const o = v as {
		type?: unknown;
		properties?: unknown;
		required?: unknown;
		additionalProperties?: unknown;
	};
	return (
		typeof o === 'object' &&
		o !== null &&
		o.type === 'object' &&
		typeof o.properties === 'object' &&
		Array.isArray(o.required) &&
		typeof o.additionalProperties === 'boolean'
	);
}

type StrictParams =
	| ZodObject<Record<string, ZodTypeAny>>
	| JsonObjectSchemaStrict<Record<string, JsonSchemaDefinitionEntry>>;
type NonStrictParams =
	| JsonObjectSchemaNonStrict<Record<string, JsonSchemaDefinitionEntry>>
	| undefined;

function toStrictParameters(p: ToolParameters | undefined): StrictParams {
	if (p && isZodObject(p)) return p;
	if (p && isJsonObjectSchema(p)) {
		// Force strict additionalProperties=false
		const strictObj: JsonObjectSchemaStrict<Record<string, JsonSchemaDefinitionEntry>> = {
			type: 'object',
			properties: { ...(p.properties || {}) },
			required: Array.isArray(p.required) ? [...p.required] : [],
			additionalProperties: false,
		};
		return strictObj;
	}
	const fallback: JsonObjectSchemaStrict<Record<string, JsonSchemaDefinitionEntry>> = {
		type: 'object',
		properties: {},
		required: [],
		additionalProperties: false,
	};
	return fallback;
}

function toNonStrictParameters(p: ToolParameters | undefined): NonStrictParams {
	if (p && isJsonObjectSchema(p)) {
		const nonStrict: JsonObjectSchemaNonStrict<Record<string, JsonSchemaDefinitionEntry>> = {
			type: 'object',
			properties: { ...(p.properties || {}) },
			required: Array.isArray(p.required) ? [...p.required] : [],
			additionalProperties: true,
		};
		return nonStrict;
	}
	// When non-strict and no valid JSON schema provided, allow undefined (SDK permits)
	return {
		type: 'object',
		properties: {},
		required: [],
		additionalProperties: true,
	} as JsonObjectSchemaNonStrict<Record<string, JsonSchemaDefinitionEntry>>;
}
