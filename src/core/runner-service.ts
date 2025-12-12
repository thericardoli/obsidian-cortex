/**
 * RunnerService - OpenAI Agents SDK 流式运行封装
 */

import { run } from '@openai/agents';

import type { Session } from './session-manager';
import type { Agent } from '@openai/agents';

export interface StreamCallbacks {
    onTextDelta?: (delta: string) => void;
    onAgentSwitch?: (agent: Agent) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onToolCall?: (info: any) => void;
}

export interface RunOptions {
    session?: Session;
}

// 流式事件类型定义
interface RawModelStreamEvent {
    type: 'raw_model_stream_event';
    data: {
        type: string;
        delta?: string;
    };
}

interface AgentUpdatedStreamEvent {
    type: 'agent_updated_stream_event';
    agent: Agent;
}

interface RunItemStreamEvent {
    type: 'run_item_stream_event';
    name: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    item: any;
}

type StreamEvent = RawModelStreamEvent | AgentUpdatedStreamEvent | RunItemStreamEvent;

export class RunnerService {
    isStreaming = false;
    currentAgentName: string | null = null;
    streamingText = '';

    /**
     * 非流式运行 Agent
     */
    async runOnce(agent: Agent, input: string, options: RunOptions = {}) {
        return run(agent, input, {
            session: options.session,
        });
    }

    /**
     * 流式运行 Agent，通过回调实时返回文本增量
     */
    async runStreamed(
        agent: Agent,
        input: string,
        callbacks: StreamCallbacks = {},
        options: RunOptions = {}
    ) {
        this.isStreaming = true;
        this.streamingText = '';

        try {
            // 使用 { stream: true, session } 选项启用流式模式并传入 session
            // session 会自动管理会话历史
            const result = await run(agent, input, {
                stream: true,
                session: options.session,
            });

            // 遍历流式事件
            for await (const event of result as AsyncIterable<StreamEvent>) {
                if (event.type === 'raw_model_stream_event') {
                    // 处理模型输出的文本增量
                    const data = event.data;
                    if (data.type === 'output_text_delta' && typeof data.delta === 'string') {
                        const delta = data.delta;
                        if (delta.length > 0) {
                            this.streamingText += delta;
                            callbacks.onTextDelta?.(delta);
                        }
                    }
                } else if (event.type === 'agent_updated_stream_event') {
                    // Agent 切换事件
                    this.currentAgentName = event.agent.name;
                    callbacks.onAgentSwitch?.(event.agent);
                } else if (event.type === 'run_item_stream_event') {
                    // 工具调用等事件
                    callbacks.onToolCall?.(event.item);
                }
            }

            return result;
        } finally {
            this.isStreaming = false;
        }
    }
}
