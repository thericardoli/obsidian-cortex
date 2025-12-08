import type { RunContext, Tool } from '@openai/agents';
import type { App, Vault, Workspace } from 'obsidian';

type ToolParameters = Parameters<typeof import('@openai/agents').tool>[0]['parameters'];
type ToolErrorHandler = Parameters<typeof import('@openai/agents').tool>[0]['errorFunction'];

export interface ToolContext {
    app: App;
    vault: Vault;
    workspace: Workspace;
}

export type ToolKind = 'function' | 'hosted' | 'agent';

interface BaseToolDefinition {
    id: string;
    name: string;
    description: string;
    builtin: boolean;
    kind: ToolKind;
}

export interface FunctionToolDefinition extends BaseToolDefinition {
    kind: 'function';
    parameters: ToolParameters;
    strict?: boolean;
    errorFunction?: ToolErrorHandler;
    execute: (input: unknown, ctx: ToolContext, runContext?: RunContext) => Promise<unknown>;
}

export interface HostedToolDefinition extends BaseToolDefinition {
    kind: 'hosted';
    factory: () => Tool;
}

export interface AgentToolDefinition extends BaseToolDefinition {
    kind: 'agent';
    factory: () => Tool;
}

export type ToolDefinition = FunctionToolDefinition | HostedToolDefinition | AgentToolDefinition;
