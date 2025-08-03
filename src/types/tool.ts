import { z } from "zod";

// Common tool choice type (aligns with SDK)
export const ToolChoiceSchema = z.union([
  z.enum(["auto", "required", "none"]),
  z.string(),
]);
export type ToolChoice = z.infer<typeof ToolChoiceSchema>;

// Parameters can be JSON schema or any Zod schema value placeholder
export const ToolParametersSchema = z.union([
  z.record(z.any()),
  z.any(),
]);

// Custom function tool config
export const FunctionToolConfigSchema = z
  .object({
    type: z.literal("function"),
    name: z.string().min(1),
    enabled: z.boolean().default(true),
    description: z.string().optional(),
    parameters: ToolParametersSchema.optional(),
    strict: z.boolean().optional(),
    needsApproval: z.boolean().default(false),
    // 指向执行器的注册名，用于在实例化 Agent 时绑定 execute
    executor: z.string().optional(),
    // 额外配置信息
    config: z.record(z.any()).optional(),
  })
  .strict();
export type FunctionToolConfig = z.infer<typeof FunctionToolConfigSchema>;

// Hosted tool config（OpenAI Hosted Tools）
export const HostedToolConfigSchema = z
  .object({
    type: z.literal("hosted"),
    name: z.string().min(1),
    enabled: z.boolean().default(true),
    // 传递给 hosted 工具的 providerData/配置
    providerData: z.record(z.any()).optional(),
    config: z.record(z.any()).optional(),
  })
  .strict();
export type HostedToolConfig = z.infer<typeof HostedToolConfigSchema>;

// Agent as tool
export const AgentAsToolConfigSchema = z
  .object({
    type: z.literal("agent"),
    name: z.string().min(1),
    enabled: z.boolean().default(true),
    targetAgentId: z.string().uuid(),
    description: z.string().optional(),
    needsApproval: z.boolean().default(false),
  })
  .strict();

// 为TypeScript添加额外的类型定义
export interface AgentAsToolConfig extends z.infer<typeof AgentAsToolConfigSchema> {
  // Agent-as-Tool 特定配置 - 自定义输出提取器
  customOutputExtractor?: (output: unknown) => string | Promise<string>;
}

// Unified ToolConfig
export const ToolConfigSchema = z.discriminatedUnion("type", [
  FunctionToolConfigSchema,
  HostedToolConfigSchema,
  AgentAsToolConfigSchema,
]);
export type ToolConfig = z.infer<typeof ToolConfigSchema>;
