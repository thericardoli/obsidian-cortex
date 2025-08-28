import { z } from 'zod';
import { requestUrl, type RequestUrlParam } from 'obsidian';
import { createLogger } from '../../utils/logger';
import { buildJsonParametersFromZod } from '../utils/zod-to-json';

const logger = createLogger('tool');

export const RequestUrlToolArgsSchema = z
	.object({
		url: z.string().url().describe('Target URL'),
		method: z.string().optional().describe('HTTP method, default GET'),
		headers: z.record(z.string()).optional().describe('Request headers'),
		body: z
			.union([z.string(), z.instanceof(ArrayBuffer)])
			.optional()
			.describe('Request body (string or ArrayBuffer)'),
		contentType: z.string().optional().describe('Content-Type (also written into headers)'),
		throwOnError: z.boolean().default(true).describe('Throw when status code >= 400'),
		// Control which response parts are included
		includeBodyText: z.boolean().default(true).describe('Include response text'),
		includeJson: z.boolean().default(false).describe('Attempt to parse JSON'),
		includeHeaders: z.boolean().default(false).describe('Include response headers'),
		includeArrayBuffer: z
			.boolean()
			.default(false)
			.describe('Include ArrayBuffer (length limited)'),
		arrayBufferMaxBytes: z
			.number()
			.int()
			.positive()
			.max(2_000_000)
			.default(200_000)
			.describe('Max bytes to keep for ArrayBuffer (truncate afterwards)'),
	})
	.strict();

const requestUrlToolParameters = buildJsonParametersFromZod(RequestUrlToolArgsSchema);

export const requestUrlToolMeta = {
	name: 'request_url',
	description: 'Perform a cross-platform HTTP(S) request (wrapper around Obsidian requestUrl)',
	schema: RequestUrlToolArgsSchema,
	parameters: requestUrlToolParameters,
};

export function registerRequestUrlToolExecutor(
	register: (name: string, exec: (args: unknown, ctx?: unknown) => unknown) => void
): void {
	register(requestUrlToolMeta.name, async (raw: unknown) => {
		const args = RequestUrlToolArgsSchema.parse(raw);
		const req: RequestUrlParam = {
			url: args.url,
			method: args.method,
			headers: { ...(args.headers || {}) },
			body: args.body,
			contentType: args.contentType,
			throw: args.throwOnError,
		};
		// If user provided contentType but not header explicitly ensure header
		if (args.contentType && !req.headers?.['Content-Type']) {
			req.headers = { ...(req.headers || {}), 'Content-Type': args.contentType };
		}
		const started = Date.now();
		try {
			const resp = await requestUrl(req);
			const base: Record<string, unknown> = {
				ok: resp.status >= 200 && resp.status < 400,
				status: resp.status,
				tookMs: Date.now() - started,
				url: args.url,
			};
			if (args.includeBodyText) base.text = resp.text?.slice(0, 200_000);
			if (args.includeJson) {
				try {
					base.json = resp.json;
				} catch (e) {
					base.jsonError = e instanceof Error ? e.message : String(e);
				}
			}
			if (args.includeHeaders) base.headers = resp.headers;
			if (args.includeArrayBuffer) {
				try {
					const buf = resp.arrayBuffer;
					const limited =
						buf.byteLength > args.arrayBufferMaxBytes
							? buf.slice(0, args.arrayBufferMaxBytes)
							: buf;
					// Return base64 to keep JSON safe
					const b64 = Buffer.from(limited).toString('base64');
					base.arrayBufferBase64 = b64;
					base.arrayBufferBytes = limited.byteLength;
				} catch (e) {
					base.arrayBufferError = e instanceof Error ? e.message : String(e);
				}
			}
			return base;
		} catch (e) {
			logger.error('request_url tool error', e);
			return {
				ok: false,
				error: e instanceof Error ? e.message : String(e),
				url: args.url,
			};
		}
	});
}
