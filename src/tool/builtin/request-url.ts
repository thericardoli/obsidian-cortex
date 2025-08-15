import { z } from 'zod';
import { requestUrl, type RequestUrlParam } from 'obsidian';
import { createLogger } from '../../utils/logger';

const logger = createLogger('tool');

// Mirror essential fields from RequestUrlParam for schema (keep optional minimal surface)
export const RequestUrlToolArgsSchema = z
	.object({
		url: z.string().url().describe('目标 URL'),
		method: z.string().optional().describe('HTTP 方法, 默认 GET'),
		headers: z.record(z.string()).optional().describe('请求头'),
		body: z
			.union([z.string(), z.instanceof(ArrayBuffer)])
			.optional()
			.describe('请求体 (string 或 ArrayBuffer)'),
		contentType: z.string().optional().describe('Content-Type (会同时写入 headers)'),
		throwOnError: z.boolean().default(true).describe('是否在状态码>=400时抛错'),
		// 控制响应返回内容量
		includeBodyText: z.boolean().default(true).describe('是否返回 text'),
		includeJson: z.boolean().default(false).describe('尝试解析 JSON'),
		includeHeaders: z.boolean().default(false).describe('是否返回响应头'),
		includeArrayBuffer: z.boolean().default(false).describe('是否返回 ArrayBuffer(长度受限)'),
		arrayBufferMaxBytes: z
			.number()
			.int()
			.positive()
			.max(2_000_000)
			.default(200_000)
			.describe('ArrayBuffer 截断大小上限'),
	})
	.strict();
export type RequestUrlToolArgs = z.infer<typeof RequestUrlToolArgsSchema>;

export const requestUrlToolParameters = {
	type: 'object',
	properties: {
		url: { type: 'string', description: '目标 URL' },
		method: { type: 'string' },
		headers: { type: 'object', additionalProperties: { type: 'string' } },
		body: {
			anyOf: [{ type: 'string' }, { type: 'string', description: 'Base64 for ArrayBuffer' }],
		},
		contentType: { type: 'string' },
		throwOnError: { type: 'boolean', default: true },
		includeBodyText: { type: 'boolean', default: true },
		includeJson: { type: 'boolean', default: false },
		includeHeaders: { type: 'boolean', default: false },
		includeArrayBuffer: { type: 'boolean', default: false },
		arrayBufferMaxBytes: { type: 'number', default: 200000 },
	},
	required: ['url'],
	additionalProperties: false,
};

export const requestUrlToolMeta = {
	name: 'request_url',
	description: '执行一个跨平台的 HTTP(S) 请求 (Obsidian requestUrl 封装)',
	schema: RequestUrlToolArgsSchema,
	parameters: requestUrlToolParameters,
};

export function registerRequestUrlToolExecutor(
	register: (
		name: string,
		exec: (args: unknown, ctx?: unknown) => Promise<unknown> | unknown
	) => void
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
					// resp.json is any; safe-guard with structured cloning attempt
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
