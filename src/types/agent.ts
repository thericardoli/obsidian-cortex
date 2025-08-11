import { z } from 'zod';
import { ToolConfigSchema } from '../types/tool';

// Tool choice types
export const ToolChoiceSchema = z.union([
	z.enum(['auto', 'required', 'none']),
	z.string(), // 特定工具名称
]);

// Model settings schema
export const ModelSettingsSchema = z
	.object({
		temperature: z.number().min(0).max(2).optional(),
		maxTokens: z.number().positive().optional(),
		topP: z.number().min(0).max(1).optional(),
		frequencyPenalty: z.number().min(-2).max(2).optional(),
		presencePenalty: z.number().min(-2).max(2).optional(),

		// Tool
		toolChoice: ToolChoiceSchema.default('auto'),
		parallelToolCalls: z.boolean().default(false),
	})
	.strict();

export type ModelSettings = z.infer<typeof ModelSettingsSchema>;

// Model configuration schema
export const ModelConfigSchema = z
	.object({
		provider: z.string().min(1),
		model: z.string().min(1),
		settings: ModelSettingsSchema.optional(),
	})
	.strict();

export type ModelConfig = z.infer<typeof ModelConfigSchema>;

// Output type configuration
export const OutputTypeSchema = z.union([
	z.literal('text'), // 默认文本输出
	z.record(z.any()), // JSON schema对象
	z.any(), // Zod schema
]);

export type OutputType = z.infer<typeof OutputTypeSchema>;

// Guardrail configuration
export const GuardrailConfigSchema = z
	.object({
		type: z.enum(['input', 'output']),
		name: z.string(),
		enabled: z.boolean().default(true),
		config: z.record(z.any()).optional(),
	})
	.strict();

export type GuardrailConfig = z.infer<typeof GuardrailConfigSchema>;

// MCP Server configuration
export const MCPServerConfigSchema = z
	.object({
		name: z.string(),
		command: z.string().optional(), // for stdio servers
		args: z.array(z.string()).optional(),
		url: z.string().optional(), // for HTTP servers
		cacheToolsList: z.boolean().default(false),
		config: z.record(z.any()).optional(),
	})
	.strict();

export type MCPServerConfig = z.infer<typeof MCPServerConfigSchema>;

// Runtime context type
export type Context = Record<string, unknown>;

// Agent configuration schema - 更符合SDK结构
export const AgentConfigSchema = z
	.object({
		id: z.string().uuid(),
		name: z.string().min(1).max(100),
		instructions: z.string().min(1),
		createdAt: z.number(),
		updatedAt: z.number(),

		// 模型相关配置
		modelConfig: ModelConfigSchema,

		// 工具相关配置
		tools: z.array(ToolConfigSchema).default([]),

		// 输出配置
		outputType: OutputTypeSchema.optional(),

		// 防护栏配置
		inputGuardrails: z.array(GuardrailConfigSchema).default([]),
		outputGuardrails: z.array(GuardrailConfigSchema).default([]),

		// MCP服务器配置
		mcpServers: z.array(MCPServerConfigSchema).default([]),

		// 生命周期配置
		lifecycle: z
			.object({
				onStart: z.function().optional(),
				onEnd: z.function().optional(),
				onToolStart: z.function().optional(),
				onToolEnd: z.function().optional(),
			})
			.optional(),
	})
	.strict();

export type AgentConfig = z.infer<typeof AgentConfigSchema>;

// Agent creation input schema
export const AgentConfigInputSchema = z
	.object({
		name: z.string().min(1).max(100),
		instructions: z.string().min(1),
		modelConfig: ModelConfigSchema,
		tools: z.array(ToolConfigSchema).default([]),
		outputType: OutputTypeSchema.optional(),
		inputGuardrails: z.array(GuardrailConfigSchema).default([]),
		outputGuardrails: z.array(GuardrailConfigSchema).default([]),
		mcpServers: z.array(MCPServerConfigSchema).default([]),
	})
	.strict();

export type AgentConfigInput = z.infer<typeof AgentConfigInputSchema>;

// Agent update input schema
export const UpdateAgentConfigInputSchema = AgentConfigInputSchema.partial().strict();

export type UpdateAgentConfigInput = z.infer<typeof UpdateAgentConfigInputSchema>;
