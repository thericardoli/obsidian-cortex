// RunnerService 封装了 OpenAI Agents SDK 的运行与流式事件处理。
// 这里使用 any 避免与 SDK 内部复杂的泛型类型耦合，专注于行为逻辑。

// eslint-disable-next-line @typescript-eslint/no-explicit-any
import type { Agent } from '@openai/agents';
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const { Runner } = require('@openai/agents') as { Runner: any };

export interface StreamCallbacks {
    onTextDelta?: (delta: string) => void;
    onAgentSwitch?: (agent: Agent) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onToolCall?: (info: any) => void;
}

export class RunnerService {
    isStreaming = false;
    currentAgentName: string | null = null;
    streamingText = '';

    async runOnce(agent: Agent, input: string) {
        // 类型上使用 any 与 SDK 的 Runner.run 对接，避免泛型噪音
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (Runner as any).run(agent, input);
    }

    async runStreamed(agent: Agent, input: string, callbacks: StreamCallbacks = {}) {
        this.isStreaming = true;
        this.streamingText = '';

        // 调用 SDK 的 Runner.run_streamed 获取带有 stream_events 的结果
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = (Runner as any).run_streamed(agent, input);

        // 按 Python 文档风格处理 stream_events
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for await (const event of result.stream_events() as AsyncIterable<any>) {
            if (
                event.type === 'raw_response_event' &&
                event.data &&
                typeof event.data.delta === 'string'
            ) {
                const delta = event.data.delta as string;
                if (delta.length > 0) {
                    this.streamingText += delta;
                    callbacks.onTextDelta?.(delta);
                }
            } else if (event.type === 'agent_updated_stream_event' && event.new_agent) {
                this.currentAgentName = event.new_agent.name as string;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                callbacks.onAgentSwitch?.(event.new_agent as any);
            } else if (event.type === 'run_item_stream_event') {
                callbacks.onToolCall?.(event.item);
            }
        }

        this.isStreaming = false;

        return result;
    }
}
