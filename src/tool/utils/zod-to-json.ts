import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

/**
 * Generate the JSON Schema (object root) required by an OpenAI Function Tool.
 * Applies minimal wrapping only for schemas used in this project and patches description for the ArrayBuffer union.
 */
export function buildJsonParametersFromZod<T extends z.ZodTypeAny>(schema: T) {
	const json = zodToJsonSchema(schema, {
		name: 'ToolArgs',
	});
	const definitions = (json as { definitions?: Record<string, unknown> }).definitions;
	const toolArgs = definitions?.ToolArgs as Record<string, unknown> | undefined;
	const root = (toolArgs || (json as Record<string, unknown>)) as Record<string, unknown>;
	const props = root.properties as Record<string, unknown> | undefined;
	if (props) {
		const body = props.body as Record<string, unknown> | undefined;
		const anyOf = (body?.anyOf as unknown[]) || undefined;
		if (anyOf && Array.isArray(anyOf)) {
			(body as Record<string, unknown>).anyOf = anyOf.map((variant) => {
				if (
					!variant ||
					typeof variant !== 'object' ||
					!('type' in variant) ||
					(variant as { type?: unknown }).type !== 'string'
				) {
					return { type: 'string', description: 'Base64 encoded ArrayBuffer' };
				}
				return variant;
			});
		}
	}
	delete (root as { $schema?: unknown }).$schema;
	return root;
}
